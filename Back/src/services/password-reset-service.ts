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
export const INVITATION_TOKEN_TTL_MINUTES = 24 * 60;

const RESET_TOKEN_BYTES = 32;

const invalidResetTokenError = (): AppError => {
  return new AppError({
    statusCode: 400,
    code: "INVALID_RESET_TOKEN",
    message: "El enlace no es válido.",
  });
};

const resetTokenAlreadyUsedError = (): AppError => {
  return new AppError({
    statusCode: 400,
    code: "RESET_TOKEN_ALREADY_USED",
    message: "Este enlace ya fue utilizado. Solicita uno nuevo.",
  });
};

const resetTokenExpiredError = (): AppError => {
  return new AppError({
    statusCode: 400,
    code: "RESET_TOKEN_EXPIRED",
    message: "El enlace expiró. Solicita uno nuevo.",
  });
};

const resolveResetTokenFailure = async (token: string): Promise<AppError> => {
  const currentToken = await findPasswordResetTokenByHash(hashToken(token));

  if (!currentToken) {
    return invalidResetTokenError();
  }

  if (currentToken.used) {
    return resetTokenAlreadyUsedError();
  }

  if (currentToken.expiresAt.getTime() <= Date.now()) {
    return resetTokenExpiredError();
  }

  // A concurrent request consumed the token first.
  return resetTokenAlreadyUsedError();
};

// Issues a single-use, SHA-256-hashed recovery/invitation token and returns
// the raw token that must only travel inside the email link.
export const issuePasswordResetToken = async (
  userId: number,
  ttlMinutes: number,
): Promise<string> => {
  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await deletePendingPasswordResetTokensByUserId(userId);
  await createPasswordResetToken({
    tokenHash: hashToken(rawToken),
    userId: userId,
    expiresAt,
  });

  return rawToken;
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await findUserByEmail(email);

  // The HTTP response stays generic whether the email exists or not, so this
  // silent return prevents user enumeration through the API.
  if (!user) {
    return;
  }

  const rawToken = await issuePasswordResetToken(
    user.id,
    PASSWORD_RESET_TOKEN_TTL_MINUTES,
  );
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
    throw invalidResetTokenError();
  }

  if (tokenRecord.used) {
    throw resetTokenAlreadyUsedError();
  }

  if (tokenRecord.expiresAt.getTime() <= Date.now()) {
    throw resetTokenExpiredError();
  }

  const passwordHash = await hashPassword(newPassword);
  const passwordChangedAt = new Date();

  // passwordChangedAt closes every session issued before the change and
  // mustChangePassword clears the forced-change state from invitations and
  // administrator resets. The conditional update inside applyPasswordReset
  // guarantees the token is consumed exactly once.
  const wasApplied = await applyPasswordReset({
    tokenId: tokenRecord.id,
    userId: tokenRecord.userId,
    passwordHash,
    passwordChangedAt,
    now: passwordChangedAt,
  });

  if (!wasApplied) {
    throw await resolveResetTokenFailure(token);
  }
};
