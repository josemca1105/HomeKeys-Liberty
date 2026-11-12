import { z } from "zod";
import {
  createPasswordSchema,
  strictObjectError,
} from "./password-schema";
import { photoUrlSchema } from "./photo-url-schema";
import { createRequiredStringSchema } from "./string-schema";

const roleSchema = z.enum(["ADMIN", "PARTNER"], {
  error: "El rol debe ser ADMIN o PARTNER.",
});

export const userIdParamsSchema = z.object(
  {
    id: z.coerce
      .number()
      .int()
      .positive()
      .max(2147483647, "El ID del usuario debe ser un número entero positivo."),
  },
  { error: "El ID del usuario debe ser un número entero positivo." },
);

export const createUserSchema = z.object(
  {
    firstName: createRequiredStringSchema(
      "El nombre es obligatorio.",
      "El nombre debe ser un texto.",
    )
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(100, "El nombre no puede tener más de 100 caracteres."),
    lastName: createRequiredStringSchema(
      "El apellido es obligatorio.",
      "El apellido debe ser un texto.",
    )
      .trim()
      .min(1, "El apellido es obligatorio.")
      .max(100, "El apellido no puede tener más de 100 caracteres."),
    email: createRequiredStringSchema(
      "El correo es obligatorio.",
      "El correo debe ser un texto.",
    )
      .trim()
      .toLowerCase()
      .min(1, "El correo es obligatorio.")
      .max(255, "El correo no puede tener más de 255 caracteres.")
      .email("Debes ingresar un correo electrónico válido."),
    password: createPasswordSchema(
      "La contraseña es obligatoria.",
      "La contraseña debe ser un texto.",
    ).optional(),
    phone: createRequiredStringSchema(
      "El teléfono es obligatorio.",
      "El teléfono debe ser un texto.",
    )
      .trim()
      .min(1, "El teléfono es obligatorio.")
      .max(20, "El teléfono no puede tener más de 20 caracteres."),
    photoUrl: photoUrlSchema,
    role: roleSchema.optional(),
  },
  { error: "El cuerpo de la petición debe ser un objeto JSON." },
);

export const changePasswordSchema = z
  .strictObject(
    {
      currentPassword: createRequiredStringSchema(
        "La contraseña actual es obligatoria.",
        "La contraseña actual debe ser un texto.",
      ).min(1, "La contraseña actual es obligatoria."),
      newPassword: createPasswordSchema(
        "La nueva contraseña es obligatoria.",
        "La nueva contraseña debe ser un texto.",
      ),
    },
    { error: strictObjectError },
  )
  .superRefine((body, context) => {
    if (body.newPassword === body.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "La nueva contraseña no puede ser igual a la contraseña actual.",
        path: ["newPassword"],
      });
    }
  });

export const updateUserSchema = z
  .strictObject(
    {
      firstName: createRequiredStringSchema(
        "El nombre es obligatorio.",
        "El nombre debe ser un texto.",
      )
        .trim()
        .min(1, "El nombre es obligatorio.")
        .max(100, "El nombre no puede tener más de 100 caracteres.")
        .optional(),
      lastName: createRequiredStringSchema(
        "El apellido es obligatorio.",
        "El apellido debe ser un texto.",
      )
        .trim()
        .min(1, "El apellido es obligatorio.")
        .max(100, "El apellido no puede tener más de 100 caracteres.")
        .optional(),
      email: createRequiredStringSchema(
        "El correo es obligatorio.",
        "El correo debe ser un texto.",
      )
        .trim()
        .toLowerCase()
        .min(1, "El correo es obligatorio.")
        .max(255, "El correo no puede tener más de 255 caracteres.")
        .email("Debes ingresar un correo electrónico válido.")
        .optional(),
      phone: createRequiredStringSchema(
        "El teléfono es obligatorio.",
        "El teléfono debe ser un texto.",
      )
        .trim()
        .min(1, "El teléfono es obligatorio.")
        .max(20, "El teléfono no puede tener más de 20 caracteres.")
        .optional(),
      photoUrl: photoUrlSchema,
      role: roleSchema.optional(),
      password: createPasswordSchema(
        "La contraseña es obligatoria.",
        "La contraseña debe ser un texto.",
      ).optional(),
    },
    { error: strictObjectError },
  )
  .refine((body) => Object.keys(body).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });
