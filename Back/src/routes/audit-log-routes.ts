import { Router } from "express";
import { getAuditLogs } from "../controllers/audit-log-controller";
import { authenticate } from "../middleware/authenticate";
import { enforcePasswordChange } from "../middleware/enforce-password-change";
import { validateQuery } from "../middleware/validate-query";
import { auditLogQuerySchema } from "../validators/audit-validators";

export const auditLogRoutes = Router();

auditLogRoutes.get(
  "/",
  authenticate,
  enforcePasswordChange,
  validateQuery(auditLogQuerySchema),
  getAuditLogs,
);
