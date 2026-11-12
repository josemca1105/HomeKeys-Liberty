import dotenv from "dotenv";
import { z } from "zod";
import { jwtSecretSchema } from "./jwt-secret";

dotenv.config();

const parseCorsOrigins = (value: string): string[] => {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

type TrustProxySetting = boolean | number | string[];

const parseTrustProxy = (value: string): TrustProxySetting => {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "" || normalized === "false") {
    return false;
  }

  const hops = Number(normalized);

  if (Number.isInteger(hops) && hops >= 0) {
    return hops;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const hasOnlyValidCorsOrigins = (origins: string[]): boolean => {
  return (
    origins.length > 0 &&
    origins.every((origin) => {
      try {
        new URL(origin);
        return true;
      } catch {
        return false;
      }
    })
  );
};

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  JWT_SECRET: jwtSecretSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform(parseCorsOrigins)
    .refine(hasOnlyValidCorsOrigins, {
      message: "CORS_ORIGINS must contain valid comma-separated URLs.",
    }),
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform(parseTrustProxy),
  RATE_LIMIT_REDIS_URL: z
    .string()
    .default("")
    .transform((value) => value.trim())
    .refine((value) => value === "" || /^rediss?:\/\//i.test(value), {
      message: "RATE_LIMIT_REDIS_URL must be a redis:// or rediss:// URL.",
    }),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  AUDIT_RETENTION_MONTHS: z.coerce
    .number()
    .int()
    .min(12, "AUDIT_RETENTION_MONTHS must be at least 12.")
    .max(120, "AUDIT_RETENTION_MONTHS cannot exceed 120.")
    .default(24),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_SECURE: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  SMTP_USER: z.string().default(""),
  SMTP_APP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  PASSWORD_RESET_BASE_URL: z
    .string()
    .default("http://localhost:5173/reset-password"),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error(
    "Invalid environment configuration.",
    parsedEnvironment.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment configuration.");
}

if (
  parsedEnvironment.data.SMTP_USER === "" ||
  parsedEnvironment.data.SMTP_APP_PASSWORD === ""
) {
  console.warn(
    "SMTP is not configured; password recovery emails will not be sent.",
  );
}

export const environment = parsedEnvironment.data;
