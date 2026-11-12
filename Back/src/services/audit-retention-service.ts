import { environment } from "../config/env";
import { cleanupExpiredAuditLogs } from "./audit-service";

export const cleanupAuditLogsByRetention = async (
  now = new Date(),
): Promise<number> => {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - environment.AUDIT_RETENTION_MONTHS);

  return cleanupExpiredAuditLogs(cutoff);
};
