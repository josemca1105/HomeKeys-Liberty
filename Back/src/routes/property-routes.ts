import { Router } from "express";
import {
  addProperty,
  getPropertyById,
  removeProperty,
  updatePropertyById,
} from "../controllers/property-controller";
import { authenticate } from "../middleware/authenticate";
import { enforcePasswordChange } from "../middleware/enforce-password-change";
import { isAdmin } from "../middleware/is-admin";
import { validateParams } from "../middleware/validate-params";
import { validateRequest } from "../middleware/validate-request";
import {
  createPropertySchema,
  propertyIdParamsSchema,
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
