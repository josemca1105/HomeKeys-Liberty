import { AuditScope, EmailType, Prisma, Role } from "@prisma/client";
import { prisma } from "../config/database";
import { environment } from "../config/env";
import {
  countActiveUsersByRole,
  countPropertiesByAgentId,
  countUsers,
  createUserRecord,
  deleteUserWithRelatedTokens,
  findUserByEmail,
  findUserById,
  findUserCredentialsById,
  findUsersPage,
  updateUserAndInvalidateResetTokens,
  updateUserRecord,
  type UpdateUserData,
} from "../repositories/user-repository";
import { runSerializableTransaction } from "../repositories/serializable-transaction";
import {
  INVITATION_TOKEN_TTL_MINUTES,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  buildPasswordResetUrl,
  issuePasswordResetToken,
} from "../services/password-reset-service";
import {
  findRecentPasswordHashes,
  recordPasswordHistoryEntry,
} from "../repositories/password-history-repository";
import type {
  ChangePasswordInput,
  CreateUserInput,
  ListUsersQuery,
  PaginatedUsersResult,
  RegisterUserResult,
  UpdateOwnProfileInput,
  UpdateUserInput,
  UserResponse,
  UserUpdateResult,
  PasswordChangeResult,
} from "../types/user";
import type { AuditAction, AuditContext } from "../types/audit";
import { AppError } from "../utils/app-error";
import { generateAuthToken } from "../utils/jwt";
import {
  comparePassword,
  generateTemporaryPassword,
  hashPassword,
} from "../utils/password";
import {
  assertPasswordNotBasedOnIdentity,
  assertPasswordNotReused,
  PASSWORD_HISTORY_LIMIT,
} from "../utils/password-policy";
import { toUserResponse } from "../utils/user-response";
import { recordAuditEventInTransaction } from "./audit-service";
import { queueEmail } from "./email-outbox-service";

const duplicateEmailError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "EMAIL_ALREADY_REGISTERED",
    message: "Ya existe un usuario registrado con ese correo.",
  });
};

const userNotFoundError = (action: string): AppError => {
  return new AppError({
    statusCode: 404,
    code: "USER_NOT_FOUND",
    message: `El usuario que intentas ${action} no existe.`,
  });
};

const invalidCurrentPasswordError = (): AppError => {
  return new AppError({
    statusCode: 422,
    code: "INVALID_CURRENT_PASSWORD",
    message: "La contraseña actual no es correcta.",
  });
};

const lastAdminRequiredError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "LAST_ADMIN_REQUIRED",
    message: "Debe permanecer al menos un usuario administrador en el sistema.",
  });
};

const selfDeletionNotAllowedError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "SELF_DELETION_NOT_ALLOWED",
    message: "No puedes eliminar tu propio usuario.",
  });
};

const selfDeactivationNotAllowedError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "SELF_DEACTIVATION_NOT_ALLOWED",
    message: "No puedes desactivar tu propia cuenta.",
  });
};

const userInactiveError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "USER_INACTIVE",
    message:
      "La cuenta está desactivada. Reactívala antes de enviar un enlace de restablecimiento.",
  });
};

const invitationNotPendingError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "INVITATION_NOT_PENDING",
    message:
      "La cuenta ya fue activada. Usa el enlace de restablecimiento de contraseña si necesitas cambiarla.",
  });
};

const userHasPropertiesError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "USER_HAS_PROPERTIES",
    message:
      "El usuario tiene propiedades registradas y por eso no puede eliminarse.",
  });
};

// JWT issuedAtMs and passwordChangedAt both use millisecond precision, so
// every token issued before the change is rejected during authentication.
const passwordChangeTimestamp = (): Date => {
  return new Date();
};

const buildUserWhere = (query: ListUsersQuery): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {};

  if (query.role !== undefined) {
    where.role = query.role;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.search !== undefined) {
    where.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search } },
    ];
  }

  return where;
};

const buildUserOrderBy = (
  query: ListUsersQuery,
): Prisma.UserOrderByWithRelationInput[] => {
  const primaryOrderBy = {
    [query.sortBy]: query.sortOrder,
  } as Prisma.UserOrderByWithRelationInput;

  const tieBreaker: Prisma.UserOrderByWithRelationInput =
    query.sortBy === "createdAt"
      ? { id: query.sortOrder }
      : { id: "desc" };

  return [primaryOrderBy, tieBreaker];
};

export const listUsers = async (
  query: ListUsersQuery,
): Promise<PaginatedUsersResult> => {
  const where = buildUserWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const [users, total] = await Promise.all([
    findUsersPage({
      where,
      orderBy: buildUserOrderBy(query),
      skip,
      take: query.pageSize,
    }),
    countUsers(where),
  ]);

  return {
    users: users.map(toUserResponse),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
};

export const getUserProfile = async (
  userId: number,
): Promise<UserResponse> => {
  const user = await findUserById(userId);

  if (!user) {
    throw userNotFoundError("consultar");
  }

  return toUserResponse(user);
};

export const registerUser = async (
  input: CreateUserInput,
  auditContext: AuditContext,
): Promise<RegisterUserResult> => {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw duplicateEmailError();
  }

  // The initial password is never disclosed: the account is activated through
  // the invitation link sent to the new user's email. Only the user defines a
  // password, so an administrator never knows any account credential.
  const initialPassword = generateTemporaryPassword();

  const passwordHash = await hashPassword(initialPassword);

  let user;

  try {
    user = await prisma.$transaction(async (transaction) => {
      const createdUser = await createUserRecord(
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash,
          phone: input.phone,
          photoUrl: input.photoUrl ?? null,
          role: input.role ?? Role.PARTNER,
          mustChangePassword: true,
        },
        transaction,
      );

      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.SECURITY,
        action: "USER_CREATED",
        actor: auditContext.actor,
        entityType: "USER",
        entityId: createdUser.id,
        changes: {
          email: createdUser.email,
          role: createdUser.role,
        },
        request: auditContext.request,
      });

      const activationToken = await issuePasswordResetToken(
        createdUser.id,
        INVITATION_TOKEN_TTL_MINUTES,
        transaction,
      );

      await queueEmail(
        {
          type: EmailType.INVITATION,
          to: createdUser.email,
          payload: {
            firstName: createdUser.firstName,
            activationUrl: buildPasswordResetUrl(activationToken),
            expirationHours: INVITATION_TOKEN_TTL_MINUTES / 60,
          },
        },
        transaction,
      );

      return createdUser;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw duplicateEmailError();
    }

    throw error;
  }

  return { user: toUserResponse(user), invitationSent: true };
};

export const changeOwnPassword = async (
  userId: number,
  input: ChangePasswordInput,
  auditContext: AuditContext,
): Promise<PasswordChangeResult> => {
  const user = await findUserCredentialsById(userId);

  if (!user) {
    throw userNotFoundError("consultar");
  }

  const isCurrentPasswordValid = await comparePassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!isCurrentPasswordValid) {
    throw invalidCurrentPasswordError();
  }

  assertPasswordNotBasedOnIdentity(
    input.newPassword,
    {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    "newPassword",
  );

  const recentHashes = await findRecentPasswordHashes(
    userId,
    PASSWORD_HISTORY_LIMIT,
  );
  await assertPasswordNotReused(
    input.newPassword,
    [user.passwordHash, ...recentHashes],
    "newPassword",
  );

  const newPasswordHash = await hashPassword(input.newPassword);
  const previousPasswordHash = user.passwordHash;

  const updatedUser = await prisma.$transaction(async (transaction) => {
    const updatedRecord = await updateUserAndInvalidateResetTokens(
      userId,
      {
        passwordHash: newPasswordHash,
        passwordChangedAt: passwordChangeTimestamp(),
        mustChangePassword: false,
      },
      transaction,
    );

    await recordPasswordHistoryEntry(
      userId,
      previousPasswordHash,
      PASSWORD_HISTORY_LIMIT,
      transaction,
    );

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.SECURITY,
      action: "PASSWORD_CHANGED",
      actor: { ...auditContext.actor, email: updatedRecord.email },
      entityType: "USER",
      entityId: updatedRecord.id,
      changes: { mustChangePassword: updatedRecord.mustChangePassword },
      request: auditContext.request,
    });

    return updatedRecord;
  });

  return {
    user: toUserResponse(updatedUser),
    token: generateAuthToken(updatedUser.id, updatedUser.role),
  };
};

export const updateOwnProfile = async (
  userId: number,
  input: UpdateOwnProfileInput,
  auditContext: AuditContext,
): Promise<UserResponse> => {
  const updateData: UpdateUserData = {
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
  };

  try {
    return await prisma.$transaction(async (transaction) => {
      const updatedUser = await updateUserRecord(
        userId,
        updateData,
        transaction,
      );

      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.SECURITY,
        action: "USER_UPDATED",
        actor: auditContext.actor,
        entityType: "USER",
        entityId: updatedUser.id,
        changes: {
          fields: Object.keys(input),
          selfService: true,
        },
        request: auditContext.request,
      });

      return toUserResponse(updatedUser);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw userNotFoundError("actualizar");
    }

    throw error;
  }
};

export const updateUserByAdmin = async (
  targetUserId: number,
  input: UpdateUserInput,
  actingUserId: number,
  auditContext: AuditContext,
): Promise<UserUpdateResult> => {
  const currentTarget = await findUserById(targetUserId);

  if (!currentTarget) {
    throw userNotFoundError("actualizar");
  }

  if (input.isActive === false && targetUserId === actingUserId) {
    throw selfDeactivationNotAllowedError();
  }

  const newEmail = input.email;
  const isEmailChangingFromSnapshot =
    newEmail !== undefined && newEmail !== currentTarget.email;
  const previousEmail = isEmailChangingFromSnapshot
    ? currentTarget.email
    : null;

  if (isEmailChangingFromSnapshot) {
    const existingUser = await findUserByEmail(newEmail);

    if (existingUser) {
      throw duplicateEmailError();
    }
  }

  try {
    const transactionResult = await runSerializableTransaction(
      async (transaction) => {
        const targetUser = await findUserById(targetUserId, transaction);

        if (!targetUser) {
          throw userNotFoundError("actualizar");
        }

        const isDemotingAdmin =
          input.role !== undefined &&
          input.role !== Role.ADMIN &&
          targetUser.role === Role.ADMIN;
        const isDeactivating =
          input.isActive === false && targetUser.isActive;
        const isReactivating =
          input.isActive === true && !targetUser.isActive;

        // Only active administrators keep the system operable: demoting or
        // deactivating the last one would leave no one able to manage users.
        const removesActiveAdmin =
          targetUser.role === Role.ADMIN &&
          targetUser.isActive &&
          (isDemotingAdmin || isDeactivating);

        if (removesActiveAdmin) {
          const activeAdminCount = await countActiveUsersByRole(
            Role.ADMIN,
            transaction,
          );

          if (activeAdminCount <= 1) {
            throw lastAdminRequiredError();
          }
        }

        const isChangingEmail =
          newEmail !== undefined && newEmail !== targetUser.email;

        const updateData: UpdateUserData = {
          ...(input.firstName !== undefined
            ? { firstName: input.firstName }
            : {}),
          ...(input.lastName !== undefined
            ? { lastName: input.lastName }
            : {}),
          ...(newEmail !== undefined ? { email: newEmail } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.photoUrl !== undefined
            ? { photoUrl: input.photoUrl }
            : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.isActive !== undefined
            ? { isActive: input.isActive }
            : {}),
        };

        if (isReactivating) {
          // Tokens issued before the deactivation must not become valid again
          // when the account is reactivated.
          updateData.passwordChangedAt = passwordChangeTimestamp();
        }

        const shouldInvalidateResetTokens =
          isChangingEmail || isDeactivating;

        const updatedRecord = shouldInvalidateResetTokens
          ? await updateUserAndInvalidateResetTokens(
              targetUserId,
              updateData,
              transaction,
            )
          : await updateUserRecord(targetUserId, updateData, transaction);

        const auditAction: AuditAction = isDeactivating
          ? "USER_DEACTIVATED"
          : isReactivating
            ? "USER_REACTIVATED"
            : "USER_UPDATED";

        const statusChange = isDeactivating
          ? ("deactivated" as const)
          : isReactivating
            ? ("reactivated" as const)
            : null;

        await recordAuditEventInTransaction(transaction, {
          scope: AuditScope.SECURITY,
          action: auditAction,
          actor: auditContext.actor,
          entityType: "USER",
          entityId: updatedRecord.id,
          changes: {
            fields: Object.keys(input),
            email: updatedRecord.email,
            role: updatedRecord.role,
            isActive: updatedRecord.isActive,
            ...(previousEmail !== null ? { previousEmail } : {}),
          },
          request: auditContext.request,
        });

        if (previousEmail !== null) {
          // The notice goes to the previous address so its owner can react if
          // the change was not expected. It omits the new address.
          await queueEmail(
            {
              type: EmailType.EMAIL_CHANGE_NOTICE,
              to: previousEmail,
              payload: {
                firstName: updatedRecord.firstName,
                loginUrl: environment.APP_BASE_URL,
              },
            },
            transaction,
          );
        }

        if (statusChange !== null) {
          await queueEmail(
            {
              type: EmailType.ACCOUNT_STATUS_NOTICE,
              to: updatedRecord.email,
              payload: {
                firstName: updatedRecord.firstName,
                isActive: statusChange === "reactivated",
                loginUrl: environment.APP_BASE_URL,
              },
            },
            transaction,
          );
        }

        return { updatedRecord, statusChange };
      },
    );

    const updatedUser = transactionResult.updatedRecord;

    return {
      user: toUserResponse(updatedUser),
      previousEmail,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw duplicateEmailError();
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw userNotFoundError("actualizar");
    }

    throw error;
  }
};

export const deleteUserByAdmin = async (
  targetUserId: number,
  actingUserId: number,
  auditContext: AuditContext,
): Promise<number> => {
  try {
    return await runSerializableTransaction(async (transaction) => {
      const targetUser = await findUserById(targetUserId, transaction);

      if (!targetUser) {
        throw userNotFoundError("eliminar");
      }

      // A sole active ADMIN deleting itself is reported as LAST_ADMIN_REQUIRED
      // because the system would be left without active administrators; self
      // deletion is only reported when at least one other active ADMIN remains.
      if (targetUser.role === Role.ADMIN && targetUser.isActive) {
        const activeAdminCount = await countActiveUsersByRole(
          Role.ADMIN,
          transaction,
        );

        if (activeAdminCount <= 1) {
          throw lastAdminRequiredError();
        }
      }

      if (targetUserId === actingUserId) {
        throw selfDeletionNotAllowedError();
      }

      const propertyCount = await countPropertiesByAgentId(
        targetUserId,
        transaction,
      );

      if (propertyCount > 0) {
        throw userHasPropertiesError();
      }

      await deleteUserWithRelatedTokens(targetUserId, transaction);

      await recordAuditEventInTransaction(transaction, {
        scope: AuditScope.SECURITY,
        action: "USER_DELETED",
        actor: auditContext.actor,
        entityType: "USER",
        entityId: targetUserId,
        changes: { deletedId: targetUserId },
        request: auditContext.request,
      });

      return targetUserId;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw userHasPropertiesError();
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw userNotFoundError("eliminar");
    }

    throw error;
  }
};

/**
 * Sends a single-use password reset link to a user. The administrator never
 * sees or sets the password. Token issuance and the audit event share one
 * transaction; the SMTP delivery stays best-effort and is reported back.
 */
export const sendPasswordResetLinkByAdmin = async (
  targetUserId: number,
  auditContext: AuditContext,
): Promise<{ emailSent: boolean }> => {
  const user = await findUserById(targetUserId);

  if (!user) {
    throw userNotFoundError("enviar el enlace de restablecimiento a");
  }

  if (!user.isActive) {
    throw userInactiveError();
  }

  await prisma.$transaction(async (transaction) => {
    const issuedToken = await issuePasswordResetToken(
      targetUserId,
      PASSWORD_RESET_TOKEN_TTL_MINUTES,
      transaction,
    );

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.SECURITY,
      action: "PASSWORD_RESET_LINK_SENT",
      actor: auditContext.actor,
      entityType: "USER",
      entityId: targetUserId,
      request: auditContext.request,
    });

    await queueEmail(
      {
        type: EmailType.PASSWORD_RESET,
        to: user.email,
        payload: {
          firstName: user.firstName,
          resetUrl: buildPasswordResetUrl(issuedToken),
          expirationMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
        },
      },
      transaction,
    );
  });

  return { emailSent: true };
};

/**
 * Reissues the 24-hour activation link for an invited account. The account must
 * still be pending activation (`mustChangePassword: true`) and active. Token
 * issuance and the audit event share one transaction; delivery is reported
 * back through `emailSent`.
 */
export const resendInvitationByAdmin = async (
  targetUserId: number,
  auditContext: AuditContext,
): Promise<{ emailSent: boolean }> => {
  const user = await findUserById(targetUserId);

  if (!user) {
    throw userNotFoundError("reenviar la invitación a");
  }

  if (!user.isActive) {
    throw userInactiveError();
  }

  if (!user.mustChangePassword) {
    throw invitationNotPendingError();
  }

  await prisma.$transaction(async (transaction) => {
    const issuedToken = await issuePasswordResetToken(
      targetUserId,
      INVITATION_TOKEN_TTL_MINUTES,
      transaction,
    );

    await recordAuditEventInTransaction(transaction, {
      scope: AuditScope.SECURITY,
      action: "INVITATION_RESENT",
      actor: auditContext.actor,
      entityType: "USER",
      entityId: targetUserId,
      request: auditContext.request,
    });

    await queueEmail(
      {
        type: EmailType.INVITATION,
        to: user.email,
        payload: {
          firstName: user.firstName,
          activationUrl: buildPasswordResetUrl(issuedToken),
          expirationHours: INVITATION_TOKEN_TTL_MINUTES / 60,
        },
      },
      transaction,
    );
  });

  return { emailSent: true };
};
