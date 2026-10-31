import cors, { type CorsOptions } from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { environment } from "./config/env";
import { AppError } from "./utils/app-error";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found-handler";
import { apiRoutes } from "./routes";

const createCorsOptions = (): CorsOptions => {
  return {
    origin: (origin, callback): void => {
      if (!origin || environment.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError({
          statusCode: 403,
          code: "CORS_ORIGIN_DENIED",
          message: "El origen de la petición no está permitido.",
        }),
      );
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };
};

export const createApp = (): Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: "10kb" }));

  app.use("/api/v1", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
