import type { Prisma, Property } from "@prisma/client";
import { prisma } from "../config/database";

type PropertyRepositoryClient = Prisma.TransactionClient | typeof prisma;

export const findPropertyById = async (
  propertyId: number,
  client: PropertyRepositoryClient = prisma,
): Promise<Property | null> => {
  return client.property.findFirst({
    where: { id: propertyId, deletedAt: null },
  });
};

export interface FindPropertiesPageOptions {
  where: Prisma.PropertyWhereInput;
  orderBy: Prisma.PropertyOrderByWithRelationInput[];
  skip: number;
  take: number;
}

export const findPropertiesPage = async ({
  where,
  orderBy,
  skip,
  take,
}: FindPropertiesPageOptions): Promise<Property[]> => {
  return prisma.property.findMany({
    where,
    orderBy,
    skip,
    take,
  });
};

export const countProperties = async (
  where: Prisma.PropertyWhereInput,
): Promise<number> => {
  return prisma.property.count({ where });
};

export const createPropertyRecord = async (
  data: Prisma.PropertyUncheckedCreateInput,
  client: PropertyRepositoryClient = prisma,
): Promise<Property> => {
  return client.property.create({ data });
};

export const updatePropertyRecord = async (
  propertyId: number,
  data: Prisma.PropertyUncheckedUpdateInput,
  client: PropertyRepositoryClient = prisma,
): Promise<Property> => {
  return client.property.update({
    where: { id: propertyId },
    data,
  });
};

export const countOpenPropertiesByAgentId = async (
  agentId: number,
  client: PropertyRepositoryClient = prisma,
): Promise<number> => {
  return client.property.count({
    where: {
      agentId,
      deletedAt: null,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
  });
};
