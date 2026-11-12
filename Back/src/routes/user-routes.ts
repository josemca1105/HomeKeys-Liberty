import { Router } from "express";
import {
  addUser,
  changeMyPassword,
  getCurrentUser,
  getUserById,
  getUsers,
  removeUser,
  updateUser,
} from "../controllers/user-controller";
import { authenticate } from "../middleware/authenticate";
import { enforcePasswordChange } from "../middleware/enforce-password-change";
import { isAdmin } from "../middleware/is-admin";
import {
  passwordChangeRateLimiter,
  userManagementRateLimiter,
} from "../middleware/rate-limiters";
import { validateParams } from "../middleware/validate-params";
import { validateRequest } from "../middleware/validate-request";
import {
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "../validators/user-validators";

export const userRoutes = Router();

userRoutes.post(
  "/add",
  authenticate,
  enforcePasswordChange,
  isAdmin,
  userManagementRateLimiter,
  validateRequest(createUserSchema),
  addUser,
);

userRoutes.get("/", authenticate, enforcePasswordChange, isAdmin, getUsers);
userRoutes.get("/me", authenticate, getCurrentUser);

userRoutes.patch(
  "/me/password",
  authenticate,
  validateRequest(changePasswordSchema),
  passwordChangeRateLimiter,
  changeMyPassword,
);

userRoutes.patch(
  "/:id",
  authenticate,
  enforcePasswordChange,
  isAdmin,
  userManagementRateLimiter,
  validateParams(userIdParamsSchema),
  validateRequest(updateUserSchema),
  updateUser,
);

userRoutes.delete(
  "/:id",
  authenticate,
  enforcePasswordChange,
  isAdmin,
  userManagementRateLimiter,
  validateParams(userIdParamsSchema),
  removeUser,
);

userRoutes.get(
  "/:id",
  authenticate,
  enforcePasswordChange,
  isAdmin,
  validateParams(userIdParamsSchema),
  getUserById,
);
