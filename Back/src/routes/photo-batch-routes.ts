import { Router } from "express";
import {
  confirmBatchUpload,
  createBatchUploadUrl,
  createPhotoBatch,
  getBatchUploadContent,
  getPhotoBatch,
  removeBatchUpload,
} from "../controllers/property-photo-batch-controller";
import { authenticate } from "../middleware/authenticate";
import { enforcePasswordChange } from "../middleware/enforce-password-change";
import { validateParams } from "../middleware/validate-params";
import { validateRequest } from "../middleware/validate-request";
import {
  confirmPhotoBatchUploadSchema,
  photoBatchParamsSchema,
  photoBatchUploadParamsSchema,
  photoUploadTargetSchema,
} from "../validators/property-validators";

export const photoBatchRoutes = Router();

photoBatchRoutes.post(
  "/",
  authenticate,
  enforcePasswordChange,
  createPhotoBatch,
);

photoBatchRoutes.get(
  "/:batchId",
  authenticate,
  enforcePasswordChange,
  validateParams(photoBatchParamsSchema),
  getPhotoBatch,
);

photoBatchRoutes.post(
  "/:batchId/photos/upload-url",
  authenticate,
  enforcePasswordChange,
  validateParams(photoBatchParamsSchema),
  validateRequest(photoUploadTargetSchema),
  createBatchUploadUrl,
);

photoBatchRoutes.post(
  "/:batchId/photos/confirm",
  authenticate,
  enforcePasswordChange,
  validateParams(photoBatchParamsSchema),
  validateRequest(confirmPhotoBatchUploadSchema),
  confirmBatchUpload,
);

photoBatchRoutes.get(
  "/:batchId/photos/:uploadId/content",
  authenticate,
  enforcePasswordChange,
  validateParams(photoBatchUploadParamsSchema),
  getBatchUploadContent,
);

photoBatchRoutes.delete(
  "/:batchId/photos/:uploadId",
  authenticate,
  enforcePasswordChange,
  validateParams(photoBatchUploadParamsSchema),
  removeBatchUpload,
);

export type PhotoBatchRoutes = typeof photoBatchRoutes;
