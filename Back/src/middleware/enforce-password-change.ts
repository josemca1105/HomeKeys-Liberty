import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

// Blocks protected routes while the authenticated user must define a new
// password (account created through an invitation or reset by an ADMIN).
// Profile reads, self password change, and logout stay available.
export const enforcePasswordChange: RequestHandler = (
  req,
  _res,
  next,
): void => {
  if (req.auth?.mustChangePassword) {
    next(
      new AppError({
        statusCode: 403,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Debes cambiar tu contraseña para continuar.",
      }),
    );
    return;
  }

  next();
};
