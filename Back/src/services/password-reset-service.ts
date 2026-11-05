import { randomBytes } from "node:crypto";
import { environment } from "../config/env";
import {
  applyPasswordReset,
  createPasswordResetToken,
  deletePendingPasswordResetTokensByUserId,
  findPasswordResetTokenByHash,
} from "../repositories/password-reset-token-repository";
import { findUserByEmail } from "../repositories/user-repository";
import { AppError } from "../utils/app-error";
import { sendPasswordResetEmail } from "../utils/mailer";
import { hashPassword } from "../utils/password";
import { hashToken } from "../utils/token";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;

const RESET_TOKEN_BYTES = 32;

export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await findUserByEmail(email);

  // The HTTP response stays generic whether the email exists or not, so this
  // silent return prevents user enumeration through the API.
  if (!user) {
    return;
  }

  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );

  await deletePendingPasswordResetTokensByUserId(user.id);
  await createPasswordResetToken({
    tokenHash: hashToken(rawToken),
    userId: user.id,
    expiresAt,
  });

  const resetUrl = `${environment.PASSWORD_RESET_BASE_URL}?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetUrl,
      expirationMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
    });
  } catch (error) {
    // Logging only: answering differently here would reveal whether the
    // email exists.
    console.error("Failed to send the password reset email.", error);
  }
};

export const resetUserPassword = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  const tokenRecord = await findPasswordResetTokenByHash(hashToken(token));

  if (!tokenRecord) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_RESET_TOKEN",
      message: "El enlace de recuperación no es válido.",
    });
  }

  if (tokenRecord.used) {
    throw new AppError({
      statusCode: 400,
      code: "RESET_TOKEN_ALREADY_USED",
      message: "Este enlace de recuperación ya fue utilizado. Solicita uno nuevo.",
    });
  }

  if (tokenRecord.expiresAt.getTime() <= Date.now()) {
    throw new AppError({
      statusCode: 400,
      code: "RESET_TOKEN_EXPIRED",
      message: "El enlace de recuperación expiró. Solicita uno nuevo.",
    });
  }

  const passwordHash = await hashPassword(newPassword);

  // passwordChangedAt closes every session issued before the reset; the user
  // signs in again with the new password.
  await applyPasswordReset(
    tokenRecord.id,
    tokenRecord.userId,
    passwordHash,
    new Date(),
  );
};
