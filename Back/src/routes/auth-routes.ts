import { Router } from "express";
import { login, logout } from "../controllers/auth-controller";
import { authenticate } from "../middleware/authenticate";
import { validateRequest } from "../middleware/validate-request";
import { loginSchema } from "../validators/auth-validators";

export const authRoutes = Router();

authRoutes.post("/login", validateRequest(loginSchema), login);
authRoutes.post("/logout", authenticate, logout);
