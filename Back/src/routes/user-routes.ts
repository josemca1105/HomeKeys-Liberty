import { Router } from "express";
import {
  addUser,
  getCurrentUser,
  getUserById,
  getUsers,
} from "../controllers/user-controller";
import { authenticate } from "../middleware/authenticate";
import { isAdmin } from "../middleware/is-admin";
import { validateParams } from "../middleware/validate-params";
import { validateRequest } from "../middleware/validate-request";
import {
  createUserSchema,
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

userRoutes.get(
  "/:id",
  authenticate,
  isAdmin,
  validateParams(userIdParamsSchema),
  getUserById,
);
