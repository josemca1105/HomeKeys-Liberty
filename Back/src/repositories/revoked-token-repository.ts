import type { RevokedToken } from "@prisma/client";
import { prisma } from "../config/database";

interface RevokeTokenData {
  tokenHash: string;
  userId: number;
  expiresAt: Date;
}

export const findRevokedTokenByHash = async (
  tokenHash: string,
): Promise<Pick<RevokedToken, "id"> | null> => {
  return prisma.revokedToken.findUnique({
    where: { tokenHash },
    select: { id: true },
  });
};

export const revokeToken = async (
  tokenData: RevokeTokenData,
): Promise<void> => {
  // Concurrent logout requests race on the unique token hash. ON CONFLICT DO
  // NOTHING keeps the operation idempotent instead of returning P2002.
  await prisma.revokedToken.createMany({
    data: [tokenData],
    skipDuplicates: true,
  });
};

export const deleteExpiredRevokedTokens = async (
  expiresBefore: Date,
): Promise<number> => {
  const result = await prisma.revokedToken.deleteMany({
    where: { expiresAt: { lte: expiresBefore } },
  });

  return result.count;
};
