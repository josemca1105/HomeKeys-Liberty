import { Router } from "express";
import { addUser } from "../controllers/user-controller";
import { authenticate } from "../middleware/authenticate";
import { isAdmin } from "../middleware/is-admin";
import { validateRequest } from "../middleware/validate-request";
import { createUserSchema } from "../validators/user-validators";

export const userRoutes = Router();

userRoutes.post(
  "/add",
  authenticate,
  isAdmin,
  validateRequest(createUserSchema),
  addUser,
);
