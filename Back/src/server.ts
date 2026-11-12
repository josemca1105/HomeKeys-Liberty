import { createApp } from "./app";
import { prisma } from "./config/database";
import { environment } from "./config/env";
import { cleanupAuditLogsByRetention } from "./services/audit-retention-service";
import {
  cleanupExpiredPasswordResetTokens,
  cleanupExpiredRevokedTokens,
} from "./services/token-cleanup-service";

const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let isTokenCleanupRunning = false;

const runTokenCleanup = async (): Promise<void> => {
  if (isTokenCleanupRunning) {
    return;
  }

  isTokenCleanupRunning = true;

  try {
    const deletedRevokedTokens = await cleanupExpiredRevokedTokens();

    if (deletedRevokedTokens > 0) {
      console.log(`Removed ${deletedRevokedTokens} expired revoked tokens.`);
    }

    const deletedResetTokens = await cleanupExpiredPasswordResetTokens();

    if (deletedResetTokens > 0) {
      console.log(
        `Removed ${deletedResetTokens} expired password reset tokens.`,
      );
    }

    const deletedAuditLogs = await cleanupAuditLogsByRetention();

    if (deletedAuditLogs > 0) {
      console.log(`Removed ${deletedAuditLogs} expired audit logs.`);
    }
  } catch (error) {
    console.error("Failed to clean up expired tokens.", error);
  } finally {
    isTokenCleanupRunning = false;
  }
};

const startServer = async (): Promise<void> => {
  await prisma.$connect();
  await runTokenCleanup();

  const cleanupInterval = setInterval((): void => {
    void runTokenCleanup();
  }, TOKEN_CLEANUP_INTERVAL_MS);
  cleanupInterval.unref();

  const server = createApp().listen(environment.PORT, (): void => {
    console.log(`HomeKeys Liberty API listening on port ${environment.PORT}.`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received. Closing the server.`);
    clearInterval(cleanupInterval);

    server.close((): void => {
      void prisma
        .$disconnect()
        .then((): void => {
          process.exit(0);
        })
        .catch((error: unknown): void => {
          console.error("Failed to disconnect from the database.", error);
          process.exit(1);
        });
    });
  };

  process.on("SIGINT", (): void => shutdown("SIGINT"));
  process.on("SIGTERM", (): void => shutdown("SIGTERM"));
};

void startServer().catch(async (error: unknown): Promise<void> => {
  console.error("Failed to start the server.", error);
  await prisma.$disconnect();
  process.exit(1);
});
