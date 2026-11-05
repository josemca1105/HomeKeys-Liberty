import { z } from "zod";
import { createRequiredStringSchema } from "./string-schema";

// Shared password policy: at least 8 characters, at most 72 UTF-8 bytes
// (bcrypt limit), and at least one uppercase letter, one lowercase letter,
// one number and one special character (Unicode-aware).
export const createPasswordSchema = (
  requiredMessage: string,
  invalidTypeMessage: string,
): z.ZodString => {
  return createRequiredStringSchema(requiredMessage, invalidTypeMessage)
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
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
    });
};

export const strictObjectError = (issue: { code: string }): string => {
  return issue.code === "unrecognized_keys"
    ? "No se permiten campos desconocidos en la petición."
    : "El cuerpo de la petición debe ser un objeto JSON.";
};
