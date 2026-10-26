import { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

export const isAdmin: RequestHandler = (req, _res, next): void => {
  if (!req.auth) {
    next(
      new AppError({
        statusCode: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Debes iniciar sesión para acceder a este recurso.",
      }),
    );
    return;
  }

  if (req.auth.role !== Role.ADMIN) {
    next(
      new AppError({
        statusCode: 403,
        code: "ADMIN_REQUIRED",
        message: "No tienes permisos para realizar esta acción.",
      }),
    );
    return;
  }

  next();
};
