import { registerUser } from "../services/user-service";
import type { CreateUserInput } from "../types/user";
import { asyncHandler } from "../utils/async-handler";

export const addUser = asyncHandler(async (req, res): Promise<void> => {
  const userData = req.body as CreateUserInput;
  const user = await registerUser(userData);

  res.status(201).json({
    success: true,
    message: "Usuario registrado exitosamente.",
    data: { user },
  });
});
