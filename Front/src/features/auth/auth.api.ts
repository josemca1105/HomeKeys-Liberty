import { apiClient } from '@/api/client'
import type { components } from '@/api/generated/schema'
import type { ApiSuccess } from '@/api/types'
import type { LoginData, LoginInput, AuthUser } from './auth.types'

type ForgotPasswordRequest = components['schemas']['ForgotPasswordRequest']
type ResetPasswordRequest = components['schemas']['ResetPasswordRequest']
type UpdateOwnProfileRequest =
  components['schemas']['UpdateOwnProfileRequest']
type ChangePasswordRequest =
  components['schemas']['ChangePasswordRequest']
type EmptyDataResponse = components['schemas']['EmptyDataResponse']
type UserResponse = components['schemas']['UserResponse']

interface UserData {
  user: AuthUser
}

export async function loginRequest(input: LoginInput): Promise<LoginData> {
  const response = await apiClient.post<ApiSuccess<LoginData>>('/auth/login', input)

  return response.data.data
}

export async function getCurrentUserRequest(): Promise<AuthUser> {
  const response = await apiClient.get<ApiSuccess<UserData>>('/users/me')

  return response.data.data.user
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function forgotPasswordRequest(
  email: string,
): Promise<void> {
  await apiClient.post<ApiSuccess<Record<string, never>>>(
    '/auth/forgot-password',
    { email } satisfies ForgotPasswordRequest,
  )
}

export async function resetPasswordRequest(
  input: ResetPasswordRequest,
): Promise<void> {
  await apiClient.post<EmptyDataResponse>('/auth/reset-password', input)
}

export async function updateOwnProfileRequest(
  input: UpdateOwnProfileRequest,
): Promise<AuthUser> {
  const response = await apiClient.patch<UserResponse>('/users/me', input)

  return response.data.data.user
}

export async function changeOwnPasswordRequest(
  input: ChangePasswordRequest,
): Promise<void> {
  await apiClient.patch<EmptyDataResponse>('/users/me/password', input)
}
