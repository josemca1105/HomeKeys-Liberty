import { AuditScope, Prisma, PropertyStatus, Role } from "@prisma/client";
import { prisma } from "../config/database";
import { findUserById } from "../repositories/user-repository";
import {
  countProperties,
  createPropertyRecord,
  findPropertiesPage,
  findPropertyById,
  updatePropertyRecord,
} from "../repositories/property-repository";
import {
  findPhotosByPropertyId,
  findPhotosByPropertyIds,
} from "../repositories/photo-repository";
import { runSerializableTransaction } from "../repositories/serializable-transaction";
import type { AuditContext } from "../types/audit";
import type { AuthSession } from "../types/auth";
import type {
  CreatePropertyInput,
  ListPropertiesQuery,
  PaginatedPropertiesResult,
  PropertyResponse,
  UpdatePropertyInput,
} from "../types/property";
import { AppError } from "../utils/app-error";
import { toPropertyResponse } from "../utils/property-response";
import { recordAuditEventInTransaction } from "./audit-service";
import {
  assertPhotoBatchReadyForCreation,
  attachPhotoBatchToProperty,
} from "./property-photo-batch-service";

const propertyNotFoundError = (): AppError =>
  new AppError({
    statusCode: 404,
    code: "PROPERTY_NOT_FOUND",
    message: "La captación que buscas no existe.",
  });

const agentAssignmentForbiddenError = (): AppError =>
  new AppError({
    statusCode: 403,
    code: "PROPERTY_AGENT_ASSIGNMENT_FORBIDDEN",
    message: "Solamente un administrador puede asignar o cambiar el agente.",
  });

const invalidAgentError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "INVALID_PROPERTY_AGENT",
    message: "El responsable debe ser un usuario existente.",
  });

const inactiveAgentError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "PROPERTY_AGENT_INACTIVE",
    message: "El usuario responsable está desactivado.",
  });

const closedPropertyError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "PROPERTY_CLOSED",
    message:
      "La captación está cerrada. Solamente un administrador puede modificarla o reabrirla.",
  });

const toMoney = (value: number): Prisma.Decimal =>
  new Prisma.Decimal(value.toFixed(2));

const toCoordinate = (value: number): Prisma.Decimal =>
  new Prisma.Decimal(value.toFixed(7));

const assertAgentAvailableForAssignment = async (
  agentId: number,
  transaction: Prisma.TransactionClient,
): Promise<void> => {
  const agent = await findUserById(agentId, transaction);

  if (!agent) {
    throw invalidAgentError();
  }

  if (!agent.isActive) {
    throw inactiveAgentError();
  }
};

const resolveCreateAgentId = async (
  requestedAgentId: number | undefined,
  session: AuthSession,
  transaction: Prisma.TransactionClient,
): Promise<number> => {
  if (session.role === Role.PARTNER) {
    if (requestedAgentId !== undefined) {
      throw agentAssignmentForbiddenError();
    }

    return session.userId;
  }

  if (requestedAgentId === undefined || requestedAgentId === session.userId) {
    return session.userId;
  }

  await assertAgentAvailableForAssignment(requestedAgentId, transaction);
  return requestedAgentId;
};

const assertPropertyAccess = (
  propertyAgentId: number,
  session: AuthSession,
): void => {
  if (session.role !== Role.ADMIN && propertyAgentId !== session.userId) {
    // Unauthorized owners receive the same response as an unknown property so
    // the API never confirms that a capture exists.
    throw propertyNotFoundError();
  }
};

const agentFilterForbiddenError = (): AppError =>
  new AppError({
    statusCode: 403,
    code: "PROPERTY_AGENT_FILTER_FORBIDDEN",
    message: "Solamente un administrador puede filtrar por otro agente.",
  });

const buildPropertyWhere = (
  query: ListPropertiesQuery,
  session: AuthSession,
): Prisma.PropertyWhereInput => {
  let agentId = query.agentId;

  if (session.role !== Role.ADMIN) {
    if (agentId !== undefined && agentId !== session.userId) {
      throw agentFilterForbiddenError();
    }

    agentId = session.userId;
  }

  const where: Prisma.PropertyWhereInput = {
    deletedAt: null,
    ...(agentId !== undefined ? { agentId } : {}),
    ...(query.code !== undefined ? { code: query.code } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.propertyType !== undefined
      ? { propertyType: query.propertyType }
      : {}),
    ...(query.listingType !== undefined
      ? { listingType: query.listingType }
      : {}),
    ...(query.state !== undefined
      ? { state: { equals: query.state, mode: "insensitive" } }
      : {}),
    ...(query.city !== undefined
      ? { city: { equals: query.city, mode: "insensitive" } }
      : {}),
    ...(query.neighborhood !== undefined
      ? {
          neighborhood: {
            contains: query.neighborhood,
            mode: "insensitive",
          },
        }
      : {}),
    ...(query.bedroomsMin !== undefined
      ? { bedrooms: { gte: query.bedroomsMin } }
      : {}),
    ...(query.bathroomsMin !== undefined
      ? { bathrooms: { gte: query.bathroomsMin } }
      : {}),
    ...(query.parkingSpacesMin !== undefined
      ? { parkingSpaces: { gte: query.parkingSpacesMin } }
      : {}),
    ...(query.priceMin !== undefined || query.priceMax !== undefined
      ? {
          price: {
            ...(query.priceMin !== undefined
              ? { gte: toMoney(query.priceMin) }
              : {}),
            ...(query.priceMax !== undefined
              ? { lte: toMoney(query.priceMax) }
              : {}),
          },
        }
      : {}),
  };

  if (query.search !== undefined) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
      { address: { contains: query.search, mode: "insensitive" } },
      { neighborhood: { contains: query.search, mode: "insensitive" } },
      { ownerName: { contains: query.search, mode: "insensitive" } },
      { ownerPhone: { contains: query.search } },
    ];
  }

  return where;
};

const buildPropertyOrderBy = (
  query: ListPropertiesQuery,
): Prisma.PropertyOrderByWithRelationInput[] => {
  const primary = {
    [query.sortBy]: query.sortOrder,
  } as Prisma.PropertyOrderByWithRelationInput;
  const tieBreaker: Prisma.PropertyOrderByWithRelationInput =
    query.sortBy === "title" ? { id: "asc" } : { id: query.sortOrder };

  return [primary, tieBreaker];
};

export const listProperties = async (
  query: ListPropertiesQuery,
  session: AuthSession,
): Promise<PaginatedPropertiesResult> => {
  const where = buildPropertyWhere(query, session);
  const skip = (query.page - 1) * query.pageSize;
  const [properties, total] = await Promise.all([
    findPropertiesPage({
      where,
      orderBy: buildPropertyOrderBy(query),
      skip,
      take: query.pageSize,
    }),
    countProperties(where),
  ]);
  const photos = await findPhotosByPropertyIds(
    properties.map((property) => property.id),
  );
  const photosByProperty = new Map<number, typeof photos>();

  for (const photo of photos) {
    const propertyPhotos = photosByProperty.get(photo.propertyId) ?? [];
    propertyPhotos.push(photo);
    photosByProperty.set(photo.propertyId, propertyPhotos);
  }

  return {
    properties: properties.map((property) =>
      toPropertyResponse(property, photosByProperty.get(property.id) ?? []),
    ),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
};

const buildCreateData = (
  input: CreatePropertyInput,
  agentId: number,
): Prisma.PropertyUncheckedCreateInput => ({
  agentId,
  title: input.title,
  propertyType: input.propertyType,
  listingType: input.listingType,
  status: PropertyStatus.ACTIVE,
  description: input.description ?? null,
  ownerName: input.ownerName,
  ownerPhone: input.ownerPhone,
  ownerEmail: input.ownerEmail ?? null,
  address: input.address,
  neighborhood: input.neighborhood ?? null,
  city: input.city,
  state: input.state,
  latitude: toCoordinate(input.latitude),
  longitude: toCoordinate(input.longitude),
  price: toMoney(input.price),
  maintenanceFee:
    input.maintenanceFee === undefined || input.maintenanceFee === null
      ? null
      : toMoney(input.maintenanceFee),
  isNegotiable: input.isNegotiable ?? false,
  bedrooms: input.bedrooms,
  bathrooms: input.bathrooms,
  parkingSpaces: input.parkingSpaces,
  squareMeters: toMoney(input.squareMeters),
  lotSquareMeters:
    input.lotSquareMeters === undefined || input.lotSquareMeters === null
      ? null
      : toMoney(input.lotSquareMeters),
  yearBuilt: input.yearBuilt ?? null,
  apartmentFloor: input.apartmentFloor ?? null,
  hasWaterTank: input.hasWaterTank ?? false,
  hasPowerPlant: input.hasPowerPlant ?? false,
  isFurnished: input.isFurnished ?? false,
  allowsPets: input.allowsPets ?? false,
  hasPool: input.hasPool ?? false,
  hasGym: input.hasGym ?? false,
  hasBalcony: input.hasBalcony ?? false,
  hasAirConditioning: input.hasAirConditioning ?? false,
  hasSecurity: input.hasSecurity ?? false,
  hasElevator: input.hasElevator ?? false,
  videoUrl: input.videoUrl ?? null,
  virtualTourUrl: input.virtualTourUrl ?? null,
});

export const createProperty = async (
  input: CreatePropertyInput,
  session: AuthSession,
  auditContext: AuditContext,
): Promise<PropertyResponse> => {
  return runSerializableTransaction(async (transaction) => {
    const agentId = await resolveCreateAgentId(
      input.agentId,
      session,
      transaction,
    );
    await assertPhotoBatchReadyForCreation(
      input.photoBatchId,
      session,
      input.coverUploadId,
      transaction,
    );
    const created = await createPropertyRecord(
      buildCreateData(input, agentId),
      transaction,
    );
    const photos = await attachPhotoBatchToProperty(
      input.photoBatchId,
      session,
      created.id,
      input.coverUploadId,
      transaction,
    );

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.BUSINESS,
      action: "PROPERTY_CREATED",
      actor: auditContext.actor,
      entityType: "PROPERTY",
      entityId: created.id,
      changes: {
        code: created.code,
        title: created.title,
        agentId: created.agentId,
        status: created.status,
        photoCount: photos.length,
      },
      request: auditContext.request,
    });

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.BUSINESS,
      action: "PROPERTY_PHOTOS_ATTACHED",
      actor: auditContext.actor,
      entityType: "PROPERTY",
      entityId: created.id,
      changes: {
        photoIds: photos.map((photo) => photo.id),
        photoBatchId: input.photoBatchId,
        coverPhotoId:
          photos.find((photo) => photo.isCover)?.id ?? null,
      },
      request: auditContext.request,
    });

    return toPropertyResponse(created, photos);
  });
};

export const getProperty = async (
  propertyId: number,
  session: AuthSession,
): Promise<PropertyResponse> => {
  const property = await findPropertyById(propertyId);

  if (!property) {
    throw propertyNotFoundError();
  }

  assertPropertyAccess(property.agentId, session);
  const photos = await findPhotosByPropertyId(propertyId);
  return toPropertyResponse(property, photos);
};

const buildUpdateData = (
  input: UpdatePropertyInput,
  property: { status: PropertyStatus; agentId: number },
): Prisma.PropertyUncheckedUpdateInput => {
  const data: Prisma.PropertyUncheckedUpdateInput = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.propertyType !== undefined) data.propertyType = input.propertyType;
  if (input.listingType !== undefined) data.listingType = input.listingType;
  if (input.description !== undefined) data.description = input.description;
  if (input.ownerName !== undefined) data.ownerName = input.ownerName;
  if (input.ownerPhone !== undefined) data.ownerPhone = input.ownerPhone;
  if (input.ownerEmail !== undefined) data.ownerEmail = input.ownerEmail;
  if (input.address !== undefined) data.address = input.address;
  if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
  if (input.city !== undefined) data.city = input.city;
  if (input.state !== undefined) data.state = input.state;
  if (input.latitude !== undefined) data.latitude = toCoordinate(input.latitude);
  if (input.longitude !== undefined) {
    data.longitude = toCoordinate(input.longitude);
  }
  if (input.price !== undefined) data.price = toMoney(input.price);
  if (input.maintenanceFee !== undefined) {
    data.maintenanceFee =
      input.maintenanceFee === null ? null : toMoney(input.maintenanceFee);
  }
  if (input.isNegotiable !== undefined) data.isNegotiable = input.isNegotiable;
  if (input.bedrooms !== undefined) data.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) data.bathrooms = input.bathrooms;
  if (input.parkingSpaces !== undefined) {
    data.parkingSpaces = input.parkingSpaces;
  }
  if (input.squareMeters !== undefined) {
    data.squareMeters = toMoney(input.squareMeters);
  }
  if (input.lotSquareMeters !== undefined) {
    data.lotSquareMeters =
      input.lotSquareMeters === null ? null : toMoney(input.lotSquareMeters);
  }
  if (input.yearBuilt !== undefined) data.yearBuilt = input.yearBuilt;
  if (input.apartmentFloor !== undefined) {
    data.apartmentFloor = input.apartmentFloor;
  }
  if (input.hasWaterTank !== undefined) data.hasWaterTank = input.hasWaterTank;
  if (input.hasPowerPlant !== undefined) {
    data.hasPowerPlant = input.hasPowerPlant;
  }
  if (input.isFurnished !== undefined) data.isFurnished = input.isFurnished;
  if (input.allowsPets !== undefined) data.allowsPets = input.allowsPets;
  if (input.hasPool !== undefined) data.hasPool = input.hasPool;
  if (input.hasGym !== undefined) data.hasGym = input.hasGym;
  if (input.hasBalcony !== undefined) data.hasBalcony = input.hasBalcony;
  if (input.hasAirConditioning !== undefined) {
    data.hasAirConditioning = input.hasAirConditioning;
  }
  if (input.hasSecurity !== undefined) data.hasSecurity = input.hasSecurity;
  if (input.hasElevator !== undefined) data.hasElevator = input.hasElevator;
  if (input.videoUrl !== undefined) data.videoUrl = input.videoUrl;
  if (input.virtualTourUrl !== undefined) {
    data.virtualTourUrl = input.virtualTourUrl;
  }
  if (input.agentId !== undefined && input.agentId !== property.agentId) {
    data.agentId = input.agentId;
  }

  if (input.status !== undefined) {
    data.status = input.status;

    if (
      input.status === PropertyStatus.CLOSED &&
      property.status !== PropertyStatus.CLOSED
    ) {
      data.closedAt = new Date();
    } else if (
      input.status !== PropertyStatus.CLOSED &&
      property.status === PropertyStatus.CLOSED
    ) {
      data.closedAt = null;
    }
  }

  return data;
};

export const updateProperty = async (
  propertyId: number,
  input: UpdatePropertyInput,
  session: AuthSession,
  auditContext: AuditContext,
): Promise<PropertyResponse> => {
  return runSerializableTransaction(async (transaction) => {
    const current = await findPropertyById(propertyId, transaction);

    if (!current) {
      throw propertyNotFoundError();
    }

    assertPropertyAccess(current.agentId, session);

    if (
      session.role === Role.PARTNER &&
      current.status === PropertyStatus.CLOSED
    ) {
      throw closedPropertyError();
    }

    if (input.agentId !== undefined) {
      if (session.role !== Role.ADMIN) {
        throw agentAssignmentForbiddenError();
      }

      if (input.agentId !== current.agentId) {
        await assertAgentAvailableForAssignment(input.agentId, transaction);
      }
    }

    const updated = await updatePropertyRecord(
      propertyId,
      buildUpdateData(input, current),
      transaction,
    );

    const businessFields = Object.keys(input).filter(
      (field) => field !== "status" && field !== "agentId",
    );
    const statusChanged =
      input.status !== undefined && input.status !== current.status;
    const agentChanged =
      input.agentId !== undefined && input.agentId !== current.agentId;

    if (businessFields.length > 0) {
      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.BUSINESS,
        action: "PROPERTY_UPDATED",
        actor: auditContext.actor,
        entityType: "PROPERTY",
        entityId: propertyId,
        changes: { fields: businessFields },
        request: auditContext.request,
      });
    }

    if (statusChanged) {
      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.BUSINESS,
        action: "PROPERTY_STATUS_CHANGED",
        actor: auditContext.actor,
        entityType: "PROPERTY",
        entityId: propertyId,
        changes: {
          previousStatus: current.status,
          status: updated.status,
        },
        request: auditContext.request,
      });
    }

    if (agentChanged) {
      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.BUSINESS,
        action: "PROPERTY_REASSIGNED",
        actor: auditContext.actor,
        entityType: "PROPERTY",
        entityId: propertyId,
        changes: {
          previousAgentId: current.agentId,
          newAgentId: updated.agentId,
        },
        request: auditContext.request,
      });
    }

    const photos = await findPhotosByPropertyId(propertyId, transaction);
    return toPropertyResponse(updated, photos);
  });
};

export const deleteProperty = async (
  propertyId: number,
  session: AuthSession,
  auditContext: AuditContext,
): Promise<number> => {
  return prisma.$transaction(async (transaction) => {
    const current = await findPropertyById(propertyId, transaction);

    if (!current) {
      throw propertyNotFoundError();
    }

    assertPropertyAccess(current.agentId, session);

    await updatePropertyRecord(
      propertyId,
      { deletedAt: new Date() },
      transaction,
    );

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.BUSINESS,
      action: "PROPERTY_DELETED",
      actor: auditContext.actor,
      entityType: "PROPERTY",
      entityId: propertyId,
      changes: {
        code: current.code,
        agentId: current.agentId,
      },
      request: auditContext.request,
    });

    return propertyId;
  });
};
