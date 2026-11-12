import type { Prisma, Role, User } from "@prisma/client";
import { prisma } from "../config/database";

type UserRepositoryClient = Prisma.TransactionClient | typeof prisma;

const userResponseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  photoUrl: true,
  role: true,
  mustChangePassword: true,
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
  mustChangePassword: boolean;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  passwordHash?: string;
  phone?: string;
  photoUrl?: string | null;
  role?: Role;
  passwordChangedAt?: Date;
  mustChangePassword?: boolean;
}

export type UserCredentialsRecord = Pick<
  User,
  "id" | "role" | "passwordHash" | "passwordChangedAt"
>;

export const findUserByEmail = async (
  email: string,
): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const findUserAuthorizationById = async (
  userId: number,
): Promise<
  Pick<User, "id" | "role" | "passwordChangedAt" | "mustChangePassword"> | null
> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      passwordChangedAt: true,
      mustChangePassword: true,
    },
  });
};

export const findUserCredentialsById = async (
  userId: number,
): Promise<UserCredentialsRecord | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      passwordChangedAt: true,
    },
  });
};

export interface FindUsersPageOptions {
  where?: Prisma.UserWhereInput;
  orderBy?: Prisma.UserOrderByWithRelationInput[];
  skip?: number;
  take?: number;
}

export const findUsersPage = async ({
  where,
  orderBy,
  skip,
  take,
}: FindUsersPageOptions = {}): Promise<UserResponseRecord[]> => {
  return prisma.user.findMany({
    select: userResponseSelect,
    where,
    orderBy,
    skip,
    take,
  });
};

export const countUsers = async (
  where?: Prisma.UserWhereInput,
): Promise<number> => {
  return prisma.user.count({ where });
};

export const findUserById = async (
  userId: number,
  client: UserRepositoryClient = prisma,
): Promise<UserResponseRecord | null> => {
  return client.user.findUnique({
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

export const updateUserRecord = async (
  userId: number,
  userData: UpdateUserData,
  client: UserRepositoryClient = prisma,
): Promise<User> => {
  return client.user.update({
    where: { id: userId },
    data: userData,
  });
};

// Password and email changes invalidate every pending invitation or recovery
// link so a previously issued token cannot be used to take over the account.
export const updateUserAndInvalidateResetTokens = async (
  userId: number,
  userData: UpdateUserData,
  transaction?: Prisma.TransactionClient,
): Promise<User> => {
  if (!transaction) {
    return prisma.$transaction((currentTransaction) =>
      updateUserAndInvalidateResetTokens(
        userId,
        userData,
        currentTransaction,
      ),
    );
  }

  // Token rows are locked before the user row to keep the same lock order
  // as password resets and avoid PostgreSQL deadlocks.
  await transaction.passwordResetToken.deleteMany({
    where: { userId },
  });

  return transaction.user.update({
    where: { id: userId },
    data: userData,
  });
};

export const countUsersByRole = async (
  role: Role,
  client: UserRepositoryClient = prisma,
): Promise<number> => {
  return client.user.count({
    where: { role },
  });
};

export const countPropertiesByAgentId = async (
  agentId: number,
  client: UserRepositoryClient = prisma,
): Promise<number> => {
  return client.property.count({
    where: { agentId },
  });
};

export const deleteUserWithRelatedTokens = async (
  userId: number,
  transaction?: Prisma.TransactionClient,
): Promise<void> => {
  if (!transaction) {
    await prisma.$transaction((currentTransaction) =>
      deleteUserWithRelatedTokens(userId, currentTransaction),
    );
    return;
  }

  await transaction.revokedToken.deleteMany({
    where: { userId },
  });
  await transaction.passwordResetToken.deleteMany({
    where: { userId },
  });
  await transaction.user.delete({
    where: { id: userId },
  });
};
