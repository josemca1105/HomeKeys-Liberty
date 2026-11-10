import { Prisma, Role } from "@prisma/client";
import { environment } from "../config/env";
import {
  countPropertiesByAgentId,
  countUsersByRole,
  createUserRecord,
  deleteUserWithRelatedTokens,
  findAllUsers,
  findUserByEmail,
  findUserById,
  findUserCredentialsById,
  updateUserAndInvalidateResetTokens,
  updateUserRecord,
  type UpdateUserData,
} from "../repositories/user-repository";
import {
  INVITATION_TOKEN_TTL_MINUTES,
  issuePasswordResetToken,
} from "../services/password-reset-service";
import type {
  ChangePasswordInput,
  CreateUserInput,
  RegisterUserResult,
  UpdateUserInput,
  UserResponse,
  UserUpdateResult,
  PasswordChangeResult,
} from "../types/user";
import { AppError } from "../utils/app-error";
import { generateAuthToken } from "../utils/jwt";
import {
  sendInvitationEmail,
  sendPasswordResetNoticeEmail,
} from "../utils/mailer";
import {
  comparePassword,
  generateTemporaryPassword,
  hashPassword,
} from "../utils/password";
import { toUserResponse } from "../utils/user-response";

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
    statusCode: 401,
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

export const listUsers = async (): Promise<UserResponse[]> => {
  const users = await findAllUsers();
  return users.map(toUserResponse);
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

const sendInvitation = async (user: UserResponse): Promise<boolean> => {
  try {
    const activationToken = await issuePasswordResetToken(
      user.id,
      INVITATION_TOKEN_TTL_MINUTES,
    );

    await sendInvitationEmail({
      to: user.email,
      firstName: user.firstName,
      activationUrl: `${environment.PASSWORD_RESET_BASE_URL}?token=${activationToken}`,
      expirationHours: INVITATION_TOKEN_TTL_MINUTES / 60,
    });

    return true;
  } catch (error) {
    // The account is created regardless; the ADMIN can resend the link later
    // through the password recovery flow.
    console.error("Failed to send the invitation email.", error);
    return false;
  }
};

export const registerUser = async (
  input: CreateUserInput,
): Promise<RegisterUserResult> => {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw duplicateEmailError();
  }

  // The initial password is never disclosed: the account is activated through
  // the invitation link sent to the new user's email.
  const initialPassword = input.password ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(initialPassword);

  let user;

  try {
    user = await createUserRecord({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      phone: input.phone,
      photoUrl: input.photoUrl ?? null,
      role: input.role ?? Role.PARTNER,
      mustChangePassword: true,
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

  const safeUser = toUserResponse(user);
  const invitationSent = await sendInvitation(safeUser);

  return { user: safeUser, invitationSent };
};

export const changeOwnPassword = async (
  userId: number,
  input: ChangePasswordInput,
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

  const updatedUser = await updateUserAndInvalidateResetTokens(userId, {
    passwordHash: await hashPassword(input.newPassword),
    passwordChangedAt: passwordChangeTimestamp(),
    mustChangePassword: false,
  });

  return {
    user: toUserResponse(updatedUser),
    token: generateAuthToken(updatedUser.id, updatedUser.role),
  };
};

export const updateUserByAdmin = async (
  targetUserId: number,
  input: UpdateUserInput,
  actingUserId: number,
): Promise<UserUpdateResult> => {
  const targetUser = await findUserById(targetUserId);

  if (!targetUser) {
    throw userNotFoundError("actualizar");
  }

  const newEmail = input.email;
  const isChangingEmail =
    newEmail !== undefined && newEmail !== targetUser.email;

  if (isChangingEmail) {
    const existingUser = await findUserByEmail(newEmail);

    if (existingUser) {
      throw duplicateEmailError();
    }
  }

  const isDemotingAdmin =
    input.role !== undefined &&
    input.role !== Role.ADMIN &&
    targetUser.role === Role.ADMIN;

  if (isDemotingAdmin) {
    const adminCount = await countUsersByRole(Role.ADMIN);

    if (adminCount <= 1) {
      throw lastAdminRequiredError();
    }
  }

  const updateData: UpdateUserData = {
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
  };

  const isChangingPassword = input.password !== undefined;
  const shouldInvalidateResetTokens = isChangingPassword || isChangingEmail;

  if (input.password !== undefined) {
    updateData.passwordHash = await hashPassword(input.password);
    updateData.passwordChangedAt = passwordChangeTimestamp();
    updateData.mustChangePassword = true;
  }

  try {
    const updatedUser = shouldInvalidateResetTokens
      ? await updateUserAndInvalidateResetTokens(targetUserId, updateData)
      : await updateUserRecord(targetUserId, updateData);
    const isOwnPasswordChange =
      isChangingPassword && targetUserId === actingUserId;

    if (isChangingPassword) {
      try {
        await sendPasswordResetNoticeEmail({
          to: updatedUser.email,
          firstName: updatedUser.firstName,
          loginUrl: environment.APP_BASE_URL,
        });
      } catch (error) {
        console.error("Failed to send the password reset notice email.", error);
      }
    }

    return {
      user: toUserResponse(updatedUser),
      token: isOwnPasswordChange
        ? generateAuthToken(updatedUser.id, updatedUser.role)
        : null,
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
): Promise<number> => {
  const targetUser = await findUserById(targetUserId);

  if (!targetUser) {
    throw userNotFoundError("eliminar");
  }

  // A sole ADMIN deleting itself is reported as LAST_ADMIN_REQUIRED because
  // the system would be left without administrators; self deletion is only
  // reported when at least one other ADMIN remains.
  if (targetUser.role === Role.ADMIN) {
    const adminCount = await countUsersByRole(Role.ADMIN);

    if (adminCount <= 1) {
      throw lastAdminRequiredError();
    }
  }

  if (targetUserId === actingUserId) {
    throw selfDeletionNotAllowedError();
  }

  const propertyCount = await countPropertiesByAgentId(targetUserId);

  if (propertyCount > 0) {
    throw userHasPropertiesError();
  }

  await deleteUserWithRelatedTokens(targetUserId);

  return targetUserId;
};
