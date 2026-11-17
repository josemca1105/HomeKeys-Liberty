import type { RequestHandler } from "express";
import { prisma } from "../config/database";
import { asyncHandler } from "../utils/async-handler";

// Liveness: the process is up and serving requests. It deliberately does not
// touch the database so a transient database outage does not restart the app.
export const health: RequestHandler = (_req, res): void => {
  res.status(200).json({
    success: true,
    message: "API en funcionamiento.",
    data: {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
};

// Readiness: the API can serve traffic, which requires a reachable database.
export const ready = asyncHandler(async (_req, res): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    res.status(503).json({
      success: false,
      code: "NOT_READY",
      message: "La API no está lista: la base de datos no responde.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "API lista para recibir tráfico.",
    data: { status: "ready" },
  });
});
