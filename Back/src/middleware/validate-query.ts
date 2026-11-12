import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../utils/app-error";

export const validateQuery = (schema: z.ZodType): RequestHandler => {
  return (req, _res, next): void => {
    const validationResult = schema.safeParse(req.query);

    if (!validationResult.success) {
      const details = validationResult.error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join(".") : "query",
        message: issue.message,
      }));

      next(
        new AppError({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: "Por favor revisa los datos ingresados.",
          details,
        }),
      );
      return;
    }

    req.validatedQuery = validationResult.data;
    next();
  };
};
