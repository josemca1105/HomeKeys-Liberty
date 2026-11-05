import { authenticateUser, revokeCurrentToken } from "../services/auth-service";
import {
  requestPasswordReset,
  resetUserPassword,
} from "../services/password-reset-service";
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from "../types/auth";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

export const login = asyncHandler(async (req, res): Promise<void> => {
  const credentials = req.body as LoginInput;
  const result = await authenticateUser(credentials);

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

  res.status(200).json({
    success: true,
    message: "Sesión cerrada exitosamente.",
  });
});

export const forgotPassword = asyncHandler(async (req, res): Promise<void> => {
  const { email } = req.body as ForgotPasswordInput;

  await requestPasswordReset(email);

  res.status(200).json({
    success: true,
    message:
      "Si el correo está registrado, recibirás un mensaje para restablecer tu contraseña.",
    data: {},
  });
});

export const resetPassword = asyncHandler(async (req, res): Promise<void> => {
  const { token, newPassword } = req.body as ResetPasswordInput;

  await resetUserPassword(token, newPassword);

  res.status(200).json({
    success: true,
    message: "Contraseña restablecida exitosamente.",
    data: {},
  });
});
