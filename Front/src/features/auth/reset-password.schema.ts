import { z } from 'zod'
import { passwordSchema } from './password-policy'

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, 'Confirma la nueva contraseña.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })

export type ResetPasswordFormValues = z.infer<
  typeof resetPasswordSchema
>
