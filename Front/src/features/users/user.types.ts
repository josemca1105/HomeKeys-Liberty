import type { components } from '@/api/generated/schema'
import type { UserRole } from '@/features/auth/auth.types'

export type User = components['schemas']['User']
export type Pagination = components['schemas']['Pagination']
export type Role = components['schemas']['Role']
export type CreateUserRequest = components['schemas']['CreateUserRequest']
export type UpdateUserRequest = components['schemas']['UpdateUserRequest']

export type UserSortBy = components['parameters']['UserSortBy']
export type UserSortOrder = components['parameters']['UserSortOrder']

export interface UserFilters {
  page: number
  pageSize: number
  search?: string
  role?: UserRole
  isActive?: boolean
  sortBy: UserSortBy
  sortOrder: UserSortOrder
}

export interface UserListData {
  users: User[]
  pagination: Pagination
}

export interface CreatedUserData {
  user: User
  invitationSent: boolean
}
