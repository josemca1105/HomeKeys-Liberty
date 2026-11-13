import { deleteExpiredPasswordResetTokens } from "../repositories/password-reset-token-repository";
import { deleteStaleLoginAttempts } from "../repositories/login-attempt-repository";
import { deleteExpiredRevokedTokens } from "../repositories/revoked-token-repository";

// Completed login attempts are only needed to enforce the temporary lock, so
// they are removed one day after the last failure.
export const LOGIN_ATTEMPT_RETENTION_HOURS = 24;

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

export const cleanupStaleLoginAttempts = async (
  updatedBefore = new Date(
    Date.now() - LOGIN_ATTEMPT_RETENTION_HOURS * 60 * 60 * 1000,
  ),
): Promise<number> => {
  return deleteStaleLoginAttempts(updatedBefore);
};
