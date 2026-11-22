import { z } from 'zod'

const apiBaseUrlSchema = z
  .string()
  .trim()
  .min(1, 'VITE_API_BASE_URL no puede estar vacío.')
  .refine(
    (value) =>
      value.startsWith('/') ||
      z.string().url().safeParse(value).success,
    'VITE_API_BASE_URL debe ser una URL absoluta o una ruta que comience con /.',
  )
  .default('http://localhost:3000/api/v1')

const envSchema = z.object({
  VITE_API_BASE_URL: apiBaseUrlSchema,
  VITE_APP_NAME: z
    .string()
    .trim()
    .min(1, 'VITE_APP_NAME no puede estar vacío.')
    .default('HomeKeys Liberty'),
  VITE_MAP_STYLE_URL: z
    .string()
    .url('VITE_MAP_STYLE_URL debe ser una URL válida.')
    .default('https://tiles.openfreemap.org/styles/liberty'),
})

const parsedEnv = envSchema.safeParse(import.meta.env)

if (!parsedEnv.success) {
  throw new Error(`Configuración de entorno inválida:\n${z.prettifyError(parsedEnv.error)}`)
}

export const env = Object.freeze({
  apiBaseUrl: parsedEnv.data.VITE_API_BASE_URL.replace(/\/+$/, ''),
  appName: parsedEnv.data.VITE_APP_NAME,
  mapStyleUrl: parsedEnv.data.VITE_MAP_STYLE_URL,
})
