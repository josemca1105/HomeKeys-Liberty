import type { Role, User } from "@prisma/client";
import { prisma } from "../config/database";

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone: string;
  photoUrl: string | null;
  role: Role;
}

export const findUserByEmail = async (
  email: string,
): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const createUserRecord = async (
  userData: CreateUserData,
): Promise<User> => {
  return prisma.user.create({
    data: userData,
  });
};
