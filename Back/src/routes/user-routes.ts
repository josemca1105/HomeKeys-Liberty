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
import { isAdmin } from "../middleware/is-admin";
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
  isAdmin,
  validateRequest(createUserSchema),
  addUser,
);

userRoutes.get("/", authenticate, isAdmin, getUsers);
userRoutes.get("/me", authenticate, getCurrentUser);

userRoutes.patch(
  "/me/password",
  authenticate,
  validateRequest(changePasswordSchema),
  changeMyPassword,
);

userRoutes.patch(
  "/:id",
  authenticate,
  isAdmin,
  validateParams(userIdParamsSchema),
  validateRequest(updateUserSchema),
  updateUser,
);

userRoutes.delete(
  "/:id",
  authenticate,
  isAdmin,
  validateParams(userIdParamsSchema),
  removeUser,
);

userRoutes.get(
  "/:id",
  authenticate,
  isAdmin,
  validateParams(userIdParamsSchema),
  getUserById,
);
