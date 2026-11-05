import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const parseCorsOrigins = (value: string): string[] => {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
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
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters."),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform(parseCorsOrigins)
    .refine(hasOnlyValidCorsOrigins, {
      message: "CORS_ORIGINS must contain valid comma-separated URLs.",
    }),
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
