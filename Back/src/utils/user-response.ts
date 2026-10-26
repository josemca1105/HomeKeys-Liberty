import type { User } from "@prisma/client";
import type { UserResponse } from "../types/user";

export const toUserResponse = (user: User): UserResponse => {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    photoUrl: user.photoUrl,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
