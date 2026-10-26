import { createApp } from "./app";
import { prisma } from "./config/database";
import { environment } from "./config/env";

const startServer = async (): Promise<void> => {
  await prisma.$connect();

  const server = createApp().listen(environment.PORT, (): void => {
    console.log(`HomeKeys Liberty API listening on port ${environment.PORT}.`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received. Closing the server.`);

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
