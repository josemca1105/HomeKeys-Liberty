import { z } from 'zod'
import type { UpdateUserRequest, User } from './user.types'

const optionalPhotoUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) {
      return true
    }

    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Ingresa una URL http(s) válida.')

// Account status is deliberately excluded: it has a dedicated confirmation
// flow in the actions panel (PATCH with `isActive`).
export const updateUserSchema = z.object({
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
  photoUrl: optionalPhotoUrlSchema,
  role: z.enum(['ADMIN', 'PARTNER'], { error: 'Elige un rol válido.' }),
})

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>

export function toUpdateUserFormValues(user: User): UpdateUserFormValues {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    photoUrl: user.photoUrl ?? '',
    role: user.role,
  }
}

export function toUpdateUserRequest(
  values: UpdateUserFormValues,
): UpdateUserRequest {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    photoUrl: values.photoUrl.trim() || null,
    role: values.role,
  }
}
