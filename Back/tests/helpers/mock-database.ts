import { Prisma, Role } from "@prisma/client";
import type { PasswordResetToken, RevokedToken, User } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../../src/config/database";
import type {
  CreateUserData,
  UpdateUserData,
} from "../../src/repositories/user-repository";

export const TEST_ADMIN_PASSWORD = "Admin-Test-Password1!";
export const TEST_PARTNER_PASSWORD = "Partner-Test-Password1!";
export const TEST_NEW_USER_PASSWORD = "New-User-Test-Password1!";
export const TEST_CHANGED_PASSWORD = "Changed-Test-Password1!";

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

interface UpdateUserArgs {
  where: {
    id: number;
  };
  data: UpdateUserData;
}

interface DeleteUserArgs {
  where: {
    id: number;
  };
}

interface CountUsersArgs {
  where: {
    role?: Role;
  };
}

interface CountPropertiesArgs {
  where: {
    agentId: number;
  };
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
    userId?: number;
  };
}

interface FindPasswordResetTokenArgs {
  where: {
    tokenHash: string;
  };
}

interface CreatePasswordResetTokenArgs {
  data: {
    tokenHash: string;
    userId: number;
    expiresAt: Date;
  };
}

interface UpdatePasswordResetTokenArgs {
  where: {
    id: number;
  };
  data: {
    used?: boolean;
  };
}

interface DeletePasswordResetTokensArgs {
  where: {
    userId?: number;
    used?: boolean;
    expiresAt?: {
      lte?: Date;
    };
  };
}

interface FindManyUsersArgs {
  select?: Record<string, boolean>;
  orderBy?: Array<Record<string, string>>;
}

interface UserDelegateMock {
  findUnique: (args: FindUserArgs) => Promise<User | null>;
  findMany: (args: FindManyUsersArgs) => Promise<User[]>;
  create: (args: CreateUserArgs) => Promise<User>;
  update: (args: UpdateUserArgs) => Promise<User>;
  delete: (args: DeleteUserArgs) => Promise<User>;
  count: (args: CountUsersArgs) => Promise<number>;
}

interface PropertyDelegateMock {
  count: (args: CountPropertiesArgs) => Promise<number>;
}

interface RevokedTokenDelegateMock {
  findUnique: (
    args: FindRevokedTokenArgs,
  ) => Promise<Pick<RevokedToken, "id"> | null>;
  create: (args: RevokeTokenArgs) => Promise<RevokedToken>;
  deleteMany: (args: DeleteRevokedTokensArgs) => Promise<{ count: number }>;
}

interface PasswordResetTokenDelegateMock {
  findUnique: (
    args: FindPasswordResetTokenArgs,
  ) => Promise<PasswordResetToken | null>;
  create: (
    args: CreatePasswordResetTokenArgs,
  ) => Promise<PasswordResetToken>;
  update: (
    args: UpdatePasswordResetTokenArgs,
  ) => Promise<PasswordResetToken>;
  deleteMany: (
    args: DeletePasswordResetTokensArgs,
  ) => Promise<{ count: number }>;
}

interface TransactionClientMock {
  user: UserDelegateMock;
  property: PropertyDelegateMock;
  revokedToken: RevokedTokenDelegateMock;
  passwordResetToken: PasswordResetTokenDelegateMock;
}

export interface MockDatabase {
  users: User[];
  revokedTokens: RevokedToken[];
  passwordResetTokens: PasswordResetToken[];
  getUserCreateCallCount: () => number;
  getUserFindManyCallCount: () => number;
  setEmptyUserList: () => void;
  failNextUserCreateWithDuplicateEmail: () => void;
  addUser: (userData: {
    id: number;
    email: string;
    role: Role;
    password: string;
  }) => User;
  setAgentPropertyCount: (agentId: number, propertyCount: number) => void;
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
    passwordChangedAt: null,
  };
};

export const createRevokedTokenFixture = (
  id: number,
  tokenHash: string,
  expiresAt: Date,
  userId = 1,
): RevokedToken => {
  return {
    id,
    tokenHash,
    userId,
    expiresAt,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
};

export const createPasswordResetTokenFixture = (
  id: number,
  tokenHash: string,
  userId: number,
  expiresAt: Date,
): PasswordResetToken => {
  return {
    id,
    tokenHash,
    userId,
    expiresAt,
    used: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
};

export const createMockDatabase = (): MockDatabase => {
  const users: User[] = [
    createUser(1, "admin@example.com", Role.ADMIN, ADMIN_PASSWORD_HASH),
    createUser(2, "partner@example.com", Role.PARTNER, PARTNER_PASSWORD_HASH),
  ];
  const revokedTokens: RevokedToken[] = [];
  const passwordResetTokens: PasswordResetToken[] = [];
  const agentPropertyCounts = new Map<number, number>();
  let shouldFailNextUserCreate = false;
  let userCreateCallCount = 0;
  let userFindManyCallCount = 0;
  let shouldReturnEmptyUserList = false;

  const userDelegate = prisma.user as unknown as UserDelegateMock;
  const propertyDelegate = prisma.property as unknown as PropertyDelegateMock;
  const revokedTokenDelegate =
    prisma.revokedToken as unknown as RevokedTokenDelegateMock;
  const passwordResetTokenDelegate =
    prisma.passwordResetToken as unknown as PasswordResetTokenDelegateMock;

  const findUserRecord = (args: FindUserArgs): User | null => {
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

  userDelegate.findUnique = async (
    args: FindUserArgs,
  ): Promise<User | null> => {
    return findUserRecord(args);
  };

  userDelegate.findMany = async (_args: FindManyUsersArgs): Promise<User[]> => {
    userFindManyCallCount += 1;

    if (shouldReturnEmptyUserList) {
      return [];
    }

    return users.map((user) => ({ ...user }));
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

  userDelegate.update = async (args: UpdateUserArgs): Promise<User> => {
    const user = users.find((candidate) => candidate.id === args.where.id);

    if (!user) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    const duplicateEmailUser = users.find(
      (candidate) =>
        candidate.id !== user.id && candidate.email === args.data.email,
    );

    if (args.data.email !== undefined && duplicateEmailUser) {
      throw new Prisma.PrismaClientKnownRequestError("Duplicate email", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["email"] },
      });
    }

    Object.assign(user, args.data);
    return { ...user };
  };

  userDelegate.delete = async (args: DeleteUserArgs): Promise<User> => {
    const user = users.find((candidate) => candidate.id === args.where.id);

    if (!user) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    users.splice(users.indexOf(user), 1);
    return { ...user };
  };

  userDelegate.count = async (args: CountUsersArgs): Promise<number> => {
    return users.filter(
      (user) => args.where.role === undefined || user.role === args.where.role,
    ).length;
  };

  propertyDelegate.count = async (
    args: CountPropertiesArgs,
  ): Promise<number> => {
    return agentPropertyCounts.get(args.where.agentId) ?? 0;
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
    const matchesWhere = (token: RevokedToken): boolean => {
      if (
        args.where.userId !== undefined &&
        token.userId !== args.where.userId
      ) {
        return false;
      }

      const expiresBefore = args.where.expiresAt?.lte;

      if (
        expiresBefore !== undefined &&
        token.expiresAt.getTime() > expiresBefore.getTime()
      ) {
        return false;
      }

      return true;
    };

    const tokensToDelete = revokedTokens.filter(matchesWhere);
    const remainingTokens = revokedTokens.filter(
      (token) => !matchesWhere(token),
    );

    revokedTokens.splice(0, revokedTokens.length, ...remainingTokens);
    return { count: tokensToDelete.length };
  };

  passwordResetTokenDelegate.findUnique = async (
    args: FindPasswordResetTokenArgs,
  ): Promise<PasswordResetToken | null> => {
    const token = passwordResetTokens.find(
      (candidate) => candidate.tokenHash === args.where.tokenHash,
    );
    return token ? { ...token } : null;
  };

  passwordResetTokenDelegate.create = async (
    args: CreatePasswordResetTokenArgs,
  ): Promise<PasswordResetToken> => {
    const nextId =
      passwordResetTokens.length > 0
        ? Math.max(...passwordResetTokens.map((token) => token.id)) + 1
        : 1;
    const token: PasswordResetToken = {
      id: nextId,
      used: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...args.data,
    };
    passwordResetTokens.push(token);
    return { ...token };
  };

  passwordResetTokenDelegate.update = async (
    args: UpdatePasswordResetTokenArgs,
  ): Promise<PasswordResetToken> => {
    const token = passwordResetTokens.find(
      (candidate) => candidate.id === args.where.id,
    );

    if (!token) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    Object.assign(token, args.data);
    return { ...token };
  };

  passwordResetTokenDelegate.deleteMany = async (
    args: DeletePasswordResetTokensArgs,
  ): Promise<{ count: number }> => {
    const matchesWhere = (token: PasswordResetToken): boolean => {
      if (
        args.where.userId !== undefined &&
        token.userId !== args.where.userId
      ) {
        return false;
      }

      if (args.where.used !== undefined && token.used !== args.where.used) {
        return false;
      }

      const expiresBefore = args.where.expiresAt?.lte;

      if (
        expiresBefore !== undefined &&
        token.expiresAt.getTime() > expiresBefore.getTime()
      ) {
        return false;
      }

      return true;
    };

    const tokensToDelete = passwordResetTokens.filter(matchesWhere);
    const remainingTokens = passwordResetTokens.filter(
      (token) => !matchesWhere(token),
    );

    passwordResetTokens.splice(0, passwordResetTokens.length, ...remainingTokens);
    return { count: tokensToDelete.length };
  };

  const transactionClient: TransactionClientMock = {
    user: userDelegate,
    property: propertyDelegate,
    revokedToken: revokedTokenDelegate,
    passwordResetToken: passwordResetTokenDelegate,
  };

  const prismaWithTransaction = prisma as unknown as {
    $transaction: <T>(
      fn: (transaction: TransactionClientMock) => Promise<T>,
    ) => Promise<T>;
  };

  prismaWithTransaction.$transaction = async <T>(
    fn: (transaction: TransactionClientMock) => Promise<T>,
  ): Promise<T> => {
    return fn(transactionClient);
  };

  return {
    users,
    revokedTokens,
    passwordResetTokens,
    getUserCreateCallCount: (): number => userCreateCallCount,
    getUserFindManyCallCount: (): number => userFindManyCallCount,
    setEmptyUserList: (): void => {
      shouldReturnEmptyUserList = true;
    },
    failNextUserCreateWithDuplicateEmail: (): void => {
      shouldFailNextUserCreate = true;
    },
    addUser: ({
      id,
      email,
      role,
      password,
    }: {
      id: number;
      email: string;
      role: Role;
      password: string;
    }): User => {
      const user = createUser(id, email, role, bcrypt.hashSync(password, 4));
      users.push(user);
      return user;
    },
    setAgentPropertyCount: (agentId: number, propertyCount: number): void => {
      agentPropertyCounts.set(agentId, propertyCount);
    },
  };
};
