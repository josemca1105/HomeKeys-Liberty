import { AppError } from "./app-error";
import type { PasswordIdentity } from "./password-identity";
import { isPasswordBasedOnIdentity } from "./password-identity";

/**
 * Applies the identity rule in flows where the email or the names are not part
 * of the validated request body. The error shape matches a Zod validation
 * failure so clients handle every password policy violation the same way.
 */
export const assertPasswordNotBasedOnIdentity = (
  password: string,
  identity: PasswordIdentity,
  field: string,
): void => {
  if (!isPasswordBasedOnIdentity(password, identity)) {
    return;
  }

  throw new AppError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message: "Por favor revisa los datos ingresados.",
    details: [
      {
        field,
        message: "La contraseña no puede basarse en tu correo o en tu nombre.",
      },
    ],
  });
};
