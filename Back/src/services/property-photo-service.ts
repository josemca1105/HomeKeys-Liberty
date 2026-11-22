import { randomUUID } from "node:crypto";
import {
  AuditScope,
  PropertyStatus,
  Role,
  type Prisma,
  type Property,
} from "@prisma/client";
import { prisma } from "../config/database";
import {
  countPhotosByPropertyId,
  createPhotoRecord,
  deletePhotoRecord,
  findPhotoById,
  findPhotosByPropertyId,
  updatePhotoRecord,
  clearPhotoCovers,
} from "../repositories/photo-repository";
import { findPropertyById } from "../repositories/property-repository";
import { runSerializableTransaction } from "../repositories/serializable-transaction";
import type { AuditContext } from "../types/audit";
import type { AuthSession } from "../types/auth";
import type {
  ConfirmPropertyPhotoInput,
  CreatePhotoUploadTargetInput,
  PropertyPhotoContent,
  PropertyPhotoResponse,
  ReorderPropertyPhotosInput,
} from "../types/property";
import { AppError } from "../utils/app-error";
import { toPropertyPhotoResponse } from "../utils/property-response";
import { recordAuditEventInTransaction } from "./audit-service";
import { processPropertyImage } from "./image-processing-service";
import {
  getObjectStorage,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PROPERTY,
  MIN_PHOTOS_PER_PROPERTY,
  photoExtension,
  type UploadTarget,
} from "./object-storage-service";

const propertyNotFoundError = (): AppError =>
  new AppError({
    statusCode: 404,
    code: "PROPERTY_NOT_FOUND",
    message: "La captación que buscas no existe.",
  });

const photoNotFoundError = (): AppError =>
  new AppError({
    statusCode: 404,
    code: "PHOTO_NOT_FOUND",
    message: "La fotografía que buscas no existe.",
  });

const closedPropertyError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "PROPERTY_CLOSED",
    message:
      "La captación está cerrada. Solamente un administrador puede modificarla o reabrirla.",
  });

const photoLimitError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "PHOTO_LIMIT_REACHED",
    message: `La captación ya tiene el máximo de ${MAX_PHOTOS_PER_PROPERTY} fotografías.`,
  });

const minimumPhotosError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "MINIMUM_PHOTOS_REQUIRED",
    message: `La captación debe conservar al menos ${MIN_PHOTOS_PER_PROPERTY} fotografías.`,
  });

const invalidUploadKeyError = (): AppError =>
  new AppError({
    statusCode: 400,
    code: "INVALID_PHOTO_UPLOAD_KEY",
    message: "La clave de subida no corresponde a esta captación.",
  });

const photoUploadNotFoundError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "PHOTO_UPLOAD_NOT_FOUND",
    message: "La fotografía no fue subida o el enlace ya expiró.",
  });

const photoTooLargeError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "PHOTO_TOO_LARGE",
    message: `La fotografía no puede superar ${MAX_PHOTO_BYTES} bytes.`,
  });

const photoOrderMismatchError = (): AppError =>
  new AppError({
    statusCode: 400,
    code: "PHOTO_ORDER_MISMATCH",
    message: "Debes enviar exactamente todas las fotografías de la captación.",
  });

const assertPhotoReadAccess = (
  property: Property,
  session: AuthSession,
): void => {
  if (session.role !== Role.ADMIN && property.agentId !== session.userId) {
    throw propertyNotFoundError();
  }
};

const assertPhotoWriteAccess = (
  property: Property,
  session: AuthSession,
): void => {
  assertPhotoReadAccess(property, session);

  if (
    session.role === Role.PARTNER &&
    property.status === PropertyStatus.CLOSED
  ) {
    throw closedPropertyError();
  }
};

const findPropertyOrThrow = async (
  propertyId: number,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Property> => {
  const property = await findPropertyById(propertyId, client);

  if (!property) {
    throw propertyNotFoundError();
  }

  return property;
};

const deleteObjectBestEffort = async (key: string): Promise<void> => {
  try {
    await getObjectStorage().deleteObject(key);
  } catch (error) {
    console.error("Failed to clean up photo object.", error);
  }
};

const uploadPrefix = (propertyId: number): string =>
  `properties/${propertyId}/uploads/`;

export const createPhotoUploadTarget = async (
  propertyId: number,
  input: CreatePhotoUploadTargetInput,
  session: AuthSession,
): Promise<UploadTarget> => {
  const property = await findPropertyOrThrow(propertyId);
  assertPhotoWriteAccess(property, session);

  const photoCount = await countPhotosByPropertyId(propertyId);

  if (photoCount >= MAX_PHOTOS_PER_PROPERTY) {
    throw photoLimitError();
  }

  const key = `${uploadPrefix(propertyId)}${randomUUID()}.${photoExtension(input.mimeType)}`;

  return getObjectStorage().createUploadTarget({
    key,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    userId: session.userId,
    propertyId,
  });
};

export const confirmPropertyPhoto = async (
  propertyId: number,
  input: ConfirmPropertyPhotoInput,
  session: AuthSession,
  auditContext: AuditContext,
): Promise<PropertyPhotoResponse> => {
  if (!input.storageKey.startsWith(uploadPrefix(propertyId))) {
    throw invalidUploadKeyError();
  }

  const storage = getObjectStorage();
  const metadata = await storage.headObject(input.storageKey);

  if (!metadata || metadata.sizeBytes <= 0) {
    throw photoUploadNotFoundError();
  }

  if (metadata.sizeBytes > MAX_PHOTO_BYTES) {
    throw photoTooLargeError();
  }

  let finalKey: string | null = null;

  try {
    const downloaded = await storage.downloadObject(input.storageKey);

    if (downloaded.body.byteLength > MAX_PHOTO_BYTES) {
      throw photoTooLargeError();
    }

    const processed = await processPropertyImage(downloaded.body);

    if (processed.body.byteLength > MAX_PHOTO_BYTES) {
      throw photoTooLargeError();
    }

    const confirmedKey = `properties/${propertyId}/photos/${randomUUID()}.webp`;
    finalKey = confirmedKey;
    await storage.putObject(
      confirmedKey,
      processed.body,
      processed.mimeType,
    );

    const photo = await runSerializableTransaction(async (transaction) => {
      const property = await findPropertyOrThrow(propertyId, transaction);
      assertPhotoWriteAccess(property, session);

      const photos = await findPhotosByPropertyId(propertyId, transaction);

      if (photos.length >= MAX_PHOTOS_PER_PROPERTY) {
        throw photoLimitError();
      }

      const sortOrder =
        photos.length === 0
          ? 0
          : Math.max(...photos.map((item) => item.sortOrder)) + 1;

      const created = await createPhotoRecord(
        {
          propertyId,
          storageKey: confirmedKey,
          mimeType: processed.mimeType,
          sizeBytes: processed.body.byteLength,
          width: processed.width,
          height: processed.height,
          altText: input.altText ?? null,
          sortOrder,
          isCover: photos.length === 0,
        },
        transaction,
      );

      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.BUSINESS,
        action: "PROPERTY_PHOTO_ADDED",
        actor: auditContext.actor,
        entityType: "PROPERTY",
        entityId: propertyId,
        changes: {
          photoId: created.id,
          width: created.width,
          height: created.height,
        },
        request: auditContext.request,
      });

      return created;
    });

    return toPropertyPhotoResponse(photo);
  } catch (error) {
    if (finalKey !== null) {
      await deleteObjectBestEffort(finalKey);
    }

    throw error;
  } finally {
    await deleteObjectBestEffort(input.storageKey);
  }
};

export const reorderPropertyPhotos = async (
  propertyId: number,
  input: ReorderPropertyPhotosInput,
  session: AuthSession,
  auditContext: AuditContext,
): Promise<PropertyPhotoResponse[]> => {
  return runSerializableTransaction(async (transaction) => {
    const property = await findPropertyOrThrow(propertyId, transaction);
    assertPhotoWriteAccess(property, session);

    const photos = await findPhotosByPropertyId(propertyId, transaction);
    const existingIds = new Set(photos.map((photo) => photo.id));
    const requestedIds = new Set(input.photoIds);

    if (
      photos.length !== input.photoIds.length ||
      existingIds.size !== requestedIds.size ||
      [...existingIds].some((id) => !requestedIds.has(id))
    ) {
      throw photoOrderMismatchError();
    }

    const updated: PropertyPhotoResponse[] = [];

    for (const [index, photoId] of input.photoIds.entries()) {
      const photo = await updatePhotoRecord(
        photoId,
        { sortOrder: index, updatedAt: new Date() },
        transaction,
      );
      updated.push(toPropertyPhotoResponse(photo));
    }

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.BUSINESS,
      action: "PROPERTY_PHOTOS_REORDERED",
      actor: auditContext.actor,
      entityType: "PROPERTY",
      entityId: propertyId,
      changes: { photoIds: input.photoIds },
      request: auditContext.request,
    });

    return updated;
  });
};

export const setPropertyPhotoCover = async (
  propertyId: number,
  photoId: number,
  session: AuthSession,
  auditContext: AuditContext,
): Promise<PropertyPhotoResponse> => {
  return runSerializableTransaction(async (transaction) => {
    const property = await findPropertyOrThrow(propertyId, transaction);
    assertPhotoWriteAccess(property, session);

    const photo = await findPhotoById(propertyId, photoId, transaction);

    if (!photo) {
      throw photoNotFoundError();
    }

    if (photo.isCover) {
      return toPropertyPhotoResponse(photo);
    }

    await clearPhotoCovers(propertyId, transaction);
    const updated = await updatePhotoRecord(
      photoId,
      { isCover: true },
      transaction,
    );

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.BUSINESS,
      action: "PROPERTY_PHOTO_COVER_CHANGED",
      actor: auditContext.actor,
      entityType: "PROPERTY",
      entityId: propertyId,
      changes: { photoId },
      request: auditContext.request,
    });

    return toPropertyPhotoResponse(updated);
  });
};

export const deletePropertyPhoto = async (
  propertyId: number,
  photoId: number,
  session: AuthSession,
  auditContext: AuditContext,
): Promise<number> => {
  const storageKey = await runSerializableTransaction(
    async (transaction) => {
      const property = await findPropertyOrThrow(propertyId, transaction);
      assertPhotoWriteAccess(property, session);

      const photos = await findPhotosByPropertyId(propertyId, transaction);

      if (photos.length <= MIN_PHOTOS_PER_PROPERTY) {
        throw minimumPhotosError();
      }

      const photo = photos.find((item) => item.id === photoId);

      if (!photo) {
        throw photoNotFoundError();
      }

      await deletePhotoRecord(photoId, transaction);

      let promotedPhotoId: number | null = null;

      if (photo.isCover) {
        const nextCover = photos.find((item) => item.id !== photoId);

        if (nextCover) {
          await updatePhotoRecord(
            nextCover.id,
            { isCover: true },
            transaction,
          );
          promotedPhotoId = nextCover.id;
        }
      }

      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.BUSINESS,
        action: "PROPERTY_PHOTO_DELETED",
        actor: auditContext.actor,
        entityType: "PROPERTY",
        entityId: propertyId,
        changes: {
          photoId,
          promotedPhotoId,
        },
        request: auditContext.request,
      });

      return photo.storageKey;
    },
  );

  await deleteObjectBestEffort(storageKey);
  return photoId;
};

export const getPropertyPhotoContent = async (
  propertyId: number,
  photoId: number,
  session: AuthSession,
): Promise<PropertyPhotoContent> => {
  const property = await findPropertyOrThrow(propertyId);
  assertPhotoReadAccess(property, session);

  const photo = await findPhotoById(propertyId, photoId);

  if (!photo) {
    throw photoNotFoundError();
  }

  const object = await getObjectStorage().downloadObject(photo.storageKey);

  return {
    body: object.body,
    mimeType: photo.mimeType,
    sizeBytes: object.sizeBytes,
  };
};


