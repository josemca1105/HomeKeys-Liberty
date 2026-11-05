import { deleteExpiredPasswordResetTokens } from "../repositories/password-reset-token-repository";
import { deleteExpiredRevokedTokens } from "../repositories/revoked-token-repository";

export const cleanupExpiredRevokedTokens = async (
  expiresBefore = new Date(),
): Promise<number> => {
  return deleteExpiredRevokedTokens(expiresBefore);
};

export const cleanupExpiredPasswordResetTokens = async (
  expiresBefore = new Date(),
): Promise<number> => {
  return deleteExpiredPasswordResetTokens(expiresBefore);
};
