import { Role } from "@prisma/client";
import { listAuditLogs } from "../services/audit-service";
import type { AuditLogQuery } from "../types/audit";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

export const getAuditLogs = asyncHandler(async (req, res): Promise<void> => {
  const session = req.auth;

  if (!session) {
    throw new AppError({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Debes iniciar sesión para acceder a este recurso.",
    });
  }

  const query = req.validatedQuery as AuditLogQuery;
  const scopedQuery: AuditLogQuery =
    session.role === Role.ADMIN
      ? query
      : { ...query, actorId: session.userId };

  const { logs, pagination } = await listAuditLogs(scopedQuery);

  res.status(200).json({
    success: true,
    message: "Historial obtenido exitosamente.",
    data: { logs, pagination },
  });
});
