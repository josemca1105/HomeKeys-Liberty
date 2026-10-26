import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

export const notFoundHandler: RequestHandler = (_req, _res, next): void => {
  next(
    new AppError({
      statusCode: 404,
      code: "ROUTE_NOT_FOUND",
      message: "La ruta que intentas consultar no existe.",
    }),
  );
};
