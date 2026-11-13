import { z } from "zod";
import { isCommonPassword } from "../utils/password-blocklist";
import { createRequiredStringSchema } from "./string-schema";

export const PASSWORD_MIN_LENGTH = 12;

// Shared password policy: at least 12 characters, at most 72 UTF-8 bytes
// (bcrypt limit), at least one uppercase letter, one lowercase letter, one
// number and one special character (Unicode-aware), and no known common or
// predictable password.
export const createPasswordSchema = (
  requiredMessage: string,
  invalidTypeMessage: string,
): z.ZodString => {
  return createRequiredStringSchema(requiredMessage, invalidTypeMessage)
    .min(
      PASSWORD_MIN_LENGTH,
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    )
    .max(72, "La contraseña no puede tener más de 72 caracteres.")
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
      message: "La contraseña no puede superar los 72 bytes en formato UTF-8.",
    })
    .refine((password) => /\p{Lu}/u.test(password), {
      message: "La contraseña debe incluir al menos una letra mayúscula.",
    })
    .refine((password) => /\p{Ll}/u.test(password), {
      message: "La contraseña debe incluir al menos una letra minúscula.",
    })
    .refine((password) => /\p{N}/u.test(password), {
      message: "La contraseña debe incluir al menos un número.",
    })
    .refine((password) => /[\p{P}\p{S}]/u.test(password), {
      message: "La contraseña debe incluir al menos un carácter especial.",
    })
    .refine((password) => !isCommonPassword(password), {
      message:
        "La contraseña es demasiado común o predecible. Elige una diferente.",
    });
};

export const strictObjectError = (issue: { code: string }): string => {
  return issue.code === "unrecognized_keys"
    ? "No se permiten campos desconocidos en la petición."
    : "El cuerpo de la petición debe ser un objeto JSON.";
};
