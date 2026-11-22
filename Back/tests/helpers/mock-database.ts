import {
  Currency,
  Prisma,
  PropertyPhotoBatchStatus,
  PropertyPhotoUploadStatus,
  PropertyStatus,
  Role,
} from "@prisma/client";
import type {
  AuditLog,
  AuditScope,
  EmailOutbox,
  EmailOutboxStatus,
  EmailType,
  LoginAttempt,
  PasswordHistory,
  PasswordResetToken,
  Photo,
  Property,
  PropertyPhotoBatch,
  PropertyPhotoUpload,
  RevokedToken,
  User,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
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
  isActive?: boolean;
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

interface PropertyWhereMock {
  id?: number;
  agentId?: number;
  code?: string;
  deletedAt?: Date | null;
  status?: PropertyStatus | { in: PropertyStatus[] };
  propertyType?: string;
  listingType?: string;
  city?: string | { equals?: string; mode?: string };
  state?: string | { equals?: string; mode?: string };
  neighborhood?: { contains?: string; mode?: string };
  bedrooms?: { gte?: number };
  bathrooms?: { gte?: number };
  parkingSpaces?: { gte?: number };
  price?: { gte?: Prisma.Decimal; lte?: Prisma.Decimal };
  OR?: Array<Record<string, unknown>>;
}

interface CountPropertiesArgs {
  where: PropertyWhereMock;
}

interface FindPropertyArgs {
  where: PropertyWhereMock;
}

interface FindManyPropertiesArgs {
  where: PropertyWhereMock;
  orderBy?: Array<Record<string, "asc" | "desc">>;
  skip?: number;
  take?: number;
}

interface CreatePropertyArgs {
  data: Prisma.PropertyUncheckedCreateInput;
}

interface UpdatePropertyArgs {
  where: { id: number };
  data: Prisma.PropertyUncheckedUpdateInput;
}

interface PhotoWhereMock {
  id?: number;
  propertyId?: number | { in: number[] };
  isCover?: boolean;
}

interface FindManyPhotosArgs {
  where: PhotoWhereMock;
  orderBy?: Array<Record<string, "asc" | "desc">>;
}

interface CreatePhotoArgs {
  data: Prisma.PhotoUncheckedCreateInput;
}

interface UpdatePhotoArgs {
  where: { id: number };
  data: Prisma.PhotoUncheckedUpdateInput;
}

interface UpdateManyPhotosArgs {
  where: PhotoWhereMock;
  data: Partial<Photo>;
}

interface PhotoDelegateMock {
  findMany: (args: FindManyPhotosArgs) => Promise<Photo[]>;
  findFirst: (args: { where: PhotoWhereMock }) => Promise<Photo | null>;
  count: (args: { where: PhotoWhereMock }) => Promise<number>;
  create: (args: CreatePhotoArgs) => Promise<Photo>;
  update: (args: UpdatePhotoArgs) => Promise<Photo>;
  updateMany: (args: UpdateManyPhotosArgs) => Promise<{ count: number }>;
  delete: (args: { where: { id: number } }) => Promise<Photo>;
}

interface PhotoUploadWhereMock {
  id?: string | { in: string[] };
  batchId?: string;
  status?: PropertyPhotoUploadStatus;
}

interface PhotoBatchDelegateMock {
  create: (args: {
    data: { userId: number; expiresAt: Date };
  }) => Promise<PropertyPhotoBatch>;
  findUnique: (args: {
    where: { id: string };
    include?: { uploads: unknown };
  }) => Promise<
    (PropertyPhotoBatch & { uploads?: PropertyPhotoUpload[] }) | null
  >;
  findMany: (args: {
    where: {
      status: PropertyPhotoBatchStatus;
      expiresAt: { lte: Date };
    };
    include?: { uploads: unknown };
  }) => Promise<Array<PropertyPhotoBatch & { uploads: PropertyPhotoUpload[] }>>;
  update: (args: {
    where: { id: string };
    data: Partial<PropertyPhotoBatch>;
  }) => Promise<PropertyPhotoBatch>;
  delete: (args: { where: { id: string } }) => Promise<PropertyPhotoBatch>;
}

interface PhotoUploadDelegateMock {
  create: (args: {
    data: Prisma.PropertyPhotoUploadUncheckedCreateInput;
  }) => Promise<PropertyPhotoUpload>;
  findMany: (args: {
    where: PhotoUploadWhereMock;
    orderBy?: Array<Record<string, "asc" | "desc">>;
  }) => Promise<PropertyPhotoUpload[]>;
  findFirst: (args: {
    where: PhotoUploadWhereMock;
  }) => Promise<PropertyPhotoUpload | null>;
  update: (args: {
    where: { id: string };
    data: Partial<PropertyPhotoUpload>;
  }) => Promise<PropertyPhotoUpload>;
  updateMany: (args: {
    where: PhotoUploadWhereMock;
    data: Partial<PropertyPhotoUpload>;
  }) => Promise<{ count: number }>;
  delete: (args: { where: { id: string } }) => Promise<PropertyPhotoUpload>;
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
  findMany: (args: FindManyPropertiesArgs) => Promise<Property[]>;
  findFirst: (args: FindPropertyArgs) => Promise<Property | null>;
  create: (args: CreatePropertyArgs) => Promise<Property>;
  update: (args: UpdatePropertyArgs) => Promise<Property>;
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
  photo: PhotoDelegateMock;
  propertyPhotoBatch: PhotoBatchDelegateMock;
  propertyPhotoUpload: PhotoUploadDelegateMock;
  revokedToken: RevokedTokenDelegateMock;
  passwordResetToken: PasswordResetTokenDelegateMock;
  loginAttempt: LoginAttemptDelegateMock;
  auditLog: AuditLogDelegateMock;
  passwordHistory: PasswordHistoryDelegateMock;
  emailOutbox: EmailOutboxDelegateMock;
}

interface LoginAttemptDelegateMock {
  findUnique: (args: {
    where: { email: string };
  }) => Promise<LoginAttempt | null>;
  upsert: (args: {
    where: { email: string };
    create: {
      email: string;
      failedAttempts: number;
      lockedUntil: Date | null;
    };
    update: {
      failedAttempts: number;
      lockedUntil: Date | null;
    };
  }) => Promise<LoginAttempt>;
  deleteMany: (args: {
    where: {
      email?: string;
      updatedAt?: { lt?: Date };
    };
  }) => Promise<{ count: number }>;
}

interface PasswordHistoryDelegateMock {
  create: (args: {
    data: { userId: number; passwordHash: string };
  }) => Promise<PasswordHistory>;
  findMany: (args: {
    where: { userId: number };
    orderBy?: Array<Record<string, string>>;
    skip?: number;
    take?: number;
    select?: { passwordHash?: boolean; id?: boolean };
  }) => Promise<Array<Partial<PasswordHistory>>>;
  deleteMany: (args: {
    where: { id: { in: number[] } };
  }) => Promise<{ count: number }>;
}

interface EmailOutboxWhereMock {
  id?: number;
  status?:
    | EmailOutboxStatus
    | { in: EmailOutboxStatus[] };
  nextAttemptAt?: { lte?: Date };
  lockedAt?: { lt?: Date };
  createdAt?: { lt?: Date };
}

interface EmailOutboxDelegateMock {
  create: (args: {
    data: {
      type: EmailType;
      to: string;
      payload: Prisma.InputJsonValue;
      maxAttempts?: number;
      nextAttemptAt?: Date;
    };
  }) => Promise<EmailOutbox>;
  findMany: (args: {
    where: EmailOutboxWhereMock;
    orderBy?: Array<Record<string, string>>;
    take?: number;
  }) => Promise<EmailOutbox[]>;
  updateMany: (args: {
    where: EmailOutboxWhereMock;
    data: Partial<EmailOutbox>;
  }) => Promise<{ count: number }>;
  update: (args: {
    where: { id: number };
    data: Partial<EmailOutbox>;
  }) => Promise<EmailOutbox>;
  deleteMany: (args: {
    where: EmailOutboxWhereMock;
  }) => Promise<{ count: number }>;
}

export interface MockDatabase {
  users: User[];
  properties: Property[];
  photos: Photo[];
  propertyPhotoBatches: PropertyPhotoBatch[];
  propertyPhotoUploads: PropertyPhotoUpload[];
  revokedTokens: RevokedToken[];
  passwordResetTokens: PasswordResetToken[];
  loginAttempts: LoginAttempt[];
  passwordHistory: PasswordHistory[];
  emailOutbox: EmailOutbox[];
  auditLogs: AuditLog[];
  getUserCreateCallCount: () => number;
  getUserFindManyCallCount: () => number;
  setEmptyUserList: () => void;
  failNextUserCreateWithDuplicateEmail: () => void;
  failNextAuditLogCreate: () => void;
  failNextDatabaseCheck: () => void;
  addUser: (userData: {
    id: number;
    email: string;
    role: Role;
    password: string;
  }) => User;
  setAgentPropertyCount: (agentId: number, propertyCount: number) => void;
  addReadyPhotoBatch: (
    userId: number,
    count?: number,
  ) => {
    batch: PropertyPhotoBatch;
    uploads: PropertyPhotoUpload[];
  };
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
    isActive: true,
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
  const properties: Property[] = [];
  const photos: Photo[] = [];
  const propertyPhotoBatches: PropertyPhotoBatch[] = [];
  const propertyPhotoUploads: PropertyPhotoUpload[] = [];
  const revokedTokens: RevokedToken[] = [];
  const passwordResetTokens: PasswordResetToken[] = [];
  const loginAttempts: LoginAttempt[] = [];
  const passwordHistoryEntries: PasswordHistory[] = [];
  const emailOutboxEntries: EmailOutbox[] = [];
  const auditLogs: AuditLog[] = [];
  const agentPropertyCounts = new Map<number, number>();
  let shouldFailNextUserCreate = false;
  let shouldFailNextAuditLogCreate = false;
  let shouldFailNextDatabaseCheck = false;
  let userCreateCallCount = 0;
  let userFindManyCallCount = 0;
  let shouldReturnEmptyUserList = false;

  const userDelegate = prisma.user as unknown as UserDelegateMock;
  const propertyDelegate = prisma.property as unknown as PropertyDelegateMock;
  const photoDelegate = prisma.photo as unknown as PhotoDelegateMock;
  const photoBatchDelegate =
    prisma.propertyPhotoBatch as unknown as PhotoBatchDelegateMock;
  const photoUploadDelegate =
    prisma.propertyPhotoUpload as unknown as PhotoUploadDelegateMock;
  const revokedTokenDelegate =
    prisma.revokedToken as unknown as RevokedTokenDelegateMock;
  const passwordResetTokenDelegate =
    prisma.passwordResetToken as unknown as PasswordResetTokenDelegateMock;
  const auditLogDelegate =
    prisma.auditLog as unknown as AuditLogDelegateMock;
  const loginAttemptDelegate =
    prisma.loginAttempt as unknown as LoginAttemptDelegateMock;
  const passwordHistoryDelegate =
    prisma.passwordHistory as unknown as PasswordHistoryDelegateMock;

  passwordHistoryDelegate.create = async (args): Promise<PasswordHistory> => {
    const nextId =
      passwordHistoryEntries.length > 0
        ? Math.max(...passwordHistoryEntries.map((entry) => entry.id)) + 1
        : 1;

    const entry: PasswordHistory = {
      id: nextId,
      userId: args.data.userId,
      passwordHash: args.data.passwordHash,
      createdAt: new Date(),
    };
    passwordHistoryEntries.push(entry);
    return { ...entry };
  };

  passwordHistoryDelegate.findMany = async (args) => {
    const ordered = passwordHistoryEntries
      .filter((entry) => entry.userId === args.where.userId)
      .sort((first, second) => {
        const byDate =
          second.createdAt.getTime() - first.createdAt.getTime();
        return byDate !== 0 ? byDate : second.id - first.id;
      });
    const skip = args.skip ?? 0;
    const take = args.take ?? ordered.length;
    const selected = ordered.slice(skip, skip + take);

    return selected.map((entry) => {
      const projection: Partial<PasswordHistory> = {};

      if (args.select?.passwordHash) {
        projection.passwordHash = entry.passwordHash;
      }

      if (args.select?.id) {
        projection.id = entry.id;
      }

      return Object.keys(projection).length > 0 ? projection : { ...entry };
    });
  };

  passwordHistoryDelegate.deleteMany = async (args) => {
    const ids = new Set(args.where.id.in);
    const previousCount = passwordHistoryEntries.length;
    const remaining = passwordHistoryEntries.filter(
      (entry) => !ids.has(entry.id),
    );

    passwordHistoryEntries.splice(
      0,
      passwordHistoryEntries.length,
      ...remaining,
    );
    return { count: previousCount - remaining.length };
  };

  const emailOutboxDelegate =
    prisma.emailOutbox as unknown as EmailOutboxDelegateMock;

  const matchesEmailOutboxWhere = (
    entry: EmailOutbox,
    where: EmailOutboxWhereMock,
  ): boolean => {
    if (where.id !== undefined && entry.id !== where.id) {
      return false;
    }

    if (where.status !== undefined) {
      if (typeof where.status === "string") {
        if (entry.status !== where.status) {
          return false;
        }
      } else if (!where.status.in.includes(entry.status)) {
        return false;
      }
    }

    const nextAttemptBefore = where.nextAttemptAt?.lte;

    if (
      nextAttemptBefore !== undefined &&
      entry.nextAttemptAt.getTime() > nextAttemptBefore.getTime()
    ) {
      return false;
    }

    const lockedBefore = where.lockedAt?.lt;

    if (
      lockedBefore !== undefined &&
      (entry.lockedAt === null || entry.lockedAt.getTime() >= lockedBefore.getTime())
    ) {
      return false;
    }

    const createdBefore = where.createdAt?.lt;

    if (
      createdBefore !== undefined &&
      entry.createdAt.getTime() >= createdBefore.getTime()
    ) {
      return false;
    }

    return true;
  };

  emailOutboxDelegate.create = async (args): Promise<EmailOutbox> => {
    const nextId =
      emailOutboxEntries.length > 0
        ? Math.max(...emailOutboxEntries.map((entry) => entry.id)) + 1
        : 1;
    const now = new Date();
    const entry: EmailOutbox = {
      id: nextId,
      type: args.data.type,
      to: args.data.to,
      payload: args.data.payload as EmailOutbox["payload"],
      status: "PENDING",
      attempts: 0,
      maxAttempts: args.data.maxAttempts ?? 5,
      nextAttemptAt: args.data.nextAttemptAt ?? now,
      lockedAt: null,
      lastError: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    emailOutboxEntries.push(entry);
    return { ...entry };
  };

  emailOutboxDelegate.findMany = async (args): Promise<EmailOutbox[]> => {
    const matching = emailOutboxEntries
      .filter((entry) => matchesEmailOutboxWhere(entry, args.where))
      .sort((first, second) => {
        const byNextAttempt =
          first.nextAttemptAt.getTime() - second.nextAttemptAt.getTime();
        return byNextAttempt !== 0 ? byNextAttempt : first.id - second.id;
      });
    const limited =
      args.take !== undefined ? matching.slice(0, args.take) : matching;

    return limited.map((entry) => ({ ...entry }));
  };

  emailOutboxDelegate.updateMany = async (
    args,
  ): Promise<{ count: number }> => {
    const matching = emailOutboxEntries.filter((entry) =>
      matchesEmailOutboxWhere(entry, args.where),
    );

    for (const entry of matching) {
      Object.assign(entry, args.data, { updatedAt: new Date() });
    }

    return { count: matching.length };
  };

  emailOutboxDelegate.update = async (args): Promise<EmailOutbox> => {
    const entry = emailOutboxEntries.find(
      (candidate) => candidate.id === args.where.id,
    );

    if (!entry) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    Object.assign(entry, args.data, { updatedAt: new Date() });
    return { ...entry };
  };

  emailOutboxDelegate.deleteMany = async (
    args,
  ): Promise<{ count: number }> => {
    const previousCount = emailOutboxEntries.length;
    const remaining = emailOutboxEntries.filter(
      (entry) => !matchesEmailOutboxWhere(entry, args.where),
    );

    emailOutboxEntries.splice(
      0,
      emailOutboxEntries.length,
      ...remaining,
    );
    return { count: previousCount - remaining.length };
  };

  loginAttemptDelegate.findUnique = async (
    args,
  ): Promise<LoginAttempt | null> => {
    return (
      loginAttempts.find((attempt) => attempt.email === args.where.email) ??
      null
    );
  };

  loginAttemptDelegate.upsert = async (args): Promise<LoginAttempt> => {
    const existing = loginAttempts.find(
      (attempt) => attempt.email === args.where.email,
    );

    if (existing) {
      existing.failedAttempts = args.update.failedAttempts;
      existing.lockedUntil = args.update.lockedUntil;
      existing.updatedAt = new Date();
      return { ...existing };
    }

    const created: LoginAttempt = {
      email: args.create.email,
      failedAttempts: args.create.failedAttempts,
      lockedUntil: args.create.lockedUntil,
      updatedAt: new Date(),
    };
    loginAttempts.push(created);
    return { ...created };
  };

  loginAttemptDelegate.deleteMany = async (
    args,
  ): Promise<{ count: number }> => {
    const previousCount = loginAttempts.length;
    const remaining = loginAttempts.filter((attempt) => {
      if (
        args.where.email !== undefined &&
        attempt.email !== args.where.email
      ) {
        return true;
      }

      const updatedBefore = args.where.updatedAt?.lt;

      if (
        updatedBefore !== undefined &&
        attempt.updatedAt.getTime() >= updatedBefore.getTime()
      ) {
        return true;
      }

      return false;
    });

    loginAttempts.splice(0, loginAttempts.length, ...remaining);
    return { count: previousCount - remaining.length };
  };

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

    if (
      where.isActive !== undefined &&
      user.isActive !== where.isActive
    ) {
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

  const asDecimal = (value: unknown): Prisma.Decimal => {
    if (value instanceof Prisma.Decimal) {
      return value;
    }

    if (typeof value === "number" || typeof value === "string") {
      return new Prisma.Decimal(value);
    }

    throw new Error("Invalid decimal value in property mock.");
  };

  const containsInsensitive = (
    value: string,
    expected: string,
  ): boolean => value.toLowerCase().includes(expected.toLowerCase());

  const matchesTextCondition = (
    value: string,
    condition: unknown,
  ): boolean => {
    if (typeof condition === "string") {
      return value === condition;
    }

    if (typeof condition === "object" && condition !== null) {
      const contains = (condition as { contains?: unknown }).contains;
      return typeof contains === "string"
        ? containsInsensitive(value, contains)
        : true;
    }

    return true;
  };

  const matchesOrCondition = (
    property: Property,
    condition: Record<string, unknown>,
  ): boolean => {
    return Object.entries(condition).some(([field, value]) => {
      if (field === "ownerPhone") {
        return matchesTextCondition(property.ownerPhone, value);
      }

      const propertyValue = (property as unknown as Record<string, unknown>)[
        field
      ];

      return typeof propertyValue === "string"
        ? matchesTextCondition(propertyValue, value)
        : false;
    });
  };

  const matchesPropertyWhere = (
    property: Property,
    where: PropertyWhereMock,
  ): boolean => {
    if (where.id !== undefined && property.id !== where.id) {
      return false;
    }

    if (where.agentId !== undefined && property.agentId !== where.agentId) {
      return false;
    }

    if (where.code !== undefined && property.code !== where.code) {
      return false;
    }

    if (where.deletedAt === null && property.deletedAt !== null) {
      return false;
    }

    if (
      where.deletedAt instanceof Date &&
      property.deletedAt?.getTime() !== where.deletedAt.getTime()
    ) {
      return false;
    }

    if (where.status !== undefined) {
      if (
        typeof where.status === "string" &&
        property.status !== where.status
      ) {
        return false;
      }

      if (
        typeof where.status === "object" &&
        !where.status.in.includes(property.status)
      ) {
        return false;
      }
    }

    if (
      where.propertyType !== undefined &&
      property.propertyType !== where.propertyType
    ) {
      return false;
    }

    if (
      where.listingType !== undefined &&
      property.listingType !== where.listingType
    ) {
      return false;
    }

    for (const field of ["city", "state"] as const) {
      const filter = where[field];

      if (filter === undefined) {
        continue;
      }

      const expected =
        typeof filter === "string"
          ? filter
          : filter.equals ?? "";
      const actual = property[field];

      if (
        expected !== "" &&
        (typeof filter === "string" || filter.mode === "insensitive"
          ? !containsInsensitive(actual, expected)
          : actual !== expected)
      ) {
        return false;
      }
    }

    if (
      where.neighborhood?.contains !== undefined &&
      !containsInsensitive(
        property.neighborhood ?? "",
        where.neighborhood.contains,
      )
    ) {
      return false;
    }

    for (const field of [
      "bedrooms",
      "bathrooms",
      "parkingSpaces",
    ] as const) {
      const minimum = where[field]?.gte;

      if (minimum !== undefined && property[field] < minimum) {
        return false;
      }
    }

    if (where.price?.gte !== undefined) {
      if (Number(property.price) < Number(where.price.gte)) {
        return false;
      }
    }

    if (where.price?.lte !== undefined) {
      if (Number(property.price) > Number(where.price.lte)) {
        return false;
      }
    }

    if (
      where.OR !== undefined &&
      !where.OR.some((condition) =>
        matchesOrCondition(property, condition),
      )
    ) {
      return false;
    }

    return true;
  };

  const compareOrderValues = (
    first: unknown,
    second: unknown,
  ): number => {
    if (first instanceof Date && second instanceof Date) {
      return first.getTime() - second.getTime();
    }

    if (
      typeof first === "object" &&
      first !== null &&
      "comparedTo" in first &&
      typeof (first as { comparedTo?: unknown }).comparedTo === "function"
    ) {
      return (
        first as { comparedTo: (value: unknown) => number }
      ).comparedTo(second);
    }

    if (typeof first === "number" && typeof second === "number") {
      return first - second;
    }

    return String(first).localeCompare(String(second));
  };

  const sortByOrder = <T extends Record<string, unknown>>(
    items: T[],
    orderBy: Array<Record<string, "asc" | "desc">> | undefined,
  ): T[] => {
    if (!orderBy) {
      return items;
    }

    return [...items].sort((first, second) => {
      for (const order of orderBy) {
        for (const [field, direction] of Object.entries(order)) {
          const comparison = compareOrderValues(first[field], second[field]);

          if (comparison !== 0) {
            return direction === "asc" ? comparison : -comparison;
          }
        }
      }

      return 0;
    });
  };

  propertyDelegate.findFirst = async (
    args: FindPropertyArgs,
  ): Promise<Property | null> => {
    const property = properties.find((candidate) =>
      matchesPropertyWhere(candidate, args.where),
    );

    return property ? { ...property } : null;
  };

  propertyDelegate.findMany = async (
    args: FindManyPropertiesArgs,
  ): Promise<Property[]> => {
    const matching = properties.filter((property) =>
      matchesPropertyWhere(property, args.where),
    );
    const sorted = sortByOrder(
      matching as unknown as Array<Record<string, unknown>>,
      args.orderBy,
    ) as unknown as Property[];
    const skip = args.skip ?? 0;
    const take = args.take ?? sorted.length;

    return sorted.slice(skip, skip + take).map((property) => ({
      ...property,
    }));
  };

  propertyDelegate.create = async (
    args: CreatePropertyArgs,
  ): Promise<Property> => {
    const nextId =
      properties.length > 0
        ? Math.max(...properties.map((property) => property.id)) + 1
        : 1;
    const now = new Date();
    const data = args.data;
    const property: Property = {
      id: nextId,
      agentId: data.agentId,
      code:
        typeof data.code === "string"
          ? data.code
          : `HK-${String(nextId).padStart(4, "0")}`,
      title: data.title,
      propertyType: data.propertyType,
      listingType: data.listingType,
      status: data.status ?? PropertyStatus.ACTIVE,
      description: data.description ?? null,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      ownerEmail: data.ownerEmail ?? null,
      address: data.address,
      neighborhood: data.neighborhood ?? null,
      city: data.city,
      state: data.state,
      latitude: asDecimal(data.latitude),
      longitude: asDecimal(data.longitude),
      price: asDecimal(data.price),
      currency: data.currency ?? Currency.USD,
      maintenanceFee:
        data.maintenanceFee === undefined || data.maintenanceFee === null
          ? null
          : asDecimal(data.maintenanceFee),
      isNegotiable: data.isNegotiable ?? false,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      parkingSpaces: data.parkingSpaces,
      squareMeters: asDecimal(data.squareMeters),
      lotSquareMeters:
        data.lotSquareMeters === undefined || data.lotSquareMeters === null
          ? null
          : asDecimal(data.lotSquareMeters),
      yearBuilt: data.yearBuilt ?? null,
      apartmentFloor: data.apartmentFloor ?? null,
      hasWaterTank: data.hasWaterTank ?? false,
      hasPowerPlant: data.hasPowerPlant ?? false,
      isFurnished: data.isFurnished ?? false,
      allowsPets: data.allowsPets ?? false,
      hasPool: data.hasPool ?? false,
      hasGym: data.hasGym ?? false,
      hasBalcony: data.hasBalcony ?? false,
      hasAirConditioning: data.hasAirConditioning ?? false,
      hasSecurity: data.hasSecurity ?? false,
      hasElevator: data.hasElevator ?? false,
      videoUrl: data.videoUrl ?? null,
      virtualTourUrl: data.virtualTourUrl ?? null,
      closedAt:
        data.closedAt === undefined || data.closedAt === null
          ? null
          : new Date(data.closedAt),
      createdAt: data.createdAt instanceof Date ? data.createdAt : now,
      updatedAt: now,
      deletedAt: null,
    };

    properties.push(property);
    return { ...property };
  };

  propertyDelegate.update = async (
    args: UpdatePropertyArgs,
  ): Promise<Property> => {
    const property = properties.find(
      (candidate) => candidate.id === args.where.id,
    );

    if (!property) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    Object.assign(property, args.data, { updatedAt: new Date() });
    return { ...property };
  };

  propertyDelegate.count = async (
    args: CountPropertiesArgs,
  ): Promise<number> => {
    if (args.where.agentId !== undefined) {
      const manuallyConfiguredCount = agentPropertyCounts.get(
        args.where.agentId,
      );

      if (manuallyConfiguredCount !== undefined) {
        return manuallyConfiguredCount;
      }
    }

    return properties.filter((property) =>
      matchesPropertyWhere(property, args.where),
    ).length;
  };

  const matchesPhotoWhere = (photo: Photo, where: PhotoWhereMock): boolean => {
    if (where.id !== undefined && photo.id !== where.id) {
      return false;
    }

    if (typeof where.propertyId === "number") {
      if (photo.propertyId !== where.propertyId) {
        return false;
      }
    } else if (
      where.propertyId !== undefined &&
      !where.propertyId.in.includes(photo.propertyId)
    ) {
      return false;
    }

    if (where.isCover !== undefined && photo.isCover !== where.isCover) {
      return false;
    }

    return true;
  };

  photoDelegate.findMany = async (
    args: FindManyPhotosArgs,
  ): Promise<Photo[]> => {
    const matching = photos.filter((photo) =>
      matchesPhotoWhere(photo, args.where),
    );
    const sorted = sortByOrder(
      matching as unknown as Array<Record<string, unknown>>,
      args.orderBy,
    ) as unknown as Photo[];

    return sorted.map((photo) => ({ ...photo }));
  };

  photoDelegate.findFirst = async (args: {
    where: PhotoWhereMock;
  }): Promise<Photo | null> => {
    const photo = photos.find((candidate) =>
      matchesPhotoWhere(candidate, args.where),
    );

    return photo ? { ...photo } : null;
  };

  photoDelegate.count = async (args: {
    where: PhotoWhereMock;
  }): Promise<number> => {
    return photos.filter((photo) => matchesPhotoWhere(photo, args.where))
      .length;
  };

  photoDelegate.create = async (
    args: CreatePhotoArgs,
  ): Promise<Photo> => {
    const nextId =
      photos.length > 0
        ? Math.max(...photos.map((photo) => photo.id)) + 1
        : 1;
    const now = new Date();
    const photo: Photo = {
      id: nextId,
      propertyId: args.data.propertyId,
      storageKey: args.data.storageKey,
      mimeType: args.data.mimeType,
      sizeBytes: args.data.sizeBytes,
      width: args.data.width,
      height: args.data.height,
      altText: args.data.altText ?? null,
      sortOrder: args.data.sortOrder ?? 0,
      isCover: args.data.isCover ?? false,
      createdAt: now,
      updatedAt: now,
    };

    photos.push(photo);
    return { ...photo };
  };

  photoDelegate.update = async (
    args: UpdatePhotoArgs,
  ): Promise<Photo> => {
    const photo = photos.find((candidate) => candidate.id === args.where.id);

    if (!photo) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    Object.assign(photo, args.data, { updatedAt: new Date() });
    return { ...photo };
  };

  photoDelegate.updateMany = async (
    args: UpdateManyPhotosArgs,
  ): Promise<{ count: number }> => {
    const matching = photos.filter((photo) =>
      matchesPhotoWhere(photo, args.where),
    );

    for (const photo of matching) {
      Object.assign(photo, args.data, { updatedAt: new Date() });
    }

    return { count: matching.length };
  };

  photoDelegate.delete = async (args: {
    where: { id: number };
  }): Promise<Photo> => {
    const index = photos.findIndex((photo) => photo.id === args.where.id);

    if (index === -1) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    const [deleted] = photos.splice(index, 1);
    return { ...(deleted as Photo) };
  };

  const matchesPhotoUploadWhere = (
    upload: PropertyPhotoUpload,
    where: PhotoUploadWhereMock,
  ): boolean => {
    if (typeof where.id === "string" && upload.id !== where.id) {
      return false;
    }

    if (
      typeof where.id === "object" &&
      !where.id.in.includes(upload.id)
    ) {
      return false;
    }

    if (where.batchId !== undefined && upload.batchId !== where.batchId) {
      return false;
    }

    if (where.status !== undefined && upload.status !== where.status) {
      return false;
    }

    return true;
  };

  const orderedUploadsForBatch = (batchId: string): PropertyPhotoUpload[] => {
    return propertyPhotoUploads
      .filter((upload) => upload.batchId === batchId)
      .sort(
        (first, second) =>
          first.sortOrder - second.sortOrder ||
          first.createdAt.getTime() - second.createdAt.getTime(),
      );
  };

  photoBatchDelegate.create = async (
    args,
  ): Promise<PropertyPhotoBatch> => {
    const now = new Date();
    const batch: PropertyPhotoBatch = {
      id: randomUUID(),
      userId: args.data.userId,
      status: PropertyPhotoBatchStatus.OPEN,
      expiresAt: args.data.expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    propertyPhotoBatches.push(batch);
    return { ...batch };
  };

  photoBatchDelegate.findUnique = async (args) => {
    const batch = propertyPhotoBatches.find(
      (candidate) => candidate.id === args.where.id,
    );

    if (!batch) {
      return null;
    }

    if (args.include) {
      return {
        ...batch,
        uploads: orderedUploadsForBatch(batch.id).map((upload) => ({
          ...upload,
        })),
      };
    }

    return { ...batch };
  };

  photoBatchDelegate.findMany = async (args) => {
    return propertyPhotoBatches
      .filter(
        (batch) =>
          batch.status === args.where.status &&
          batch.expiresAt.getTime() <= args.where.expiresAt.lte.getTime(),
      )
      .map((batch) => ({
        ...batch,
        uploads: orderedUploadsForBatch(batch.id).map((upload) => ({
          ...upload,
        })),
      }));
  };

  photoBatchDelegate.update = async (args) => {
    const batch = propertyPhotoBatches.find(
      (candidate) => candidate.id === args.where.id,
    );

    if (!batch) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    Object.assign(batch, args.data, { updatedAt: new Date() });
    return { ...batch };
  };

  photoBatchDelegate.delete = async (args) => {
    const index = propertyPhotoBatches.findIndex(
      (batch) => batch.id === args.where.id,
    );

    if (index === -1) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    const [deleted] = propertyPhotoBatches.splice(index, 1);

    for (let i = propertyPhotoUploads.length - 1; i >= 0; i -= 1) {
      if (propertyPhotoUploads[i]?.batchId === args.where.id) {
        propertyPhotoUploads.splice(i, 1);
      }
    }

    return { ...(deleted as PropertyPhotoBatch) };
  };

  photoUploadDelegate.create = async (args) => {
    const now = new Date();
    const upload: PropertyPhotoUpload = {
      id: randomUUID(),
      batchId: args.data.batchId,
      storageKey: args.data.storageKey,
      mimeType: args.data.mimeType,
      sizeBytes: args.data.sizeBytes,
      width: args.data.width,
      height: args.data.height,
      altText: args.data.altText ?? null,
      sortOrder: args.data.sortOrder ?? 0,
      status: PropertyPhotoUploadStatus.READY,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    propertyPhotoUploads.push(upload);
    return { ...upload };
  };

  photoUploadDelegate.findMany = async (args) => {
    const matching = propertyPhotoUploads.filter((upload) =>
      matchesPhotoUploadWhere(upload, args.where),
    );
    const sorted = sortByOrder(
      matching as unknown as Array<Record<string, unknown>>,
      args.orderBy,
    ) as unknown as PropertyPhotoUpload[];

    return sorted.map((upload) => ({ ...upload }));
  };

  photoUploadDelegate.findFirst = async (args) => {
    const upload = propertyPhotoUploads.find((candidate) =>
      matchesPhotoUploadWhere(candidate, args.where),
    );

    return upload ? { ...upload } : null;
  };

  photoUploadDelegate.update = async (args) => {
    const upload = propertyPhotoUploads.find(
      (candidate) => candidate.id === args.where.id,
    );

    if (!upload) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    Object.assign(upload, args.data, { updatedAt: new Date() });
    return { ...upload };
  };

  photoUploadDelegate.updateMany = async (args) => {
    const matching = propertyPhotoUploads.filter((upload) =>
      matchesPhotoUploadWhere(upload, args.where),
    );

    for (const upload of matching) {
      Object.assign(upload, args.data, { updatedAt: new Date() });
    }

    return { count: matching.length };
  };

  photoUploadDelegate.delete = async (args) => {
    const index = propertyPhotoUploads.findIndex(
      (upload) => upload.id === args.where.id,
    );

    if (index === -1) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "6.19.3",
      });
    }

    const [deleted] = propertyPhotoUploads.splice(index, 1);
    return { ...(deleted as PropertyPhotoUpload) };
  };

  const createReadyPhotoBatch = (
    userId: number,
    count = 5,
  ): {
    batch: PropertyPhotoBatch;
    uploads: PropertyPhotoUpload[];
  } => {
    const now = new Date();
    const batch: PropertyPhotoBatch = {
      id: randomUUID(),
      userId,
      status: PropertyPhotoBatchStatus.OPEN,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    };
    propertyPhotoBatches.push(batch);
    const uploads: PropertyPhotoUpload[] = [];

    for (let index = 0; index < count; index += 1) {
      const upload: PropertyPhotoUpload = {
        id: randomUUID(),
        batchId: batch.id,
        storageKey: `property-photo-batches/${batch.id}/photos/${randomUUID()}.webp`,
        mimeType: "image/webp",
        sizeBytes: 100,
        width: 100,
        height: 100,
        altText: `Fixture ${index + 1}`,
        sortOrder: index,
        status: PropertyPhotoUploadStatus.READY,
        consumedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      propertyPhotoUploads.push(upload);
      uploads.push(upload);
    }

    return { batch: { ...batch }, uploads };
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
    if (shouldFailNextAuditLogCreate) {
      shouldFailNextAuditLogCreate = false;
      throw new Error("Audit storage unavailable");
    }

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
    photo: photoDelegate,
    propertyPhotoBatch: photoBatchDelegate,
    propertyPhotoUpload: photoUploadDelegate,
    revokedToken: revokedTokenDelegate,
    passwordResetToken: passwordResetTokenDelegate,
    loginAttempt: loginAttemptDelegate,
    auditLog: auditLogDelegate,
    passwordHistory: passwordHistoryDelegate,
    emailOutbox: emailOutboxDelegate,
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

  // The readiness probe runs a real `SELECT 1` against PostgreSQL; tests must
  // never connect, so the mock satisfies it locally and can force a failure.
  const prismaWithRawCheck = prisma as unknown as {
    $queryRaw: (...args: unknown[]) => Promise<unknown>;
  };

  prismaWithRawCheck.$queryRaw = async (): Promise<unknown> => {
    if (shouldFailNextDatabaseCheck) {
      shouldFailNextDatabaseCheck = false;
      throw new Error("Database unavailable");
    }

    return [{ "?column?": 1 }];
  };

  return {
    users,
    properties,
    photos,
    propertyPhotoBatches,
    propertyPhotoUploads,
    revokedTokens,
    passwordResetTokens,
    loginAttempts,
    passwordHistory: passwordHistoryEntries,
    emailOutbox: emailOutboxEntries,
    auditLogs,
    getUserCreateCallCount: (): number => userCreateCallCount,
    getUserFindManyCallCount: (): number => userFindManyCallCount,
    setEmptyUserList: (): void => {
      shouldReturnEmptyUserList = true;
    },
    failNextUserCreateWithDuplicateEmail: (): void => {
      shouldFailNextUserCreate = true;
    },
    failNextAuditLogCreate: (): void => {
      shouldFailNextAuditLogCreate = true;
    },
    failNextDatabaseCheck: (): void => {
      shouldFailNextDatabaseCheck = true;
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
    addReadyPhotoBatch: createReadyPhotoBatch,
  };
};
