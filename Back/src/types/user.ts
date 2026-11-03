import type { Role } from "@prisma/client";

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone: string;
  photoUrl?: string | null;
  role?: Role;
}

export interface RegisterUserResult {
  user: UserResponse;
  temporaryPassword: string | null;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  photoUrl?: string | null;
  role?: Role;
  password?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UserUpdateResult {
  user: UserResponse;
  token: string | null;
}

export interface PasswordChangeResult {
  user: UserResponse;
  token: string;
}

export interface UserResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoUrl: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}
