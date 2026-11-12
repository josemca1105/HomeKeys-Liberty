import { z } from "zod";

export const JWT_SECRET_MIN_LENGTH = 64;
export const JWT_SECRET_MIN_DISTINCT_CHARACTERS = 16;

// Values that are clearly documentation placeholders. They must never reach a
// running environment, even if they satisfy the length check.
const FORBIDDEN_PLACEHOLDER_FRAGMENTS = [
  "REPLACE_WITH",
  "CHANGE_ME",
  "CHANGEME",
  "YOUR_SECRET",
  "YOUR-SECRET",
  "MY_SECRET",
  "DEV_SECRET",
  "TEST_SECRET",
  "LOCAL_SECRET",
  "DEFAULT_SECRET",
  "SECRET_KEY",
  "SECRET_KEY_HERE",
  "PLACEHOLDER",
  "INSERT_SECRET",
  "EXAMPLE_SECRET",
] as const;

const FORBIDDEN_EXACT_VALUES = new Set([
  "SECRET",
  "JWT_SECRET",
  "PASSWORD",
  "SUPERSECRET",
  "MY_SECRET",
  "DEV_SECRET",
  "TEST_SECRET",
]);

const normalizeForComparison = (value: string): string => {
  return value.trim().toUpperCase();
};

export const isJwtSecretValid = (value: string): boolean => {
  if (value.length < JWT_SECRET_MIN_LENGTH) {
    return false;
  }

  if (value !== value.trim()) {
    return false;
  }

  if (new Set(value).size < JWT_SECRET_MIN_DISTINCT_CHARACTERS) {
    return false;
  }

  const normalized = normalizeForComparison(value);

  if (FORBIDDEN_EXACT_VALUES.has(normalized)) {
    return false;
  }

  return !FORBIDDEN_PLACEHOLDER_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
};

export const jwtSecretSchema = z
  .string({ error: "JWT_SECRET is required." })
  .min(
    JWT_SECRET_MIN_LENGTH,
    `JWT_SECRET must contain at least ${JWT_SECRET_MIN_LENGTH} characters.`,
  )
  .refine(isJwtSecretValid, {
    message:
      "JWT_SECRET must be a random value, not a placeholder, with at least 16 distinct characters.",
  });
