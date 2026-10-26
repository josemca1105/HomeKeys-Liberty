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
  await prisma.revokedToken.create({
    data: tokenData,
  });
};
