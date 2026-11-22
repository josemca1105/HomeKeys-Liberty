import axios from 'axios'
import type { ApiErrorDetail, ApiErrorPayload } from './types'

interface ApiErrorOptions {
  status: number | null
  code: string
  fieldErrors?: ApiErrorDetail[]
  cause?: unknown
}

export class ApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly fieldErrors: ApiErrorDetail[]

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.fieldErrors = options.fieldErrors ?? []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseApiErrorPayload(value: unknown): ApiErrorPayload | null {
  if (
    !isRecord(value) ||
    value.success !== false ||
    typeof value.code !== 'string' ||
    typeof value.message !== 'string'
  ) {
    return null
  }

  const errors = Array.isArray(value.errors)
    ? value.errors.filter(
        (detail): detail is ApiErrorDetail =>
          isRecord(detail) &&
          typeof detail.field === 'string' &&
          typeof detail.message === 'string',
      )
    : undefined

  return {
    success: false,
    code: value.code,
    message: value.message,
    ...(errors ? { errors } : {}),
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null
    const payload = parseApiErrorPayload(error.response?.data)

    if (payload) {
      return new ApiError(payload.message, {
        status,
        code: payload.code,
        fieldErrors: payload.errors,
        cause: error,
      })
    }

    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'

      return new ApiError(
        isTimeout
          ? 'La solicitud tardó demasiado. Intenta nuevamente.'
          : 'No pudimos conectar con el servicio. Revisa tu conexión e intenta nuevamente.',
        {
          status: null,
          code: isTimeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
          cause: error,
        },
      )
    }

    return new ApiError('Ocurrió un error al procesar la solicitud. Intenta nuevamente.', {
      status,
      code: 'REQUEST_FAILED',
      cause: error,
    })
  }

  return new ApiError('Ocurrió un error inesperado. Intenta nuevamente.', {
    status: null,
    code: 'UNKNOWN_ERROR',
    cause: error,
  })
}
