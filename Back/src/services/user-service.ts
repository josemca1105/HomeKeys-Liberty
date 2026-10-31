import { Prisma, Role } from "@prisma/client";
import {
  createUserRecord,
  findUserByEmail,
} from "../repositories/user-repository";
import type { CreateUserInput, UserResponse } from "../types/user";
import { AppError } from "../utils/app-error";
import { hashPassword } from "../utils/password";
import { toUserResponse } from "../utils/user-response";

const duplicateEmailError = (): AppError => {
  return new AppError({
    statusCode: 409,
    code: "EMAIL_ALREADY_REGISTERED",
    message: "Ya existe un usuario registrado con ese correo.",
  });
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
