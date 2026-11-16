import type { Request } from "express";
import type { AuthSession } from "../types/auth";
import { AppError } from "./app-error";

// Returns the authenticated session or fails with the same response used by
// the authentication middleware. Controllers use it instead of repeating the
// null check and the error construction.
export const requireSession = (req: Request): AuthSession => {
  if (!req.auth) {
    throw new AppError({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Debes iniciar sesión para acceder a este recurso.",
    });
  }

  return req.auth;
};
