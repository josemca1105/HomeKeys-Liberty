import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 72

const textEncoder = new TextEncoder()

export const passwordSchema = z
  .string()
  .min(1, 'Ingresa una contraseña.')
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres.`,
  )
  .refine(
    (value) => textEncoder.encode(value).length <= PASSWORD_MAX_LENGTH,
    'La contraseña no puede superar los 72 bytes en formato UTF-8.',
  )
  .refine(
    (value) => /\p{Lu}/u.test(value),
    'La contraseña debe incluir al menos una letra mayúscula.',
  )
  .refine(
    (value) => /\p{Ll}/u.test(value),
    'La contraseña debe incluir al menos una letra minúscula.',
  )
  .refine(
    (value) => /\p{N}/u.test(value),
    'La contraseña debe incluir al menos un número.',
  )
  .refine(
    (value) => /[\p{P}\p{S}]/u.test(value),
    'La contraseña debe incluir al menos un carácter especial.',
  )
