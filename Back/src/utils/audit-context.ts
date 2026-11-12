import type { Request } from "express";
import type { AuditActor, AuditRequestContext } from "../types/audit";
import type { AuthSession } from "../types/auth";

export const getAuditRequestContext = (
  req: Request,
): AuditRequestContext => {
  return {
    ip: req.ip,
    userAgent: req.get("user-agent"),
    requestId: req.requestId,
  };
};

export const getAuditActor = (
  session: AuthSession | undefined,
  email?: string | null,
): AuditActor | undefined => {
  if (!session) {
    return undefined;
  }

  return {
    id: session.userId,
    role: session.role,
    email: email ?? undefined,
  };
};
