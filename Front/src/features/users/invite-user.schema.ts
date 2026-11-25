import { z } from 'zod'
import type { CreateUserRequest } from './user.types'

export const inviteUserSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Ingresa el nombre.')
    .max(100, 'El nombre no puede superar los 100 caracteres.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Ingresa el apellido.')
    .max(100, 'El apellido no puede superar los 100 caracteres.'),
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa el correo electrónico.')
    .email('Ingresa un correo electrónico válido.')
    .max(255, 'El correo no puede superar los 255 caracteres.'),
  phone: z
    .string()
    .trim()
    .min(6, 'Ingresa un teléfono válido.')
    .max(20, 'El teléfono no puede superar los 20 caracteres.')
    .regex(/^\+?[0-9\s().-]{6,20}$/, 'Ingresa un teléfono válido.'),
  role: z.enum(['ADMIN', 'PARTNER'], { error: 'Elige un rol válido.' }),
})

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>

export const INVITE_USER_DEFAULT_VALUES: InviteUserFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'PARTNER',
}

export function toCreateUserRequest(
  values: InviteUserFormValues,
): CreateUserRequest {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    role: values.role,
  }
}
