import { Router } from "express";
import { auditLogRoutes } from "./audit-log-routes";
import { authRoutes } from "./auth-routes";
import { propertyRoutes } from "./property-routes";
import { userRoutes } from "./user-routes";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/users", userRoutes);
apiRoutes.use("/properties", propertyRoutes);
apiRoutes.use("/audit-logs", auditLogRoutes);
