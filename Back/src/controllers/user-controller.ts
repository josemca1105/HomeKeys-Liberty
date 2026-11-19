import {
  changeOwnPassword,
  deleteUserByAdmin,
  getUserProfile,
  listUsers,
  registerUser,
  resendInvitationByAdmin,
  sendPasswordResetLinkByAdmin,
  updateOwnProfile,
  updateUserByAdmin,
} from "../services/user-service";
import type {
  ChangePasswordInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from "../types/user";
import type { UserIdParams } from "../validators/user-validators";
import { getAuditActor, getAuditRequestContext } from "../utils/audit-context";
import { asyncHandler } from "../utils/async-handler";
import { requireSession } from "../utils/require-session";

export const addUser = asyncHandler(async (req, res): Promise<void> => {
  const userData = req.body as CreateUserInput;
  const { user, invitationSent } = await registerUser(userData, {
    actor: getAuditActor(req.auth),
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
  const { user, token } = await changeOwnPassword(session.userId, input, {
    actor: getAuditActor(session),
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Contraseña actualizada exitosamente.",
    data: { user, token },
  });
});

export const updateMyProfile = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const input = req.body as UpdateOwnProfileInput;
  const user = await updateOwnProfile(session.userId, input, {
    actor: getAuditActor(session),
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Perfil actualizado exitosamente.",
    data: { user },
  });
});

export const updateUser = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const userId = (req.validatedParams as UserIdParams).id;
  const input = req.body as UpdateUserInput;
  const { user } = await updateUserByAdmin(
    userId,
    input,
    session.userId,
    {
      actor: getAuditActor(session),
      request: getAuditRequestContext(req),
    },
  );

  res.status(200).json({
    success: true,
    message: "Usuario actualizado exitosamente.",
    data: { user },
  });
});

export const sendPasswordResetLink = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const userId = (req.validatedParams as UserIdParams).id;
    const { emailSent } = await sendPasswordResetLinkByAdmin(userId, {
      actor: getAuditActor(session),
      request: getAuditRequestContext(req),
    });

    res.status(200).json({
      success: true,
      message: "Enlace de restablecimiento enviado.",
      data: { emailSent },
    });
  },
);

export const resendInvitation = asyncHandler(
  async (req, res): Promise<void> => {
    const session = requireSession(req);
    const userId = (req.validatedParams as UserIdParams).id;
    const { emailSent } = await resendInvitationByAdmin(userId, {
      actor: getAuditActor(session),
      request: getAuditRequestContext(req),
    });

    res.status(200).json({
      success: true,
      message: "Invitación reenviada.",
      data: { emailSent },
    });
  },
);

export const removeUser = asyncHandler(async (req, res): Promise<void> => {
  const session = requireSession(req);
  const userId = (req.validatedParams as UserIdParams).id;
  const deletedId = await deleteUserByAdmin(userId, session.userId, {
    actor: getAuditActor(session),
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Usuario eliminado exitosamente.",
    data: { deletedId },
  });
});
