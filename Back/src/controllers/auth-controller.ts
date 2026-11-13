import { AuditScope } from "@prisma/client";
import { authenticateUser, revokeCurrentToken } from "../services/auth-service";
import { recordAuditEvent } from "../services/audit-service";
import {
  requestPasswordReset,
  resetUserPassword,
} from "../services/password-reset-service";
import type {
  ForgotPasswordInput,
  LoginInput,
  LoginResult,
  ResetPasswordInput,
} from "../types/auth";
import { AppError } from "../utils/app-error";
import { getAuditActor, getAuditRequestContext } from "../utils/audit-context";
import { asyncHandler } from "../utils/async-handler";

export const login = asyncHandler(async (req, res): Promise<void> => {
  const credentials = req.body as LoginInput;
  let result: LoginResult;

  try {
    result = await authenticateUser(credentials);
  } catch (error) {
    const isAccountLocked =
      error instanceof AppError && error.code === "ACCOUNT_LOCKED";

    await recordAuditEvent({
      scope: AuditScope.SECURITY,
      action: isAccountLocked ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
      actor: { email: credentials.email },
      request: getAuditRequestContext(req),
    });
    throw error;
  }

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: "LOGIN_SUCCEEDED",
    actor: {
      id: result.user.id,
      role: result.user.role,
      email: result.user.email,
    },
    entityType: "USER",
    entityId: result.user.id,
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Inicio de sesión exitoso.",
    data: result,
  });
});

export const logout = asyncHandler(async (req, res): Promise<void> => {
  if (!req.auth) {
    throw new AppError({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Debes iniciar sesión para acceder a este recurso.",
    });
  }

  await revokeCurrentToken(req.auth);

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: "LOGOUT",
    actor: getAuditActor(req.auth),
    entityType: "USER",
    entityId: req.auth.userId,
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Sesión cerrada exitosamente.",
  });
});

export const forgotPassword = asyncHandler(async (req, res): Promise<void> => {
  const { email } = req.body as ForgotPasswordInput;

  await requestPasswordReset(email);

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: "PASSWORD_RESET_REQUESTED",
    actor: { email },
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message:
      "Si el correo está registrado, recibirás un mensaje para restablecer tu contraseña.",
    data: {},
  });
});

export const resetPassword = asyncHandler(async (req, res): Promise<void> => {
  const { token, newPassword } = req.body as ResetPasswordInput;

  const userId = await resetUserPassword(token, newPassword);

  await recordAuditEvent({
    scope: AuditScope.SECURITY,
    action: "PASSWORD_RESET",
    actor: { id: userId },
    entityType: "USER",
    entityId: userId,
    request: getAuditRequestContext(req),
  });

  res.status(200).json({
    success: true,
    message: "Contraseña restablecida exitosamente.",
    data: {},
  });
});
