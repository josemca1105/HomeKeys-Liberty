import type { AuditLog, AuditScope, Prisma, Role } from "@prisma/client";

export type AuditAction =
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "PASSWORD_RESET_REQUESTED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_PASSWORD_RESET"
  | "USER_DELETED";

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
