import { apiClient } from '@/api/client'
import type { ApiSuccess } from '@/api/types'
import type { LoginData, LoginInput, AuthUser } from './auth.types'

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
