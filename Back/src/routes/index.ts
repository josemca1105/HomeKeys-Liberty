import { Router } from "express";
import { auditLogRoutes } from "./audit-log-routes";
import { authRoutes } from "./auth-routes";
import { photoBatchRoutes } from "./photo-batch-routes";
import { propertyPhotoUploadRoutes } from "./property-photo-upload-routes";
import { propertyRoutes } from "./property-routes";
import { userRoutes } from "./user-routes";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/users", userRoutes);
apiRoutes.use("/property-photos", propertyPhotoUploadRoutes);
apiRoutes.use("/property-photo-batches", photoBatchRoutes);
apiRoutes.use("/properties", propertyRoutes);
apiRoutes.use("/audit-logs", auditLogRoutes);
