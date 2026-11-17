import { Router } from "express";
import { health, ready } from "../controllers/health-controller";

export const healthRoutes = Router();

healthRoutes.get("/health", health);
healthRoutes.get("/ready", ready);
