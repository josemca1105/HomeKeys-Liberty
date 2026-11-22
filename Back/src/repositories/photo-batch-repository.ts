import {
  PropertyPhotoBatchStatus,
  type Prisma,
  type PropertyPhotoBatch,
  type PropertyPhotoUpload,
} from "@prisma/client";
import { prisma } from "../config/database";

type PhotoBatchClient = Prisma.TransactionClient | typeof prisma;

export type PhotoBatchWithUploads = Prisma.PropertyPhotoBatchGetPayload<{
  include: {
    uploads: true;
  };
}>;

export const createPhotoBatchRecord = async (
  userId: number,
  expiresAt: Date,
  client: PhotoBatchClient = prisma,
): Promise<PropertyPhotoBatch> => {
  return client.propertyPhotoBatch.create({
    data: {
      userId,
      expiresAt,
    },
  });
};

export const findPhotoBatchById = async (
  batchId: string,
  includeUploads = false,
  client: PhotoBatchClient = prisma,
): Promise<PropertyPhotoBatch | PhotoBatchWithUploads | null> => {
  if (includeUploads) {
    return client.propertyPhotoBatch.findUnique({
      where: { id: batchId },
      include: {
        uploads: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  }

  return client.propertyPhotoBatch.findUnique({
    where: { id: batchId },
  });
};

export const createPhotoUploadRecord = async (
  data: Prisma.PropertyPhotoUploadUncheckedCreateInput,
  client: PhotoBatchClient = prisma,
): Promise<PropertyPhotoUpload> => {
  return client.propertyPhotoUpload.create({ data });
};

export const findPhotoUploadById = async (
  batchId: string,
  uploadId: string,
  client: PhotoBatchClient = prisma,
): Promise<PropertyPhotoUpload | null> => {
  return client.propertyPhotoUpload.findFirst({
    where: {
      id: uploadId,
      batchId,
    },
  });
};

export const findPhotoUploadsByBatchId = async (
  batchId: string,
  client: PhotoBatchClient = prisma,
): Promise<PropertyPhotoUpload[]> => {
  return client.propertyPhotoUpload.findMany({
    where: { batchId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
};

export const updatePhotoUploadRecord = async (
  uploadId: string,
  data: Prisma.PropertyPhotoUploadUncheckedUpdateInput,
  client: PhotoBatchClient = prisma,
): Promise<PropertyPhotoUpload> => {
  return client.propertyPhotoUpload.update({
    where: { id: uploadId },
    data,
  });
};

export const deletePhotoUploadRecord = async (
  uploadId: string,
  client: PhotoBatchClient = prisma,
): Promise<PropertyPhotoUpload> => {
  return client.propertyPhotoUpload.delete({
    where: { id: uploadId },
  });
};

export const markPhotoBatchConsumed = async (
  batchId: string,
  uploadIds: string[],
  client: PhotoBatchClient = prisma,
): Promise<void> => {
  const consumedAt = new Date();

  await client.propertyPhotoUpload.updateMany({
    where: {
      batchId,
      id: { in: uploadIds },
      status: "READY",
    },
    data: {
      status: "CONSUMED",
      consumedAt,
    },
  });

  await client.propertyPhotoBatch.update({
    where: { id: batchId },
    data: {
      status: PropertyPhotoBatchStatus.CONSUMED,
    },
  });
};

export const findExpiredPhotoBatches = async (
  expiredBefore: Date,
  client: PhotoBatchClient = prisma,
): Promise<PhotoBatchWithUploads[]> => {
  return client.propertyPhotoBatch.findMany({
    where: {
      status: PropertyPhotoBatchStatus.OPEN,
      expiresAt: { lte: expiredBefore },
    },
    include: {
      uploads: true,
    },
  });
};

export const deletePhotoBatchRecord = async (
  batchId: string,
  client: PhotoBatchClient = prisma,
): Promise<void> => {
  await client.propertyPhotoBatch.delete({
    where: { id: batchId },
  });
};
