import type { Role } from "@prisma/client";
import type { UserResponse } from "./user";

export interface AuthTokenPayload {
  userId: number;
  role: Role;
  issuedAt: Date;
  expiresAt: Date;
}

export interface AuthSession extends AuthTokenPayload {
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface LoginResult {
  token: string;
  user: UserResponse;
}
