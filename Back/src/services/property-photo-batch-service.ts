import { randomUUID } from "node:crypto";
import {
  PropertyPhotoBatchStatus,
  PropertyPhotoUploadStatus,
  type Photo,
  type Prisma,
  type PropertyPhotoBatch,
  type PropertyPhotoUpload,
} from "@prisma/client";
import {
  createPhotoUploadRecord,
  createPhotoBatchRecord,
  deletePhotoBatchRecord,
  findExpiredPhotoBatches,
  findPhotoBatchById,
  findPhotoUploadById,
  findPhotoUploadsByBatchId,
  markPhotoBatchConsumed,
  type PhotoBatchWithUploads,
} from "../repositories/photo-batch-repository";
import { createPhotoRecord } from "../repositories/photo-repository";
import { runSerializableTransaction } from "../repositories/serializable-transaction";
import type { AuthSession } from "../types/auth";
import type {
  CreatePhotoUploadTargetInput,
  PropertyPhotoBatchResponse,
  PropertyPhotoUploadResponse,
  PropertyPhotoContent,
} from "../types/property";
import { AppError } from "../utils/app-error";
import { processPropertyImage } from "./image-processing-service";
import {
  getObjectStorage,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PROPERTY,
  MIN_PHOTOS_PER_PROPERTY,
  PHOTO_BATCH_TTL_MINUTES,
  photoExtension,
  type UploadTarget,
} from "./object-storage-service";

const batchNotFoundError = (): AppError =>
  new AppError({
    statusCode: 404,
    code: "PHOTO_BATCH_NOT_FOUND",
    message: "El lote de fotografías no existe.",
  });

const batchExpiredError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "PHOTO_BATCH_EXPIRED",
    message: "El lote de fotografías expiró. Crea uno nuevo.",
  });

const batchClosedError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "PHOTO_BATCH_NOT_OPEN",
    message: "El lote de fotografías ya fue utilizado o no admite cambios.",
  });

const uploadNotFoundError = (): AppError =>
  new AppError({
    statusCode: 404,
    code: "PHOTO_UPLOAD_NOT_FOUND",
    message: "La fotografía temporal no existe.",
  });

const invalidUploadKeyError = (): AppError =>
  new AppError({
    statusCode: 400,
    code: "INVALID_PHOTO_UPLOAD_KEY",
    message: "La clave de subida no corresponde a este lote.",
  });

const photoLimitError = (): AppError =>
  new AppError({
    statusCode: 409,
    code: "PHOTO_LIMIT_REACHED",
    message: `El lote ya tiene el máximo de ${MAX_PHOTOS_PER_PROPERTY} fotografías.`,
  });

const minimumPhotosError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "MINIMUM_PHOTOS_REQUIRED",
    message: `La captación debe tener al menos ${MIN_PHOTOS_PER_PROPERTY} fotografías listas.`,
  });

const photoTooLargeError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "PHOTO_TOO_LARGE",
    message: `La fotografía no puede superar ${MAX_PHOTO_BYTES} bytes.`,
  });

const photoUploadMissingError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "PHOTO_UPLOAD_NOT_FOUND",
    message: "La fotografía no fue subida o el enlace ya expiró.",
  });

const invalidCoverError = (): AppError =>
  new AppError({
    statusCode: 422,
    code: "INVALID_COVER_PHOTO",
    message: "La portada seleccionada no pertenece al lote de fotografías.",
  });

const toUploadResponse = (
  batchId: string,
  upload: PropertyPhotoUpload,
): PropertyPhotoUploadResponse => ({
  id: upload.id,
  previewUrl: `/api/v1/property-photo-batches/${batchId}/photos/${upload.id}/content`,
  mimeType: upload.mimeType,
  sizeBytes: upload.sizeBytes,
  width: upload.width,
  height: upload.height,
  altText: upload.altText,
  sortOrder: upload.sortOrder,
  status: upload.status,
  createdAt: upload.createdAt,
});

const toBatchResponse = (
  batch: PhotoBatchWithUploads,
): PropertyPhotoBatchResponse => ({
  id: batch.id,
  status: batch.status,
  expiresAt: batch.expiresAt,
  createdAt: batch.createdAt,
  updatedAt: batch.updatedAt,
  uploads: batch.uploads
    .filter((upload) => upload.status === PropertyPhotoUploadStatus.READY)
    .map((upload) => toUploadResponse(batch.id, upload)),
});

const assertBatchOwner = (
  batch: PropertyPhotoBatch,
  session: AuthSession,
): void => {
  if (batch.userId !== session.userId) {
    throw batchNotFoundError();
  }
};

const assertBatchOpen = (batch: PropertyPhotoBatch): void => {
  if (batch.expiresAt.getTime() <= Date.now()) {
    throw batchExpiredError();
  }

  if (batch.status !== PropertyPhotoBatchStatus.OPEN) {
    throw batchClosedError();
  }
};

const loadBatch = async (
  batchId: string,
  session: AuthSession,
  includeUploads = true,
): Promise<PropertyPhotoBatch | PhotoBatchWithUploads> => {
  const batch = await findPhotoBatchById(batchId, includeUploads);

  if (!batch) {
    throw batchNotFoundError();
  }

  assertBatchOwner(batch, session);
  assertBatchOpen(batch);
  return batch;
};

const uploadPrefix = (batchId: string): string =>
  `property-photo-batches/${batchId}/uploads/`;

export const createPropertyPhotoBatch = async (
  session: AuthSession,
): Promise<PropertyPhotoBatchResponse> => {
  const expiresAt = new Date(
    Date.now() + PHOTO_BATCH_TTL_MINUTES * 60 * 1000,
  );
  const batch = await createPhotoBatchRecord(session.userId, expiresAt);
  const withUploads = await findPhotoBatchById(batch.id, true);

  if (!withUploads) {
    throw batchNotFoundError();
  }

  return toBatchResponse(withUploads as PhotoBatchWithUploads);
};

export const getPropertyPhotoBatch = async (
  batchId: string,
  session: AuthSession,
): Promise<PropertyPhotoBatchResponse> => {
  const batch = await loadBatch(batchId, session);
  return toBatchResponse(batch as PhotoBatchWithUploads);
};

export const createBatchPhotoUploadTarget = async (
  batchId: string,
  input: CreatePhotoUploadTargetInput,
  session: AuthSession,
): Promise<UploadTarget> => {
  const batch = await loadBatch(batchId, session);
  const uploads = await findPhotoUploadsByBatchId(batchId);

  if (uploads.length >= MAX_PHOTOS_PER_PROPERTY) {
    throw photoLimitError();
  }

  assertBatchOwner(batch, session);
  const key = `${uploadPrefix(batchId)}${randomUUID()}.${photoExtension(input.mimeType)}`;

  return getObjectStorage().createUploadTarget({
    key,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    userId: session.userId,
    propertyId: 0,
  });
};

const deleteObjectBestEffort = async (key: string): Promise<void> => {
  try {
    await getObjectStorage().deleteObject(key);
  } catch (error) {
    console.error("Failed to clean up batch photo object.", error);
  }
};

export const confirmBatchPhotoUpload = async (
  batchId: string,
  input: { storageKey: string; altText?: string | null },
  session: AuthSession,
): Promise<PropertyPhotoUploadResponse> => {
  if (!input.storageKey.startsWith(uploadPrefix(batchId))) {
    throw invalidUploadKeyError();
  }

  await loadBatch(batchId, session);

  const storage = getObjectStorage();
  const metadata = await storage.headObject(input.storageKey);

  if (!metadata || metadata.sizeBytes <= 0) {
    throw photoUploadMissingError();
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

    const readyKey = `property-photo-batches/${batchId}/photos/${randomUUID()}.webp`;
    finalKey = readyKey;
    await storage.putObject(readyKey, processed.body, processed.mimeType);

    const upload = await runSerializableTransaction(async (transaction) => {
      const batch = await findPhotoBatchById(batchId, false, transaction);

      if (!batch) {
        throw batchNotFoundError();
      }

      assertBatchOwner(batch, session);
      assertBatchOpen(batch);

      const uploads = await findPhotoUploadsByBatchId(batchId, transaction);

      if (uploads.length >= MAX_PHOTOS_PER_PROPERTY) {
        throw photoLimitError();
      }

      const sortOrder =
        uploads.length === 0
          ? 0
          : Math.max(...uploads.map((item) => item.sortOrder)) + 1;

      return createPhotoUploadRecord(
        {
          batchId,
          storageKey: readyKey,
          mimeType: processed.mimeType,
          sizeBytes: processed.body.byteLength,
          width: processed.width,
          height: processed.height,
          altText: input.altText ?? null,
          sortOrder,
        },
        transaction,
      );
    });

    return toUploadResponse(batchId, upload);
  } catch (error) {
    if (finalKey !== null) {
      await deleteObjectBestEffort(finalKey);
    }

    throw error;
  } finally {
    await deleteObjectBestEffort(input.storageKey);
  }
};

export const deleteBatchPhotoUpload = async (
  batchId: string,
  uploadId: string,
  session: AuthSession,
): Promise<string> => {
  const storageKey = await runSerializableTransaction(
    async (transaction) => {
      const batch = await findPhotoBatchById(batchId, false, transaction);

      if (!batch) {
        throw batchNotFoundError();
      }

      assertBatchOwner(batch, session);
      assertBatchOpen(batch);

      const upload = await findPhotoUploadById(
        batchId,
        uploadId,
        transaction,
      );

      if (!upload) {
        throw uploadNotFoundError();
      }

      await transaction.propertyPhotoUpload.delete({
        where: { id: uploadId },
      });

      const remaining = await findPhotoUploadsByBatchId(
        batchId,
        transaction,
      );

      for (const [index, item] of remaining.entries()) {
        await transaction.propertyPhotoUpload.update({
          where: { id: item.id },
          data: { sortOrder: index },
        });
      }

      return upload.storageKey;
    },
  );

  await deleteObjectBestEffort(storageKey);
  return uploadId;
};

export const getBatchPhotoContent = async (
  batchId: string,
  uploadId: string,
  session: AuthSession,
): Promise<PropertyPhotoContent> => {
  await loadBatch(batchId, session);

  const upload = await findPhotoUploadById(batchId, uploadId);

  if (!upload || upload.status !== PropertyPhotoUploadStatus.READY) {
    throw uploadNotFoundError();
  }

  const object = await getObjectStorage().downloadObject(upload.storageKey);

  return {
    body: object.body,
    mimeType: upload.mimeType,
    sizeBytes: object.sizeBytes,
  };
};

export const assertPhotoBatchReadyForCreation = async (
  batchId: string,
  session: AuthSession,
  coverUploadId: string | undefined,
  transaction: Prisma.TransactionClient,
): Promise<void> => {
  const batch = (await findPhotoBatchById(
    batchId,
    true,
    transaction,
  )) as PhotoBatchWithUploads | null;

  if (!batch) {
    throw batchNotFoundError();
  }

  assertBatchOwner(batch, session);
  assertBatchOpen(batch);

  const readyUploads = batch.uploads.filter(
    (upload) => upload.status === PropertyPhotoUploadStatus.READY,
  );

  if (readyUploads.length < MIN_PHOTOS_PER_PROPERTY) {
    throw minimumPhotosError();
  }

  if (readyUploads.length > MAX_PHOTOS_PER_PROPERTY) {
    throw photoLimitError();
  }

  const coverUpload = coverUploadId
    ? readyUploads.find((upload) => upload.id === coverUploadId)
    : readyUploads[0];

  if (!coverUpload) {
    throw invalidCoverError();
  }
};

export const attachPhotoBatchToProperty = async (
  batchId: string,
  session: AuthSession,
  propertyId: number,
  coverUploadId: string | undefined,
  transaction: Prisma.TransactionClient,
): Promise<Photo[]> => {
  const batch = (await findPhotoBatchById(
    batchId,
    true,
    transaction,
  )) as PhotoBatchWithUploads | null;

  if (!batch) {
    throw batchNotFoundError();
  }

  assertBatchOwner(batch, session);
  assertBatchOpen(batch);

  const readyUploads = batch.uploads.filter(
    (upload) => upload.status === PropertyPhotoUploadStatus.READY,
  );

  if (readyUploads.length < MIN_PHOTOS_PER_PROPERTY) {
    throw minimumPhotosError();
  }

  if (readyUploads.length > MAX_PHOTOS_PER_PROPERTY) {
    throw photoLimitError();
  }

  const coverUpload = coverUploadId
    ? readyUploads.find((upload) => upload.id === coverUploadId)
    : readyUploads[0];

  if (!coverUpload) {
    throw invalidCoverError();
  }

  const photos: Photo[] = [];

  for (const [index, upload] of readyUploads.entries()) {
    const photo = await createPhotoRecord(
      {
        propertyId,
        storageKey: upload.storageKey,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        width: upload.width,
        height: upload.height,
        altText: upload.altText,
        sortOrder: index,
        isCover: upload.id === coverUpload.id,
      },
      transaction,
    );
    photos.push(photo);
  }

  await markPhotoBatchConsumed(
    batchId,
    readyUploads.map((upload) => upload.id),
    transaction,
  );

  return photos;
};

export const cleanupExpiredPhotoBatches = async (
  now = new Date(),
): Promise<number> => {
  const batches = await findExpiredPhotoBatches(now);

  for (const batch of batches) {
    for (const upload of batch.uploads) {
      await deleteObjectBestEffort(upload.storageKey);
    }

    await deletePhotoBatchRecord(batch.id);
  }

  return batches.length;
};
