import { randomBytes } from "node:crypto";
import { AuditScope, EmailType, type Prisma } from "@prisma/client";
import { environment } from "../config/env";
import { prisma } from "../config/database";
import {
  applyPasswordReset,
  createPasswordResetToken,
  deletePendingPasswordResetTokensByUserId,
  findPasswordResetTokenByHash,
} from "../repositories/password-reset-token-repository";
import { findRecentPasswordHashes } from "../repositories/password-history-repository";
import { findUserByEmail, findUserCredentialsById } from "../repositories/user-repository";
import type { AuditContext } from "../types/audit";
import { AppError } from "../utils/app-error";
import { hashPassword } from "../utils/password";
import {
  assertPasswordNotBasedOnIdentity,
  assertPasswordNotReused,
  PASSWORD_HISTORY_LIMIT,
} from "../utils/password-policy";
import { hashToken } from "../utils/token";
import { buildAuditLogData } from "./audit-service";
import { queueEmail } from "./email-outbox-service";

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

const accountInactiveError = (): AppError => {
  return new AppError({
    statusCode: 403,
    code: "ACCOUNT_INACTIVE",
    message:
      "Tu cuenta está desactivada. Contacta a un administrador para reactivarla.",
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
  client?: Prisma.TransactionClient,
): Promise<string> => {
  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await deletePendingPasswordResetTokensByUserId(userId, client);
  await createPasswordResetToken(
    {
      tokenHash: hashToken(rawToken),
      userId: userId,
      expiresAt,
    },
    client,
  );

  return rawToken;
};

// The token travels in the URL fragment, never in the query string, so it
// stays out of server logs, proxies and Referer headers.
export const buildPasswordResetUrl = (rawToken: string): string => {
  return `${environment.PASSWORD_RESET_BASE_URL}#token=${rawToken}`;
};

interface PasswordResetRecipient {
  id: number;
  email: string;
  firstName: string;
}

const deliverPasswordResetEmail = async (
  user: PasswordResetRecipient,
): Promise<void> => {
  try {
    await prisma.$transaction(async (transaction) => {
      const rawToken = await issuePasswordResetToken(
        user.id,
        PASSWORD_RESET_TOKEN_TTL_MINUTES,
        transaction,
      );

      await queueEmail(
        {
          type: EmailType.PASSWORD_RESET,
          to: user.email,
          payload: {
            firstName: user.firstName,
            resetUrl: buildPasswordResetUrl(rawToken),
            expirationMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
          },
        },
        transaction,
      );
    });
  } catch (error) {
    // Logging only: the HTTP response is intentionally identical whether the
    // email exists, the token cannot be issued or the queue insert fails.
    console.error("Failed to enqueue the password reset email.", error);
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await findUserByEmail(email);

  // Deactivated accounts cannot sign in, so recovery links are not sent. The
  // response stays generic, exactly as it does for unknown emails.
  if (!user || !user.isActive) {
    return;
  }

  // The HTTP response stays generic whether the email exists or not, so this
  // silent return prevents user enumeration through the API.
  if (!user) {
    return;
  }

  // Token issuance and SMTP delivery run after the response so both branches
  // take approximately the same time and the request does not wait for SMTP.
  setImmediate(() => {
    void deliverPasswordResetEmail({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
    });
  });
};

export const resetUserPassword = async (
  token: string,
  newPassword: string,
  auditContext: AuditContext,
): Promise<number> => {
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

  const user = await findUserCredentialsById(tokenRecord.userId);

  if (!user) {
    throw invalidResetTokenError();
  }

  if (!user.isActive) {
    throw accountInactiveError();
  }

  assertPasswordNotBasedOnIdentity(
    newPassword,
    {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    "newPassword",
  );

  const recentHashes = await findRecentPasswordHashes(
    tokenRecord.userId,
    PASSWORD_HISTORY_LIMIT,
  );
  await assertPasswordNotReused(
    newPassword,
    [user.passwordHash, ...recentHashes],
    "newPassword",
  );

  const passwordHash = await hashPassword(newPassword);
  const passwordChangedAt = new Date();

  const auditLog = buildAuditLogData({
    scope: AuditScope.SECURITY,
    action: "PASSWORD_RESET",
    actor: { id: tokenRecord.userId },
    entityType: "USER",
    entityId: tokenRecord.userId,
    request: auditContext.request,
  });

  // passwordChangedAt closes every session issued before the change and
  // mustChangePassword clears the forced-change state from invitations and
  // administrator resets. The conditional update inside applyPasswordReset
  // guarantees the token is consumed exactly once, and the audit row shares
  // the same transaction.
  const wasApplied = await applyPasswordReset({
    tokenId: tokenRecord.id,
    userId: tokenRecord.userId,
    passwordHash,
    passwordChangedAt,
    now: passwordChangedAt,
    auditLog,
    passwordHistoryLimit: PASSWORD_HISTORY_LIMIT,
  });

  if (!wasApplied) {
    throw await resolveResetTokenFailure(token);
  }

  return tokenRecord.userId;
};
