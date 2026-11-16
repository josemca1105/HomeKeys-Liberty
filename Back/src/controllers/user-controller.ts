import { AuditScope } from "@prisma/client";
import { recordAuditEvent } from "../services/audit-service";
import {
  changeOwnPassword,
  deleteUserByAdmin,
  getUserProfile,
  listUsers,
  registerUser,
  updateUserByAdmin,
} from "../services/user-service";
import type {
  ChangePasswordInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from "../types/user";
import type { AuditAction } from "../types/audit";
import type { UserIdParams } from "../validators/user-validators";
import { getAuditActor, getAuditRequestContext } from "../utils/audit-context";
import { asyncHandler } from "../utils/async-handler";
import { requireSession } from "../utils/require-session";

export const addUser = asyncHandler(async (req, res): Promise<void> => {
  const userData = req.body as CreateUserInput;
  const { user, invitationSent } = await registerUser(userData);

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: "USER_CREATED",
    actor: getAuditActor(req.auth),
    entityType: "USER",
    entityId: user.id,
    changes: {
      email: user.email,
      role: user.role,
      invitationSent,
    },
    request: getAuditRequestContext(req),
  });

  res.status(201).json({
    success: true,
    message: "Usuario registrado exitosamente.",
    data: { user, invitationSent },
  });
});

export const getCurrentUser = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const user = await getUserProfile(session.userId);

  res.status(200).json({
    success: true,
    message: "Usuario obtenido exitosamente.",
    data: { user },
  });
});

export const getUsers = asyncHandler(async (req, res): Promise<void> => {
  const query = req.validatedQuery as ListUsersQuery;
  const { users, pagination } = await listUsers(query);

  res.status(200).json({
    success: true,
    message: "Usuarios obtenidos exitosamente.",
    data: { users, pagination },
  });
});

export const getUserById = asyncHandler(async (req, res): Promise<void> => {
  const userId = (req.validatedParams as UserIdParams).id;
  const user = await getUserProfile(userId);

  res.status(200).json({
    success: true,
    message: "Usuario obtenido exitosamente.",
    data: { user },
  });
});

export const changeMyPassword = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const input = req.body as ChangePasswordInput;
  const { user, token } = await changeOwnPassword(session.userId, input);

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: "PASSWORD_CHANGED",
    actor: getAuditActor(session, user.email),
    entityType: "USER",
    entityId: user.id,
    changes: { mustChangePassword: user.mustChangePassword },
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Contraseña actualizada exitosamente.",
    data: { user, token },
  });
});

export const updateUser = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const userId = (req.validatedParams as UserIdParams).id;
  const input = req.body as UpdateUserInput;
  const { user, token, previousEmail } = await updateUserByAdmin(
    userId,
    input,
    session.userId,
  );

  const auditAction: AuditAction =
    input.password !== undefined
      ? "USER_PASSWORD_RESET"
      : input.isActive === false
        ? "USER_DEACTIVATED"
        : input.isActive === true
          ? "USER_REACTIVATED"
          : "USER_UPDATED";

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: auditAction,
    actor: getAuditActor(session),
    entityType: "USER",
    entityId: user.id,
    changes: {
      fields: Object.keys(input).filter((field) => field !== "password"),
      passwordChanged: input.password !== undefined,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      ...(previousEmail !== null ? { previousEmail } : {}),
    },
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Usuario actualizado exitosamente.",
    data: { user, ...(token ? { token } : {}) },
  });
});

export const removeUser = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const userId = (req.validatedParams as UserIdParams).id;
  const deletedId = await deleteUserByAdmin(userId, session.userId);

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: "USER_DELETED",
    actor: getAuditActor(session),
    entityType: "USER",
    entityId: deletedId,
    changes: { deletedId },
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Usuario eliminado exitosamente.",
    data: { deletedId },
  });
});
