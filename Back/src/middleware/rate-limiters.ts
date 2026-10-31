import { rateLimit } from "express-rate-limit";
import { AppError } from "../utils/app-error";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, _res, next): void => {
    next(
      new AppError({
        statusCode: 429,
        code: "TOO_MANY_LOGIN_ATTEMPTS",
        message:
          "Has realizado demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.",
      }),
    );
  },
});
