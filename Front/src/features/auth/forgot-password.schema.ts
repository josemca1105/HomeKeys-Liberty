import { z } from 'zod'

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa tu correo electrónico.')
    .email('Ingresa un correo electrónico válido.')
    .max(255, 'El correo no puede superar los 255 caracteres.'),
})

export type ForgotPasswordFormValues = z.infer<
  typeof forgotPasswordSchema
>
