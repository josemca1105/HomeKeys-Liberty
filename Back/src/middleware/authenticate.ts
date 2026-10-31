import type { RequestHandler } from "express";
import { findRevokedTokenByHash } from "../repositories/revoked-token-repository";
import { findUserAuthorizationById } from "../repositories/user-repository";
import type { AuthTokenPayload } from "../types/auth";
import { AppError } from "../utils/app-error";
import { verifyAuthToken } from "../utils/jwt";
import { hashToken } from "../utils/token";

const createSessionError = (
  code = "INVALID_SESSION",
  message = "Tu sesión no es válida o ya expiró. Inicia sesión nuevamente.",
): AppError => {
  return new AppError({
    statusCode: 401,
    code,
    message,
  });
};

const getBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) {
    return null;
  }

  const parts = authorization.trim().split(/\s+/);
  const scheme = parts[0];
  const token = parts[1];

  if (
    parts.length !== 2 ||
    scheme?.toLowerCase() !== "bearer" ||
    token === undefined
  ) {
    return null;
  }

  return token;
};

export const authenticate: RequestHandler = async (
  req,
  _res,
  next,
): Promise<void> => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw createSessionError(
        "AUTHENTICATION_REQUIRED",
        "Debes iniciar sesión para acceder a este recurso.",
      );
    }

    let tokenPayload: AuthTokenPayload;

    try {
      tokenPayload = verifyAuthToken(token);
    } catch {
      throw createSessionError();
    }

    const [revokedToken, user] = await Promise.all([
      findRevokedTokenByHash(hashToken(token)),
      findUserAuthorizationById(tokenPayload.userId),
    ]);

    if (revokedToken) {
      throw createSessionError(
        "SESSION_REVOKED",
        "Esta sesión ya fue cerrada. Inicia sesión nuevamente.",
      );
    }

    if (!user) {
      throw createSessionError();
    }

    req.auth = {
      ...tokenPayload,
      role: user.role,
      token,
    };
    next();
  } catch (error) {
    next(error);
  }
};
