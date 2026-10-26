import { Router } from "express";
import { authRoutes } from "./auth-routes";
import { userRoutes } from "./user-routes";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/users", userRoutes);
