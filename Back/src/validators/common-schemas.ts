import { z } from "zod";
import { createRequiredStringSchema } from "./string-schema";

// Shared field schemas. Emails, phone numbers and names are validated with the
// same rules and messages everywhere, so the definition lives in one place.

export const emailSchema = createRequiredStringSchema(
  "El correo es obligatorio.",
  "El correo debe ser un texto.",
)
  .trim()
  .toLowerCase()
  .min(1, "El correo es obligatorio.")
  .max(255, "El correo no puede tener más de 255 caracteres.")
  .email("Debes ingresar un correo electrónico válido.");

export const phoneSchema = createRequiredStringSchema(
  "El teléfono es obligatorio.",
  "El teléfono debe ser un texto.",
)
  .trim()
  .min(1, "El teléfono es obligatorio.")
  .max(20, "El teléfono no puede tener más de 20 caracteres.");

export const createPersonNameSchema = (fieldLabel: string): z.ZodString => {
  return createRequiredStringSchema(
    `El ${fieldLabel} es obligatorio.`,
    `El ${fieldLabel} debe ser un texto.`,
  )
    .trim()
    .min(1, `El ${fieldLabel} es obligatorio.`)
    .max(100, `El ${fieldLabel} no puede tener más de 100 caracteres.`);
};
