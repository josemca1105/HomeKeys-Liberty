import {
  confirmBatchPhotoUpload,
  createBatchPhotoUploadTarget,
  createPropertyPhotoBatch,
  deleteBatchPhotoUpload,
  getBatchPhotoContent,
  getPropertyPhotoBatch,
} from "../services/property-photo-batch-service";
import type { CreatePhotoUploadTargetInput } from "../types/property";
import type {
  PhotoBatchParams,
  PhotoBatchUploadParams,
} from "../validators/property-validators";
import { asyncHandler } from "../utils/async-handler";
import { requireSession } from "../utils/require-session";

export const createPhotoBatch = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const batch = await createPropertyPhotoBatch(session);

    res.status(201).json({
      success: true,
      message: "Lote de fotografías creado exitosamente.",
      data: { batch },
    });
  },
);

export const getPhotoBatch = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const batchId = (req.validatedParams as PhotoBatchParams).batchId;
    const batch = await getPropertyPhotoBatch(batchId, session);

    res.status(200).json({
      success: true,
      message: "Lote de fotografías obtenido exitosamente.",
      data: { batch },
    });
  },
);

export const createBatchUploadUrl = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const batchId = (req.validatedParams as PhotoBatchParams).batchId;
    const input = req.body as CreatePhotoUploadTargetInput;
    const upload = await createBatchPhotoUploadTarget(
      batchId,
      input,
      session,
    );

    res.status(200).json({
      success: true,
      message: "Enlace de subida creado exitosamente.",
      data: {
        upload: {
          url: upload.url,
          method: upload.method,
          headers: upload.headers,
          expiresAt: upload.expiresAt,
          storageKey: upload.key,
        },
      },
    });
  },
);

export const confirmBatchUpload = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const batchId = (req.validatedParams as PhotoBatchParams).batchId;
    const input = req.body as {
      storageKey: string;
      altText?: string | null;
    };
    const upload = await confirmBatchPhotoUpload(batchId, input, session);

    res.status(201).json({
      success: true,
      message: "Fotografía agregada al lote exitosamente.",
      data: { upload },
    });
  },
);

export const removeBatchUpload = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const params = req.validatedParams as PhotoBatchUploadParams;
    const deletedId = await deleteBatchPhotoUpload(
      params.batchId,
      params.uploadId,
      session,
    );

    res.status(200).json({
      success: true,
      message: "Fotografía eliminada del lote exitosamente.",
      data: { deletedId },
    });
  },
);

export const getBatchUploadContent = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const params = req.validatedParams as PhotoBatchUploadParams;
    const content = await getBatchPhotoContent(
      params.batchId,
      params.uploadId,
      session,
    );

    res.setHeader("Content-Type", content.mimeType);
    res.setHeader("Content-Length", content.sizeBytes.toString());
    res.setHeader("Content-Disposition", "inline");
    res.status(200).send(content.body);
  },
);
