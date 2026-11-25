import { z } from 'zod'

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

export const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Ingresa tu nombre.')
    .max(100, 'El nombre no puede superar los 100 caracteres.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Ingresa tu apellido.')
    .max(100, 'El apellido no puede superar los 100 caracteres.'),
  phone: z
    .string()
    .trim()
    .min(6, 'Ingresa un teléfono válido.')
    .max(20, 'El teléfono no puede superar los 20 caracteres.')
    .regex(
      /^\+?[0-9\s().-]{6,20}$/,
      'Ingresa un teléfono válido.',
    ),
  photoUrl: optionalPhotoUrlSchema,
})

export type ProfileFormValues = z.infer<typeof profileSchema>

export function toUpdateProfileRequest(values: ProfileFormValues) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim(),
    photoUrl: values.photoUrl.trim() || null,
  }
}
