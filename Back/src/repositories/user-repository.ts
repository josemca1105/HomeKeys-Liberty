import type { Prisma, Role, User } from "@prisma/client";
import { prisma } from "../config/database";

const userResponseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  photoUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserResponseRecord = Prisma.UserGetPayload<{
  select: typeof userResponseSelect;
}>;

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

export const findUserAuthorizationById = async (
  userId: number,
): Promise<Pick<User, "id" | "role"> | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
};

export const findAllUsers = async (): Promise<UserResponseRecord[]> => {
  return prisma.user.findMany({
    select: userResponseSelect,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
};

export const findUserById = async (
  userId: number,
): Promise<UserResponseRecord | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userResponseSelect,
  });
};

export const createUserRecord = async (
  userData: CreateUserData,
): Promise<User> => {
  return prisma.user.create({
    data: userData,
  });
};
