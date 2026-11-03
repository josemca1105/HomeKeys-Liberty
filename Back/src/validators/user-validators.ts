import { z } from "zod";
import { createRequiredStringSchema } from "./string-schema";

const roleSchema = z.enum(["ADMIN", "PARTNER"], {
  error: "El rol debe ser ADMIN o PARTNER.",
});

const strictObjectError = (issue: { code: string }): string => {
  return issue.code === "unrecognized_keys"
    ? "No se permiten campos desconocidos en la petición."
    : "El cuerpo de la petición debe ser un objeto JSON.";
};

const createPasswordSchema = (
  requiredMessage: string,
  invalidTypeMessage: string,
): z.ZodString => {
  return createRequiredStringSchema(requiredMessage, invalidTypeMessage)
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(72, "La contraseña no puede tener más de 72 caracteres.")
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
      message: "La contraseña no puede superar los 72 bytes en formato UTF-8.",
    });
};

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
    ),
    phone: createRequiredStringSchema(
      "El teléfono es obligatorio.",
      "El teléfono debe ser un texto.",
    )
      .trim()
      .min(1, "El teléfono es obligatorio.")
      .max(20, "El teléfono no puede tener más de 20 caracteres."),
    photoUrl: z
      .string({ error: "La URL de la foto debe ser un texto." })
      .trim()
      .max(2048, "La URL de la foto no puede tener más de 2048 caracteres.")
      .url("Debes ingresar una URL válida para la foto.")
      .nullable()
      .optional(),
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
      photoUrl: z
        .string({ error: "La URL de la foto debe ser un texto." })
        .trim()
        .max(2048, "La URL de la foto no puede tener más de 2048 caracteres.")
        .url("Debes ingresar una URL válida para la foto.")
        .nullable()
        .optional(),
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
