import type { AuditLog, AuditScope, Prisma, Role } from "@prisma/client";

export type AuditAction =
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "ACCOUNT_LOCKED"
  | "LOGOUT"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "PASSWORD_RESET_REQUESTED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "USER_PASSWORD_RESET"
  | "PASSWORD_RESET_LINK_SENT"
  | "INVITATION_RESENT"
  | "USER_DELETED"
  | "PROPERTY_CREATED"
  | "PROPERTY_UPDATED"
  | "PROPERTY_STATUS_CHANGED"
  | "PROPERTY_REASSIGNED"
  | "PROPERTY_DELETED"
  | "PROPERTY_PHOTOS_ATTACHED"
  | "PROPERTY_PHOTO_ADDED"
  | "PROPERTY_PHOTO_DELETED"
  | "PROPERTY_PHOTOS_REORDERED"
  | "PROPERTY_PHOTO_COVER_CHANGED";

export interface AuditActor {
  id?: number;
  role?: Role;
  email?: string | null;
}

export interface AuditRequestContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditEventInput {
  scope: AuditScope;
  action: AuditAction;
  actor?: AuditActor;
  entityType?: string;
  entityId?: number;
  changes?: Prisma.InputJsonValue;
  request: AuditRequestContext;
}

// Actor and request data captured by the controller and handed to a service so
// the audit row can be written inside the same database transaction as the
// mutation it describes.
export interface AuditContext {
  actor?: AuditActor;
  request: AuditRequestContext;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  scope?: AuditScope;
  action?: string;
  actorId?: number;
  entityType?: string;
  entityId?: number;
  from?: Date;
  to?: Date;
}

export interface AuditLogPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type AuditLogItem = AuditLog;

export interface PaginatedAuditLogsResult {
  logs: AuditLogItem[];
  pagination: AuditLogPagination;
}
