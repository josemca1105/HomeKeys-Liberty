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

const hasBodyParserErrorType = (
  error: unknown,
  errorType: string,
): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === errorType
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

  if (hasBodyParserErrorType(error, "entity.parse.failed")) {
    sendErrorResponse(
      res,
      400,
      "INVALID_JSON",
      "El cuerpo de la petición no contiene un JSON válido.",
    );
    return;
  }

  if (hasBodyParserErrorType(error, "entity.too.large")) {
    sendErrorResponse(
      res,
      413,
      "PAYLOAD_TOO_LARGE",
      "El cuerpo de la petición supera el tamaño máximo permitido.",
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
