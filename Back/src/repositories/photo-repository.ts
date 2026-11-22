import type { Photo, Prisma } from "@prisma/client";
import { prisma } from "../config/database";

type PhotoRepositoryClient = Prisma.TransactionClient | typeof prisma;

export const findPhotosByPropertyId = async (
  propertyId: number,
  client: PhotoRepositoryClient = prisma,
): Promise<Photo[]> => {
  return client.photo.findMany({
    where: { propertyId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
};

export const findPhotosByPropertyIds = async (
  propertyIds: number[],
  client: PhotoRepositoryClient = prisma,
): Promise<Photo[]> => {
  if (propertyIds.length === 0) {
    return [];
  }

  return client.photo.findMany({
    where: { propertyId: { in: propertyIds } },
    orderBy: [
      { propertyId: "asc" },
      { sortOrder: "asc" },
      { id: "asc" },
    ],
  });
};

export const findPhotoById = async (
  propertyId: number,
  photoId: number,
  client: PhotoRepositoryClient = prisma,
): Promise<Photo | null> => {
  return client.photo.findFirst({
    where: { id: photoId, propertyId },
  });
};

export const countPhotosByPropertyId = async (
  propertyId: number,
  client: PhotoRepositoryClient = prisma,
): Promise<number> => {
  return client.photo.count({ where: { propertyId } });
};

export const createPhotoRecord = async (
  data: Prisma.PhotoUncheckedCreateInput,
  client: PhotoRepositoryClient = prisma,
): Promise<Photo> => {
  return client.photo.create({ data });
};

export const updatePhotoRecord = async (
  photoId: number,
  data: Prisma.PhotoUncheckedUpdateInput,
  client: PhotoRepositoryClient = prisma,
): Promise<Photo> => {
  return client.photo.update({
    where: { id: photoId },
    data,
  });
};

export const deletePhotoRecord = async (
  photoId: number,
  client: PhotoRepositoryClient = prisma,
): Promise<Photo> => {
  return client.photo.delete({
    where: { id: photoId },
  });
};

export const clearPhotoCovers = async (
  propertyId: number,
  client: PhotoRepositoryClient = prisma,
): Promise<void> => {
  await client.photo.updateMany({
    where: { propertyId, isCover: true },
    data: { isCover: false },
  });
};
