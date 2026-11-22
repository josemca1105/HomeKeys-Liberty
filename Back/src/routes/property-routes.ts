import { Router } from "express";
import {
  addProperty,
  getProperties,
  getPropertyById,
  removeProperty,
  updatePropertyById,
} from "../controllers/property-controller";
import {
  chooseCoverPhoto,
  confirmUpload,
  createUploadUrl,
  getPhotoContent,
  removePhoto,
  reorderPhotos,
} from "../controllers/property-photo-controller";
import { authenticate } from "../middleware/authenticate";
import { enforcePasswordChange } from "../middleware/enforce-password-change";
import { isAdmin } from "../middleware/is-admin";
import { validateParams } from "../middleware/validate-params";
import { validateQuery } from "../middleware/validate-query";
import { validateRequest } from "../middleware/validate-request";
import {
  confirmPropertyPhotoSchema,
  createPropertySchema,
  listPropertiesQuerySchema,
  photoUploadTargetSchema,
  propertyIdParamsSchema,
  propertyPhotoParamsSchema,
  reorderPropertyPhotosSchema,
  updatePropertySchema,
} from "../validators/property-validators";

export const propertyRoutes = Router();

propertyRoutes.post(
  "/",
  authenticate,
  enforcePasswordChange,
  validateRequest(createPropertySchema),
  addProperty,
);

propertyRoutes.post(
  "/:id/photos/upload-url",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyIdParamsSchema),
  validateRequest(photoUploadTargetSchema),
  createUploadUrl,
);

propertyRoutes.post(
  "/:id/photos/confirm",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyIdParamsSchema),
  validateRequest(confirmPropertyPhotoSchema),
  confirmUpload,
);

propertyRoutes.patch(
  "/:id/photos/order",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyIdParamsSchema),
  validateRequest(reorderPropertyPhotosSchema),
  reorderPhotos,
);

propertyRoutes.get(
  "/:id/photos/:photoId/content",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyPhotoParamsSchema),
  getPhotoContent,
);

propertyRoutes.patch(
  "/:id/photos/:photoId/cover",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyPhotoParamsSchema),
  chooseCoverPhoto,
);

propertyRoutes.delete(
  "/:id/photos/:photoId",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyPhotoParamsSchema),
  removePhoto,
);

propertyRoutes.get(
  "/",
  authenticate,
  enforcePasswordChange,
  validateQuery(listPropertiesQuerySchema),
  getProperties,
);

propertyRoutes.get(
  "/:id",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyIdParamsSchema),
  getPropertyById,
);

propertyRoutes.patch(
  "/:id",
  authenticate,
  enforcePasswordChange,
  validateParams(propertyIdParamsSchema),
  validateRequest(updatePropertySchema),
  updatePropertyById,
);

propertyRoutes.delete(
  "/:id",
  authenticate,
  enforcePasswordChange,
  isAdmin,
  validateParams(propertyIdParamsSchema),
  removeProperty,
);
