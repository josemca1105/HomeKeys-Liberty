import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  resetPassword,
} from "../controllers/auth-controller";
import { authenticate } from "../middleware/authenticate";
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  resetPasswordRateLimiter,
} from "../middleware/rate-limiters";
import { validateRequest } from "../middleware/validate-request";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "../validators/auth-validators";

export const authRoutes = Router();

authRoutes.post(
  "/login",
  loginRateLimiter,
  validateRequest(loginSchema),
  login,
);
authRoutes.post("/logout", authenticate, logout);

authRoutes.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validateRequest(forgotPasswordSchema),
  forgotPassword,
);
authRoutes.post(
  "/reset-password",
  resetPasswordRateLimiter,
  validateRequest(resetPasswordSchema),
  resetPassword,
);
