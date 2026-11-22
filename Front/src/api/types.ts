export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
}

export interface ApiErrorDetail {
  field: string
  message: string
}

export interface ApiErrorPayload {
  success: false
  code: string
  message: string
  errors?: ApiErrorDetail[]
}
