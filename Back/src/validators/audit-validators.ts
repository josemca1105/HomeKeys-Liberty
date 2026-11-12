import { z } from "zod";
import type { AuditLogQuery } from "../types/audit";

const strictQueryError = (issue: { code: string }): string => {
  return issue.code === "unrecognized_keys"
    ? "No se permiten parámetros desconocidos en la consulta."
    : "La consulta de la petición no es válida.";
};

export const auditLogQuerySchema: z.ZodType<AuditLogQuery> = z
  .strictObject(
    {
      page: z.coerce
        .number({
          error: "La página debe ser un número entero mayor o igual a 1.",
        })
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
        .max(
          100,
          "El tamaño de página debe ser un número entero entre 1 y 100.",
        )
        .default(20),
      scope: z
        .enum(["SECURITY", "BUSINESS"], {
          error: "El alcance debe ser SECURITY o BUSINESS.",
        })
        .optional(),
      action: z
        .string({ error: "La acción debe ser un texto." })
        .trim()
        .min(1, "La acción no puede estar vacía.")
        .max(80, "La acción no puede tener más de 80 caracteres.")
        .optional(),
      actorId: z.coerce
        .number({ error: "El actor debe ser un ID válido." })
        .int("El actor debe ser un ID válido.")
        .positive("El actor debe ser un ID válido.")
        .optional(),
      entityType: z
        .string({ error: "El tipo de entidad debe ser un texto." })
        .trim()
        .min(1, "El tipo de entidad no puede estar vacío.")
        .max(40, "El tipo de entidad no puede tener más de 40 caracteres.")
        .optional(),
      entityId: z.coerce
        .number({ error: "La entidad debe ser un ID válido." })
        .int("La entidad debe ser un ID válido.")
        .positive("La entidad debe ser un ID válido.")
        .optional(),
      from: z.coerce.date({ error: "La fecha desde no es válida." }).optional(),
      to: z.coerce.date({ error: "La fecha hasta no es válida." }).optional(),
    },
    { error: strictQueryError },
  )
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      query.from <= query.to,
    {
      message: "La fecha desde no puede ser posterior a la fecha hasta.",
      path: ["from"],
    },
  );
