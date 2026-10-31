import { Prisma, Role } from "@prisma/client";
import type { RevokedToken, User } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../../src/config/database";
import type { CreateUserData } from "../../src/repositories/user-repository";

export const TEST_ADMIN_PASSWORD = "Admin-Test-Password1!";
export const TEST_PARTNER_PASSWORD = "Partner-Test-Password1!";
export const TEST_NEW_USER_PASSWORD = "New-User-Test-Password1!";

const ADMIN_PASSWORD_HASH = bcrypt.hashSync(TEST_ADMIN_PASSWORD, 4);
const PARTNER_PASSWORD_HASH = bcrypt.hashSync(TEST_PARTNER_PASSWORD, 4);

interface FindUserArgs {
  where: {
    email?: string;
    id?: number;
  };
}

interface CreateUserArgs {
  data: CreateUserData;
}

interface FindRevokedTokenArgs {
  where: {
    tokenHash: string;
  };
}

interface RevokeTokenArgs {
  data: {
    tokenHash: string;
    userId: number;
    expiresAt: Date;
  };
}

interface DeleteRevokedTokensArgs {
  where: {
    expiresAt?: {
      lte?: Date;
    };
  };
}

interface UserDelegateMock {
  findUnique: (args: FindUserArgs) => Promise<User | null>;
  create: (args: CreateUserArgs) => Promise<User>;
}

interface RevokedTokenDelegateMock {
  findUnique: (
    args: FindRevokedTokenArgs,
  ) => Promise<Pick<RevokedToken, "id"> | null>;
  create: (args: RevokeTokenArgs) => Promise<RevokedToken>;
  deleteMany: (args: DeleteRevokedTokensArgs) => Promise<{ count: number }>;
}

export interface MockDatabase {
  users: User[];
  revokedTokens: RevokedToken[];
  getUserCreateCallCount: () => number;
  failNextUserCreateWithDuplicateEmail: () => void;
}

const createUser = (
  id: number,
  email: string,
  role: Role,
  passwordHash: string,
): User => {
  return {
    id,
    firstName: "Test",
    lastName: role === Role.ADMIN ? "Administrator" : "Partner",
    email,
    passwordHash,
    phone: "00000000",
    photoUrl: null,
    role,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
};

export const createRevokedTokenFixture = (
  id: number,
  tokenHash: string,
  expiresAt: Date,
): RevokedToken => {
  return {
    id,
    tokenHash,
    userId: 1,
    expiresAt,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
};

export const createMockDatabase = (): MockDatabase => {
  const users: User[] = [
    createUser(1, "admin@example.com", Role.ADMIN, ADMIN_PASSWORD_HASH),
    createUser(2, "partner@example.com", Role.PARTNER, PARTNER_PASSWORD_HASH),
  ];
  const revokedTokens: RevokedToken[] = [];
  let shouldFailNextUserCreate = false;
  let userCreateCallCount = 0;

  const userDelegate = prisma.user as unknown as UserDelegateMock;
  const revokedTokenDelegate =
    prisma.revokedToken as unknown as RevokedTokenDelegateMock;

  userDelegate.findUnique = async (
    args: FindUserArgs,
  ): Promise<User | null> => {
    const user = users.find((candidate) => {
      if (args.where.email !== undefined) {
        return candidate.email === args.where.email;
      }

      if (args.where.id !== undefined) {
        return candidate.id === args.where.id;
      }

      return false;
    });

    return user ?? null;
  };

  userDelegate.create = async (args: CreateUserArgs): Promise<User> => {
    userCreateCallCount += 1;

    if (shouldFailNextUserCreate) {
      shouldFailNextUserCreate = false;
      throw new Prisma.PrismaClientKnownRequestError("Duplicate email", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["email"] },
      });
    }

    const nextId = Math.max(...users.map((user) => user.id)) + 1;
    const createdUser = createUser(
      nextId,
      args.data.email,
      args.data.role,
      args.data.passwordHash,
    );
    createdUser.firstName = args.data.firstName;
    createdUser.lastName = args.data.lastName;
    createdUser.phone = args.data.phone;
    createdUser.photoUrl = args.data.photoUrl;
    users.push(createdUser);
    return createdUser;
  };

  revokedTokenDelegate.findUnique = async (
    args: FindRevokedTokenArgs,
  ): Promise<Pick<RevokedToken, "id"> | null> => {
    const revokedToken = revokedTokens.find(
      (candidate) => candidate.tokenHash === args.where.tokenHash,
    );
    return revokedToken ? { id: revokedToken.id } : null;
  };

  revokedTokenDelegate.create = async (
    args: RevokeTokenArgs,
  ): Promise<RevokedToken> => {
    const revokedToken: RevokedToken = {
      id: revokedTokens.length + 1,
      ...args.data,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    revokedTokens.push(revokedToken);
    return revokedToken;
  };

  revokedTokenDelegate.deleteMany = async (
    args: DeleteRevokedTokensArgs,
  ): Promise<{ count: number }> => {
    const expiresBefore = args.where.expiresAt?.lte;
    const tokensToDelete = expiresBefore
      ? revokedTokens.filter(
          (token) => token.expiresAt.getTime() <= expiresBefore.getTime(),
        )
      : [...revokedTokens];
    const remainingTokens = expiresBefore
      ? revokedTokens.filter(
          (token) => token.expiresAt.getTime() > expiresBefore.getTime(),
        )
      : [];

    revokedTokens.splice(0, revokedTokens.length, ...remainingTokens);
    return { count: tokensToDelete.length };
  };

  return {
    users,
    revokedTokens,
    getUserCreateCallCount: (): number => userCreateCallCount,
    failNextUserCreateWithDuplicateEmail: (): void => {
      shouldFailNextUserCreate = true;
    },
  };
};
