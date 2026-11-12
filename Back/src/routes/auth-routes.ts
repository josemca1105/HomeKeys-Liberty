import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  resetPassword,
} from "../controllers/auth-controller";
import { authenticate } from "../middleware/authenticate";
import {
  forgotPasswordEmailRateLimiter,
  forgotPasswordIpRateLimiter,
  loginAccountRateLimiter,
  loginIpRateLimiter,
  resetPasswordIpRateLimiter,
  resetPasswordTokenRateLimiter,
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
  loginIpRateLimiter,
  loginAccountRateLimiter,
  validateRequest(loginSchema),
  login,
);
authRoutes.post("/logout", authenticate, logout);

authRoutes.post(
  "/forgot-password",
  forgotPasswordIpRateLimiter,
  forgotPasswordEmailRateLimiter,
  validateRequest(forgotPasswordSchema),
  forgotPassword,
);
authRoutes.post(
  "/reset-password",
  resetPasswordIpRateLimiter,
  resetPasswordTokenRateLimiter,
  validateRequest(resetPasswordSchema),
  resetPassword,
);
