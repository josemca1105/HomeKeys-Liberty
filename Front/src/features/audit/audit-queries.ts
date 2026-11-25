import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { normalizeApiError } from '@/api/errors'
import { fetchAuditLogs } from './audit.api'
import type { AuditLogFilters } from './audit.types'

// The history is append-only: read queries only, no mutations.
export const auditQueryKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditQueryKeys.all, 'list'] as const,
  list: (filters: AuditLogFilters) =>
    [...auditQueryKeys.lists(), filters] as const,
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

export function useAuditLogsQuery(filters: AuditLogFilters) {
  return useQuery({
    queryKey: auditQueryKeys.list(filters),
    queryFn: ({ signal }) => fetchAuditLogs(filters, signal),
    placeholderData: keepPreviousData,
    retry: shouldRetry,
    staleTime: 20_000,
  })
}
