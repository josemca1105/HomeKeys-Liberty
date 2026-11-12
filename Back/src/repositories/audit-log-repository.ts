import type { AuditLog, AuditScope, Prisma, Role } from "@prisma/client";
import { prisma } from "../config/database";

export interface CreateAuditLogData {
  scope: AuditScope;
  actorId?: number | null;
  actorRole?: Role | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  changes?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface FindAuditLogsPageOptions {
  where?: Prisma.AuditLogWhereInput;
  skip?: number;
  take?: number;
}

export const createAuditLog = async (
  data: CreateAuditLogData,
): Promise<AuditLog> => {
  return prisma.auditLog.create({ data });
};

export const findAuditLogsPage = async ({
  where,
  skip,
  take,
}: FindAuditLogsPageOptions = {}): Promise<AuditLog[]> => {
  return prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take,
  });
};

export const countAuditLogs = async (
  where?: Prisma.AuditLogWhereInput,
): Promise<number> => {
  return prisma.auditLog.count({ where });
};

export const deleteAuditLogsBefore = async (
  cutoff: Date,
): Promise<number> => {
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
};
