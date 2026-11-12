import { z } from "zod";
import type { ListUsersQuery } from "../types/user";
import {
  createPasswordSchema,
  strictObjectError,
} from "./password-schema";
import { photoUrlSchema } from "./photo-url-schema";
import { createRequiredStringSchema } from "./string-schema";

const roleSchema = z.enum(["ADMIN", "PARTNER"], {
  error: "El rol debe ser ADMIN o PARTNER.",
});

const strictQueryError = (issue: { code: string }): string => {
  return issue.code === "unrecognized_keys"
    ? "No se permiten parámetros desconocidos en la consulta."
    : "La consulta de la petición no es válida.";
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

export const listUsersQuerySchema: z.ZodType<ListUsersQuery> = z.strictObject(
  {
    page: z.coerce
      .number({ error: "La página debe ser un número entero mayor o igual a 1." })
      .int("La página debe ser un número entero mayor o igual a 1.")
      .min(1, "La página debe ser un número entero mayor o igual a 1.")
      .default(1),
    pageSize: z.coerce
      .number({
        error:
          "El tamaño de página debe ser un número entero entre 1 y 100.",
      })
      .int("El tamaño de página debe ser un número entero entre 1 y 100.")
      .min(1, "El tamaño de página debe ser un número entero entre 1 y 100.")
      .max(100, "El tamaño de página debe ser un número entero entre 1 y 100.")
      .default(20),
    search: z
      .string({ error: "La búsqueda debe ser un texto." })
      .trim()
      .min(1, "La búsqueda no puede estar vacía.")
      .max(100, "La búsqueda no puede tener más de 100 caracteres.")
      .optional(),
    role: roleSchema.optional(),
    sortBy: z
      .enum(["createdAt", "firstName", "lastName", "email", "role"], {
        error: "El campo de ordenamiento no es válido.",
      })
      .default("createdAt"),
    sortOrder: z
      .enum(["asc", "desc"], {
        error: "El orden debe ser asc o desc.",
      })
      .default("desc"),
  },
  { error: strictQueryError },
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
