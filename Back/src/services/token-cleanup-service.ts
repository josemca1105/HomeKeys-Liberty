import { deleteExpiredRevokedTokens } from "../repositories/revoked-token-repository";

export const cleanupExpiredRevokedTokens = async (
  expiresBefore = new Date(),
): Promise<number> => {
  return deleteExpiredRevokedTokens(expiresBefore);
};
