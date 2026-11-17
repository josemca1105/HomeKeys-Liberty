import type { PasswordResetToken } from "@prisma/client";
import { prisma } from "../config/database";
import { createAuditLog } from "./audit-log-repository";
import type { CreateAuditLogData } from "./audit-log-repository";

export type PasswordResetTokenRecord = Pick<
  PasswordResetToken,
  "id" | "userId" | "expiresAt" | "used"
>;

export interface CreatePasswordResetTokenData {
  tokenHash: string;
  userId: number;
  expiresAt: Date;
}

export const findPasswordResetTokenByHash = async (
  tokenHash: string,
): Promise<PasswordResetTokenRecord | null> => {
  return prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, used: true },
  });
};

export const createPasswordResetToken = async (
  tokenData: CreatePasswordResetTokenData,
): Promise<void> => {
  await prisma.passwordResetToken.create({
    data: tokenData,
  });
};

export const deletePendingPasswordResetTokensByUserId = async (
  userId: number,
): Promise<number> => {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { userId, used: false },
  });

  return result.count;
};

export interface ApplyPasswordResetData {
  tokenId: number;
  userId: number;
  passwordHash: string;
  passwordChangedAt: Date;
  now: Date;
  auditLog?: CreateAuditLogData;
}

// The token is consumed with a conditional update inside the transaction so
// two concurrent requests can never both apply a new password.
export const applyPasswordReset = async ({
  tokenId,
  userId,
  passwordHash,
  passwordChangedAt,
  now,
  auditLog,
}: ApplyPasswordResetData): Promise<boolean> => {
  return prisma.$transaction(async (transaction) => {
    const consumedToken = await transaction.passwordResetToken.updateMany({
      where: {
        id: tokenId,
        userId,
        used: false,
        expiresAt: { gt: now },
      },
      data: { used: true },
    });

    if (consumedToken.count !== 1) {
      return false;
    }

    // Token rows are locked before the user row to keep the same lock order
    // as password changes and avoid PostgreSQL deadlocks.
    await transaction.passwordResetToken.deleteMany({
      where: { userId, used: false },
    });

    await transaction.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt,
        mustChangePassword: false,
      },
    });

    // The audit row shares the transaction: if it fails, the token stays
    // unused and the password is not changed.
    if (auditLog !== undefined) {
      await createAuditLog(auditLog, transaction);
    }

    return true;
  });
};

export const deleteExpiredPasswordResetTokens = async (
  expiresBefore: Date,
): Promise<number> => {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lte: expiresBefore } },
  });

  return result.count;
};
