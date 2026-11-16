import { z } from "zod";
import { emailSchema } from "./common-schemas";
import {
  createPasswordSchema,
  strictObjectError,
} from "./password-schema";
import { createRequiredStringSchema } from "./string-schema";

export const loginSchema = z.strictObject(
  {
    email: emailSchema,
    password: createRequiredStringSchema(
      "La contraseña es obligatoria.",
      "La contraseña debe ser un texto.",
    )
      .min(1, "La contraseña es obligatoria.")
      .max(72, "La contraseña no puede tener más de 72 caracteres."),
  },
  { error: strictObjectError },
);

export const forgotPasswordSchema = z.strictObject(
  {
    email: emailSchema,
  },
  { error: strictObjectError },
);

export const resetPasswordSchema = z.strictObject(
  {
    token: createRequiredStringSchema(
      "El enlace de recuperación es obligatorio.",
      "El enlace de recuperación debe ser un texto.",
    )
      .trim()
      .min(32, "El enlace de recuperación no es válido.")
      .max(128, "El enlace de recuperación no es válido."),
    newPassword: createPasswordSchema(
      "La nueva contraseña es obligatoria.",
      "La nueva contraseña debe ser un texto.",
    ),
  },
  { error: strictObjectError },
);
