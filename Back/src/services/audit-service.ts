import type { Prisma } from "@prisma/client";
import {
  countAuditLogs,
  createAuditLog,
  deleteAuditLogsBefore,
  findAuditLogsPage,
} from "../repositories/audit-log-repository";
import type {
  AuditEventInput,
  AuditLogQuery,
  PaginatedAuditLogsResult,
} from "../types/audit";

export const recordAuditEvent = async (
  event: AuditEventInput,
): Promise<void> => {
  try {
    await createAuditLog({
      scope: event.scope,
      actorId: event.actor?.id ?? null,
      actorRole: event.actor?.role ?? null,
      actorEmail: event.actor?.email?.slice(0, 255) ?? null,
      action: event.action.slice(0, 80),
      entityType: event.entityType?.slice(0, 40) ?? null,
      entityId: event.entityId ?? null,
      changes: event.changes,
      ip: event.request.ip?.slice(0, 45) ?? null,
      userAgent: event.request.userAgent?.slice(0, 512) ?? null,
      requestId: event.request.requestId?.slice(0, 64) ?? null,
    });
  } catch (error) {
    // Auditing must never break the operation it describes. Failures are
    // visible in the server log and can be alerted on separately.
    console.error("Failed to write audit log.", error);
  }
};

const buildAuditLogWhere = (
  query: AuditLogQuery,
): Prisma.AuditLogWhereInput => {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.scope !== undefined) {
    where.scope = query.scope;
  }

  if (query.action !== undefined) {
    where.action = query.action;
  }

  if (query.actorId !== undefined) {
    where.actorId = query.actorId;
  }

  if (query.entityType !== undefined) {
    where.entityType = query.entityType;
  }

  if (query.entityId !== undefined) {
    where.entityId = query.entityId;
  }

  if (query.from !== undefined || query.to !== undefined) {
    where.createdAt = {
      ...(query.from !== undefined ? { gte: query.from } : {}),
      ...(query.to !== undefined ? { lte: query.to } : {}),
    };
  }

  return where;
};

export const listAuditLogs = async (
  query: AuditLogQuery,
): Promise<PaginatedAuditLogsResult> => {
  const where = buildAuditLogWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const [logs, total] = await Promise.all([
    findAuditLogsPage({ where, skip, take: query.pageSize }),
    countAuditLogs(where),
  ]);

  return {
    logs,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
};

export const cleanupExpiredAuditLogs = async (
  cutoff: Date,
): Promise<number> => {
  return deleteAuditLogsBefore(cutoff);
};
