import type { AuthSession, LoginInput, LoginResult } from "../types/auth";
import { findUserByEmail } from "../repositories/user-repository";
import { revokeToken } from "../repositories/revoked-token-repository";
import { AppError } from "../utils/app-error";
import { generateAuthToken } from "../utils/jwt";
import { comparePassword } from "../utils/password";
import { hashToken } from "../utils/token";
import { toUserResponse } from "../utils/user-response";

const UNKNOWN_USER_PASSWORD_HASH =
  "$2b$12$c5bNPxXBtehIL0a9c8W67.fi9qmn2dFVczisH05.6pv5ExgC7ydzO";

const invalidCredentialsError = (): AppError => {
  return new AppError({
    statusCode: 401,
    code: "INVALID_CREDENTIALS",
    message:
      "El correo o la contraseña son incorrectos, por favor verifica e intenta de nuevo.",
  });
};

export const authenticateUser = async ({
  email,
  password,
}: LoginInput): Promise<LoginResult> => {
  const user = await findUserByEmail(email);
  const passwordHash = user?.passwordHash ?? UNKNOWN_USER_PASSWORD_HASH;
  const isPasswordValid = await comparePassword(password, passwordHash);

  if (!user || !isPasswordValid) {
    throw invalidCredentialsError();
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
