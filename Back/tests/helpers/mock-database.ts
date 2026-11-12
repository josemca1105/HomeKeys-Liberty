import { Prisma, Role } from "@prisma/client";
import type {
  AuditLog,
  AuditScope,
  PasswordResetToken,
  RevokedToken,
  User,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../../src/config/database";

// The automated suite must never reach the real SMTP transport.
process.env.NODE_ENV = "test";
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

interface UserWhereMock {
  role?: Role;
  OR?: Array<{
    firstName?: { contains: string; mode?: string };
    lastName?: { contains: string; mode?: string };
    email?: { contains: string; mode?: string };
    phone?: { contains: string; mode?: string };
  }>;
}

interface CountUsersArgs {
  where?: UserWhereMock;
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

interface CreateManyRevokedTokensArgs {
  data: Array<{
    tokenHash: string;
    userId: number;
    expiresAt: Date;
  }>;
  skipDuplicates?: boolean;
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

interface UpdateManyPasswordResetTokensArgs {
  where: {
    id?: number;
    userId?: number;
    used?: boolean;
    expiresAt?: {
      gt?: Date;
    };
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
  where?: UserWhereMock;
  orderBy?: Array<Record<string, string>>;
  skip?: number;
  take?: number;
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
  createMany: (
    args: CreateManyRevokedTokensArgs,
  ) => Promise<{ count: number }>;
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
  updateMany: (
    args: UpdateManyPasswordResetTokensArgs,
  ) => Promise<{ count: number }>;
  deleteMany: (
    args: DeletePasswordResetTokensArgs,
  ) => Promise<{ count: number }>;
}

interface AuditLogWhereMock {
  scope?: AuditScope;
  action?: string;
  actorId?: number;
  entityType?: string;
  entityId?: number;
  createdAt?: {
    gte?: Date;
    lte?: Date;
    lt?: Date;
  };
}

interface CreateAuditLogArgs {
  data: {
    scope: AuditScope;
    actorId: number | null;
    actorRole: Role | null;
    actorEmail: string | null;
    action: string;
    entityType: string | null;
    entityId: number | null;
    changes?: Prisma.InputJsonValue;
    ip: string | null;
    userAgent: string | null;
    requestId: string | null;
  };
}

interface AuditLogDelegateMock {
  create: (args: CreateAuditLogArgs) => Promise<AuditLog>;
  findMany: (args: {
    where?: AuditLogWhereMock;
    orderBy?: Array<Record<string, string>>;
    skip?: number;
    take?: number;
  }) => Promise<AuditLog[]>;
  count: (args: { where?: AuditLogWhereMock }) => Promise<number>;
  deleteMany: (args: {
    where: { createdAt?: { lt?: Date } };
  }) => Promise<{ count: number }>;
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
  auditLogs: AuditLog[];
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
    mustChangePassword: false,
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
  const auditLogs: AuditLog[] = [];
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
  const auditLogDelegate =
    prisma.auditLog as unknown as AuditLogDelegateMock;

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

  const matchesUserWhere = (
    user: User,
    where: UserWhereMock | undefined,
  ): boolean => {
    if (where === undefined) {
      return true;
    }

    if (where.role !== undefined && user.role !== where.role) {
      return false;
    }

    if (where.OR !== undefined) {
      const matchesAny = where.OR.some((condition) => {
        for (const [field, filter] of Object.entries(condition)) {
          if (
            filter === undefined ||
            typeof filter !== "object" ||
            filter === null ||
            !("contains" in filter)
          ) {
            continue;
          }

          const value = user[field as keyof User];

          if (
            typeof value === "string" &&
            value.toLowerCase().includes(filter.contains.toLowerCase())
          ) {
            return true;
          }
        }

        return false;
      });

      if (!matchesAny) {
        return false;
      }
    }

    return true;
  };

  const compareUserValues = (first: unknown, second: unknown): number => {
    if (first instanceof Date && second instanceof Date) {
      return first.getTime() - second.getTime();
    }

    if (typeof first === "number" && typeof second === "number") {
      return first - second;
    }

    return String(first).localeCompare(String(second));
  };

  const sortUsers = (
    candidates: User[],
    orderBy: Array<Record<string, string>>,
  ): User[] => {
    return [...candidates].sort((first, second) => {
      for (const order of orderBy) {
        const entry = Object.entries(order)[0];

        if (entry === undefined) {
          continue;
        }

        const [field, direction] = entry;
        const comparison = compareUserValues(
          first[field as keyof User],
          second[field as keyof User],
        );

        if (comparison !== 0) {
          return direction === "desc" ? -comparison : comparison;
        }
      }

      return 0;
    });
  };

  userDelegate.findMany = async (args: FindManyUsersArgs): Promise<User[]> => {
    userFindManyCallCount += 1;

    if (shouldReturnEmptyUserList) {
      return [];
    }

    const matchingUsers = users.filter((user) =>
      matchesUserWhere(user, args.where),
    );
    const orderedUsers = args.orderBy
      ? sortUsers(matchingUsers, args.orderBy)
      : matchingUsers;
    const skip = args.skip ?? 0;
    const take = args.take ?? orderedUsers.length;

    return orderedUsers
      .slice(skip, skip + take)
      .map((user) => ({ ...user }));
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
    createdUser.mustChangePassword = args.data.mustChangePassword;
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
    if (shouldReturnEmptyUserList) {
      return 0;
    }

    return users.filter((user) => matchesUserWhere(user, args.where)).length;
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

  revokedTokenDelegate.createMany = async (
    args: CreateManyRevokedTokensArgs,
  ): Promise<{ count: number }> => {
    let createdCount = 0;

    for (const tokenData of args.data) {
      const existingToken = revokedTokens.find(
        (token) => token.tokenHash === tokenData.tokenHash,
      );

      if (existingToken) {
        if (args.skipDuplicates) {
          continue;
        }

        throw new Prisma.PrismaClientKnownRequestError("Duplicate token", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["token_hash"] },
        });
      }

      revokedTokens.push({
        id: revokedTokens.length + 1,
        ...tokenData,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      createdCount += 1;
    }

    return { count: createdCount };
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

  passwordResetTokenDelegate.updateMany = async (
    args: UpdateManyPasswordResetTokensArgs,
  ): Promise<{ count: number }> => {
    const matchesWhere = (token: PasswordResetToken): boolean => {
      if (args.where.id !== undefined && token.id !== args.where.id) {
        return false;
      }

      if (
        args.where.userId !== undefined &&
        token.userId !== args.where.userId
      ) {
        return false;
      }

      if (args.where.used !== undefined && token.used !== args.where.used) {
        return false;
      }

      const expiresAfter = args.where.expiresAt?.gt;

      if (
        expiresAfter !== undefined &&
        token.expiresAt.getTime() <= expiresAfter.getTime()
      ) {
        return false;
      }

      return true;
    };

    const tokensToUpdate = passwordResetTokens.filter(matchesWhere);

    for (const token of tokensToUpdate) {
      if (args.data.used !== undefined) {
        token.used = args.data.used;
      }
    }

    return { count: tokensToUpdate.length };
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

  const matchesAuditLogWhere = (
    log: AuditLog,
    where: AuditLogWhereMock | undefined,
  ): boolean => {
    if (where === undefined) {
      return true;
    }

    if (where.scope !== undefined && log.scope !== where.scope) {
      return false;
    }

    if (where.action !== undefined && log.action !== where.action) {
      return false;
    }

    if (where.actorId !== undefined && log.actorId !== where.actorId) {
      return false;
    }

    if (where.entityType !== undefined && log.entityType !== where.entityType) {
      return false;
    }

    if (where.entityId !== undefined && log.entityId !== where.entityId) {
      return false;
    }

    if (where.createdAt !== undefined) {
      if (
        where.createdAt.gte !== undefined &&
        log.createdAt.getTime() < where.createdAt.gte.getTime()
      ) {
        return false;
      }

      if (
        where.createdAt.lte !== undefined &&
        log.createdAt.getTime() > where.createdAt.lte.getTime()
      ) {
        return false;
      }

      if (
        where.createdAt.lt !== undefined &&
        log.createdAt.getTime() >= where.createdAt.lt.getTime()
      ) {
        return false;
      }
    }

    return true;
  };

  auditLogDelegate.create = async (
    args: CreateAuditLogArgs,
  ): Promise<AuditLog> => {
    const nextId =
      auditLogs.length > 0
        ? Math.max(...auditLogs.map((log) => log.id)) + 1
        : 1;

    const auditLog: AuditLog = {
      id: nextId,
      scope: args.data.scope,
      actorId: args.data.actorId,
      actorRole: args.data.actorRole,
      actorEmail: args.data.actorEmail,
      action: args.data.action,
      entityType: args.data.entityType,
      entityId: args.data.entityId,
      changes: (args.data.changes ?? null) as Prisma.JsonValue,
      ip: args.data.ip,
      userAgent: args.data.userAgent,
      requestId: args.data.requestId,
      createdAt: new Date(),
    };

    auditLogs.push(auditLog);
    return { ...auditLog };
  };

  auditLogDelegate.findMany = async (args): Promise<AuditLog[]> => {
    const matchingLogs = auditLogs.filter((log) =>
      matchesAuditLogWhere(log, args.where),
    );
    const orderedLogs = [...matchingLogs].sort(
      (first, second) =>
        second.createdAt.getTime() - first.createdAt.getTime() ||
        second.id - first.id,
    );
    const skip = args.skip ?? 0;
    const take = args.take ?? orderedLogs.length;

    return orderedLogs
      .slice(skip, skip + take)
      .map((log) => ({ ...log }));
  };

  auditLogDelegate.count = async (args): Promise<number> => {
    return auditLogs.filter((log) =>
      matchesAuditLogWhere(log, args.where),
    ).length;
  };

  auditLogDelegate.deleteMany = async (
    args,
  ): Promise<{ count: number }> => {
    const cutoff = args.where.createdAt?.lt;

    if (cutoff === undefined) {
      return { count: 0 };
    }

    const expiredLogs = auditLogs.filter(
      (log) => log.createdAt.getTime() < cutoff.getTime(),
    );
    const remainingLogs = auditLogs.filter(
      (log) => log.createdAt.getTime() >= cutoff.getTime(),
    );

    auditLogs.splice(0, auditLogs.length, ...remainingLogs);
    return { count: expiredLogs.length };
  };

  const transactionClient: TransactionClientMock = {
    user: userDelegate,
    property: propertyDelegate,
    revokedToken: revokedTokenDelegate,
    passwordResetToken: passwordResetTokenDelegate,
  };

  let serializableTransactionQueue: Promise<unknown> = Promise.resolve();

  const prismaWithTransaction = prisma as unknown as {
    $transaction: <T>(
      fn: (transaction: TransactionClientMock) => Promise<T>,
      options?: { isolationLevel?: string },
    ) => Promise<T>;
  };

  prismaWithTransaction.$transaction = async <T>(
    fn: (transaction: TransactionClientMock) => Promise<T>,
    options?: { isolationLevel?: string },
  ): Promise<T> => {
    if (options?.isolationLevel !== "Serializable") {
      return fn(transactionClient);
    }

    // Simulates PostgreSQL serializing concurrent serializable transactions
    // so the last-ADMIN race regression test is deterministic.
    const serializedRun = serializableTransactionQueue.then(() =>
      fn(transactionClient),
    );

    serializableTransactionQueue = serializedRun.then(
      () => undefined,
      () => undefined,
    );

    return serializedRun;
  };

  return {
    users,
    revokedTokens,
    passwordResetTokens,
    auditLogs,
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
