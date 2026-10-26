import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, Response } from "express";
import type { ErrorDetail } from "../utils/app-error";
import { AppError } from "../utils/app-error";

const sendErrorResponse = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ErrorDetail[],
): void => {
  res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(details ? { errors: details } : {}),
  });
};

const isMalformedJsonError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
): void => {
  if (error instanceof AppError) {
    sendErrorResponse(
      res,
      error.statusCode,
      error.code,
      error.message,
      error.details,
    );
    return;
  }

  if (isMalformedJsonError(error)) {
    sendErrorResponse(
      res,
      400,
      "INVALID_JSON",
      "El cuerpo de la petición no contiene un JSON válido.",
    );
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    sendErrorResponse(
      res,
      409,
      "EMAIL_ALREADY_REGISTERED",
      "Ya existe un usuario registrado con ese correo.",
    );
    return;
  }

  console.error("Unhandled server error.", error);
  sendErrorResponse(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    "Ocurrió un error inesperado. Por favor intenta de nuevo más tarde.",
  );
};
