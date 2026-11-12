import type { Request } from "express";
import {
  ipKeyGenerator,
  rateLimit,
  type Options,
} from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { createClient, type RedisClientType } from "redis";
import { environment } from "../config/env";
import { AppError } from "../utils/app-error";
import { hashToken } from "../utils/token";

const WINDOW_MS = 15 * 60 * 1000;

const createRateLimitHandler = (
  code: string,
  message: string,
): Options["handler"] => {
  return (_req, _res, next): void => {
    next(
      new AppError({
        statusCode: 429,
        code,
        message,
      }),
    );
  };
};

const loginRateLimitHandler = createRateLimitHandler(
  "TOO_MANY_LOGIN_ATTEMPTS",
  "Has realizado demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.",
);

const recoveryRateLimitHandler = createRateLimitHandler(
  "TOO_MANY_RESET_ATTEMPTS",
  "Has realizado demasiadas solicitudes de recuperación. Espera unos minutos e intenta de nuevo.",
);

const passwordChangeRateLimitHandler = createRateLimitHandler(
  "TOO_MANY_PASSWORD_CHANGE_ATTEMPTS",
  "Has realizado demasiados intentos de cambio de contraseña. Espera unos minutos e intenta de nuevo.",
);

const userManagementRateLimitHandler = createRateLimitHandler(
  "TOO_MANY_ADMIN_ACTIONS",
  "Has realizado demasiadas acciones de administración. Espera unos minutos e intenta de nuevo.",
);

const apiRateLimitHandler = createRateLimitHandler(
  "TOO_MANY_REQUESTS",
  "Has realizado demasiadas solicitudes. Espera unos minutos e intenta de nuevo.",
);

let redisClient: RedisClientType | null = null;

const logRedisError = (error: unknown): void => {
  console.error(
    "Rate limit Redis error.",
    error instanceof Error ? error.message : error,
  );
};

const getRedisClient = (): RedisClientType | null => {
  if (environment.RATE_LIMIT_REDIS_URL === "") {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: environment.RATE_LIMIT_REDIS_URL,
      // Fail open quickly instead of queueing every request while Redis is
      // unreachable; passOnStoreError lets the request continue.
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 5000,
      },
    });

    redisClient.on("error", logRedisError);

    void redisClient.connect().catch(logRedisError);
  }

  return redisClient;
};

const createRateLimitStore = (prefix: string): RedisStore | null => {
  const client = getRedisClient();

  if (!client) {
    return null;
  }

  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) =>
      client.sendCommand(args) as unknown as Promise<RedisReply>,
  });
};

const storeOptions = (prefix: string): Partial<Pick<Options, "store">> => {
  const store = createRateLimitStore(prefix);

  return store ? { store } : {};
};

const clientIpKey = (req: Request): string => {
  return ipKeyGenerator(req.ip ?? "");
};

const emailKey = (req: Request): string => {
  const body = req.body as { email?: unknown } | undefined;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  return email === "" ? clientIpKey(req) : `email:${email}`;
};

const resetTokenKey = (req: Request): string => {
  const body = req.body as { token?: unknown } | undefined;
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  return token === "" ? clientIpKey(req) : `token:${hashToken(token)}`;
};

const authenticatedUserKey = (req: Request): string => {
  return req.auth ? `user:${req.auth.userId}` : clientIpKey(req);
};

const baseOptions = {
  windowMs: WINDOW_MS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  passOnStoreError: true,
} as const;

export const apiRateLimiter = rateLimit({
  ...baseOptions,
  limit: 600,
  identifier: "api",
  skip: (req) => req.method === "OPTIONS",
  handler: apiRateLimitHandler,
  ...storeOptions("rl:api:"),
});

export const loginIpRateLimiter = rateLimit({
  ...baseOptions,
  limit: 30,
  identifier: "login-ip",
  skipSuccessfulRequests: true,
  handler: loginRateLimitHandler,
  ...storeOptions("rl:login-ip:"),
});

export const loginAccountRateLimiter = rateLimit({
  ...baseOptions,
  limit: 5,
  identifier: "login-account",
  skipSuccessfulRequests: true,
  keyGenerator: emailKey,
  handler: loginRateLimitHandler,
  ...storeOptions("rl:login-account:"),
});

export const forgotPasswordIpRateLimiter = rateLimit({
  ...baseOptions,
  limit: 20,
  identifier: "forgot-password-ip",
  handler: recoveryRateLimitHandler,
  ...storeOptions("rl:forgot-password-ip:"),
});

export const forgotPasswordEmailRateLimiter = rateLimit({
  ...baseOptions,
  limit: 5,
  identifier: "forgot-password-email",
  keyGenerator: emailKey,
  handler: recoveryRateLimitHandler,
  ...storeOptions("rl:forgot-password-email:"),
});

export const resetPasswordIpRateLimiter = rateLimit({
  ...baseOptions,
  limit: 10,
  identifier: "reset-password-ip",
  handler: recoveryRateLimitHandler,
  ...storeOptions("rl:reset-password-ip:"),
});

export const resetPasswordTokenRateLimiter = rateLimit({
  ...baseOptions,
  limit: 5,
  identifier: "reset-password-token",
  keyGenerator: resetTokenKey,
  handler: recoveryRateLimitHandler,
  ...storeOptions("rl:reset-password-token:"),
});

export const passwordChangeRateLimiter = rateLimit({
  ...baseOptions,
  limit: 5,
  identifier: "password-change",
  skipSuccessfulRequests: true,
  keyGenerator: authenticatedUserKey,
  handler: passwordChangeRateLimitHandler,
  ...storeOptions("rl:password-change:"),
});

export const userManagementRateLimiter = rateLimit({
  ...baseOptions,
  limit: 60,
  identifier: "user-management",
  keyGenerator: authenticatedUserKey,
  handler: userManagementRateLimitHandler,
  ...storeOptions("rl:user-management:"),
});
