import { z } from 'zod'
import { passwordSchema } from './password-policy'

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Ingresa tu contraseña actual.')
      .max(72, 'La contraseña actual no puede superar los 72 caracteres.'),
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, 'Confirma la nueva contraseña.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: 'La nueva contraseña debe ser diferente a la actual.',
    path: ['newPassword'],
  })

export type ChangePasswordFormValues = z.infer<
  typeof changePasswordSchema
>
