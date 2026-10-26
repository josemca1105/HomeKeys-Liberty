import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { environment } from "../config/env";
import type { AuthTokenPayload } from "../types/auth";

const TOKEN_EXPIRATION_SECONDS = 60 * 60;

export const generateAuthToken = (userId: number, role: Role): string => {
  return jwt.sign({ role }, environment.JWT_SECRET, {
    subject: userId.toString(),
    expiresIn: TOKEN_EXPIRATION_SECONDS,
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const decodedToken = jwt.verify(token, environment.JWT_SECRET);

  if (typeof decodedToken === "string") {
    throw new Error("Invalid token payload.");
  }

  const userId = Number(decodedToken.sub);
  const hasValidUserId = Number.isInteger(userId) && userId > 0;
  const hasValidRole =
    decodedToken.role === Role.ADMIN || decodedToken.role === Role.PARTNER;

  if (
    !hasValidUserId ||
    !hasValidRole ||
    typeof decodedToken.exp !== "number"
  ) {
    throw new Error("Invalid token payload.");
  }

  return {
    userId,
    role: decodedToken.role,
    expiresAt: new Date(decodedToken.exp * 1000),
  };
};
