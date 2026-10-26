import { z } from "zod";
import { createRequiredStringSchema } from "./string-schema";

export const loginSchema = z.object(
  {
    email: createRequiredStringSchema(
      "El correo es obligatorio.",
      "El correo debe ser un texto.",
    )
      .trim()
      .toLowerCase()
      .min(1, "El correo es obligatorio.")
      .max(255, "El correo no puede tener más de 255 caracteres.")
      .email("Debes ingresar un correo electrónico válido."),
    password: createRequiredStringSchema(
      "La contraseña es obligatoria.",
      "La contraseña debe ser un texto.",
    )
      .min(1, "La contraseña es obligatoria.")
      .max(72, "La contraseña no puede tener más de 72 caracteres."),
  },
  { error: "El cuerpo de la petición debe ser un objeto JSON." },
);
