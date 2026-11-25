import { apiClient } from '@/api/client'
import type { components, paths } from '@/api/generated/schema'
import type {
  CreatedUserData,
  CreateUserRequest,
  UpdateUserRequest,
  User,
  UserFilters,
  UserListData,
} from './user.types'

type UserListResponse = components['schemas']['UserListResponse']
type UserResponse = components['schemas']['UserResponse']
type CreatedUserResponse = components['schemas']['CreatedUserResponse']
type UpdateUserResponse = components['schemas']['UpdateUserResponse']
type EmailSentResponse = components['schemas']['EmailSentResponse']
type DeleteUserResponse = components['schemas']['DeleteUserResponse']
type UserListRequestParams = NonNullable<
  paths['/api/v1/users']['get']['parameters']['query']
>

export async function fetchUsers(
  filters: UserFilters,
  signal: AbortSignal,
): Promise<UserListData> {
  const params: UserListRequestParams = {
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.isActive !== undefined
      ? { isActive: filters.isActive ? 'true' : 'false' }
      : {}),
  }

  const response = await apiClient.get<UserListResponse>('/users', {
    params,
    signal,
  })

  return response.data.data
}

export async function fetchUser(
  userId: number,
  signal: AbortSignal,
): Promise<User> {
  const response = await apiClient.get<UserResponse>(`/users/${userId}`, {
    signal,
  })

  return response.data.data.user
}

export async function createUser(
  input: CreateUserRequest,
): Promise<CreatedUserData> {
  const response = await apiClient.post<CreatedUserResponse>('/users/add', input)

  return response.data.data
}

export async function updateUser(
  userId: number,
  input: UpdateUserRequest,
): Promise<User> {
  const response = await apiClient.patch<UpdateUserResponse>(
    `/users/${userId}`,
    input,
  )

  return response.data.data.user
}

export async function resendUserInvitation(userId: number): Promise<boolean> {
  const response = await apiClient.post<EmailSentResponse>(
    `/users/${userId}/resend-invitation`,
  )

  return response.data.data.emailSent
}

export async function sendUserPasswordReset(userId: number): Promise<boolean> {
  const response = await apiClient.post<EmailSentResponse>(
    `/users/${userId}/send-password-reset`,
  )

  return response.data.data.emailSent
}

export async function deleteUser(userId: number): Promise<number> {
  const response = await apiClient.delete<DeleteUserResponse>(
    `/users/${userId}`,
  )

  return response.data.data.deletedId
}
