import type { AuthSession, LoginInput, LoginResult } from "../types/auth";
import {
  clearLoginAttempts,
  findLoginAttemptByEmail,
  registerFailedLoginAttempt,
} from "../repositories/login-attempt-repository";
import { findUserByEmail } from "../repositories/user-repository";
import { revokeToken } from "../repositories/revoked-token-repository";
import { AppError } from "../utils/app-error";
import { generateAuthToken } from "../utils/jwt";
import { comparePassword } from "../utils/password";
import { hashToken } from "../utils/token";
import { toUserResponse } from "../utils/user-response";

const UNKNOWN_USER_PASSWORD_HASH =
  "$2b$12$c5bNPxXBtehIL0a9c8W67.fi9qmn2dFVczisH05.6pv5ExgC7ydzO";

// Persistent brute-force protection: five consecutive failures lock the
// submitted email for 15 minutes, across restarts and multiple instances.
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;
const LOGIN_LOCK_MS = LOGIN_LOCK_MINUTES * 60 * 1000;

const invalidCredentialsError = (): AppError => {
  return new AppError({
    statusCode: 401,
    code: "INVALID_CREDENTIALS",
    message:
      "El correo o la contraseña son incorrectos, por favor verifica e intenta de nuevo.",
  });
};

const accountLockedError = (): AppError => {
  return new AppError({
    statusCode: 429,
    code: "ACCOUNT_LOCKED",
    message:
      "La cuenta está bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en unos minutos.",
  });
};

const isLoginLocked = (
  loginAttempt: Awaited<ReturnType<typeof findLoginAttemptByEmail>>,
  now: Date,
): boolean => {
  return (
    loginAttempt !== null &&
    loginAttempt.lockedUntil !== null &&
    loginAttempt.lockedUntil.getTime() > now.getTime()
  );
};

export const authenticateUser = async ({
  email,
  password,
}: LoginInput): Promise<LoginResult> => {
  const now = new Date();
  const loginAttempt = await findLoginAttemptByEmail(email);

  if (isLoginLocked(loginAttempt, now)) {
    throw accountLockedError();
  }

  const user = await findUserByEmail(email);
  const passwordHash = user?.passwordHash ?? UNKNOWN_USER_PASSWORD_HASH;
  const isPasswordValid = await comparePassword(password, passwordHash);

  if (!user || !isPasswordValid) {
    await registerFailedLoginAttempt({
      email,
      now,
      maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
      lockDurationMs: LOGIN_LOCK_MS,
    });
    throw invalidCredentialsError();
  }

  if (loginAttempt !== null) {
    await clearLoginAttempts(email);
  }

  return {
    token: generateAuthToken(user.id, user.role),
    user: toUserResponse(user),
  };
};

export const revokeCurrentToken = async (
  session: AuthSession,
): Promise<void> => {
  await revokeToken({
    tokenHash: hashToken(session.token),
    userId: session.userId,
    expiresAt: session.expiresAt,
  });
};
