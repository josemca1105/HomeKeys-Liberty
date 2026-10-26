import { authenticateUser, revokeCurrentToken } from "../services/auth-service";
import type { LoginInput } from "../types/auth";
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
