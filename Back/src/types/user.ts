import type { Role } from "@prisma/client";

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  photoUrl?: string | null;
  role?: Role;
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
