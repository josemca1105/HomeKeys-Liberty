import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa tu correo electrónico.')
    .email('Ingresa un correo electrónico válido.')
    .max(255, 'El correo no puede superar los 255 caracteres.'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña.')
    .max(72, 'La contraseña no puede superar los 72 caracteres.'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
