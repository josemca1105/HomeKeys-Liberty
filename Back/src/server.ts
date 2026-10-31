import { createApp } from "./app";
import { prisma } from "./config/database";
import { environment } from "./config/env";
import { cleanupExpiredRevokedTokens } from "./services/token-cleanup-service";

const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let isTokenCleanupRunning = false;

const runRevokedTokenCleanup = async (): Promise<void> => {
  if (isTokenCleanupRunning) {
    return;
  }

  isTokenCleanupRunning = true;

  try {
    const deletedTokens = await cleanupExpiredRevokedTokens();

    if (deletedTokens > 0) {
      console.log(`Removed ${deletedTokens} expired revoked tokens.`);
    }
  } catch (error) {
    console.error("Failed to clean up expired revoked tokens.", error);
  } finally {
    isTokenCleanupRunning = false;
  }
};

const startServer = async (): Promise<void> => {
  await prisma.$connect();
  await runRevokedTokenCleanup();

  const cleanupInterval = setInterval((): void => {
    void runRevokedTokenCleanup();
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
