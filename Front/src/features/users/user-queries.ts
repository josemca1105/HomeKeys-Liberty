import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { normalizeApiError } from '@/api/errors'
import { fetchUser, fetchUsers } from './user.api'
import type { UserFilters } from './user.types'

export const userQueryKeys = {
  all: ['users'] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userQueryKeys.lists(), filters] as const,
  details: () => [...userQueryKeys.all, 'detail'] as const,
  detail: (userId: number) => [...userQueryKeys.details(), userId] as const,
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  const apiError = normalizeApiError(error)

  if (
    apiError.status === 400 ||
    apiError.status === 401 ||
    apiError.status === 403 ||
    apiError.status === 404
  ) {
    return false
  }

  return failureCount < 1
}

export function useUsersQuery(filters: UserFilters) {
  return useQuery({
    queryKey: userQueryKeys.list(filters),
    queryFn: ({ signal }) => fetchUsers(filters, signal),
    placeholderData: keepPreviousData,
    retry: shouldRetry,
    staleTime: 20_000,
  })
}

export function useUserQuery(userId: number | null) {
  return useQuery({
    queryKey: userQueryKeys.detail(userId ?? 0),
    queryFn: ({ signal }) => fetchUser(userId as number, signal),
    enabled: userId !== null,
    retry: shouldRetry,
    staleTime: 20_000,
  })
}
