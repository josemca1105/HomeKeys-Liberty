import type { PasswordResetToken } from "@prisma/client";
import { prisma } from "../config/database";

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

export const applyPasswordReset = async (
  tokenId: number,
  userId: number,
  passwordHash: string,
  passwordChangedAt: Date,
): Promise<void> => {
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt,
        mustChangePassword: false,
      },
    });
    await transaction.passwordResetToken.update({
      where: { id: tokenId },
      data: { used: true },
    });
    await transaction.passwordResetToken.deleteMany({
      where: { userId, used: false },
    });
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
