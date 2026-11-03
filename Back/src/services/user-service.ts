import { Prisma, Role } from "@prisma/client";
import {
  countPropertiesByAgentId,
  countUsersByRole,
  createUserRecord,
  deleteUserWithRelatedTokens,
  findAllUsers,
  findUserByEmail,
  findUserById,
  findUserCredentialsById,
  updateUserRecord,
  type UpdateUserData,
} from "../repositories/user-repository";
import type {
  ChangePasswordInput,
  CreateUserInput,
  UpdateUserInput,
  UserResponse,
  UserUpdateResult,
  PasswordChangeResult,
} from "../types/user";
import { AppError } from "../utils/app-error";
import { generateAuthToken } from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";
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

export const registerUser = async (
  input: CreateUserInput,
): Promise<UserResponse> => {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw duplicateEmailError();
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await createUserRecord({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      phone: input.phone,
      photoUrl: input.photoUrl ?? null,
      role: input.role ?? Role.PARTNER,
    });

    return toUserResponse(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw duplicateEmailError();
    }

    throw error;
  }
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

  const updatedUser = await updateUserRecord(userId, {
    passwordHash: await hashPassword(input.newPassword),
    passwordChangedAt: passwordChangeTimestamp(),
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

  if (input.email !== undefined && input.email !== targetUser.email) {
    const existingUser = await findUserByEmail(input.email);

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

  if (input.password !== undefined) {
    updateData.passwordHash = await hashPassword(input.password);
    updateData.passwordChangedAt = passwordChangeTimestamp();
  }

  try {
    const updatedUser = await updateUserRecord(targetUserId, updateData);
    const isOwnPasswordChange =
      isChangingPassword && targetUserId === actingUserId;

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
