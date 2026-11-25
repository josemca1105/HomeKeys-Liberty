import { apiClient } from '@/api/client'
import type { components, paths } from '@/api/generated/schema'
import type { AuditLogFilters, AuditLogListData } from './audit.types'

type AuditLogListResponse = components['schemas']['AuditLogListResponse']
type AuditLogRequestParams = NonNullable<
  paths['/api/v1/audit-logs']['get']['parameters']['query']
>

// Date-only filters expand to UTC day boundaries so an inclusive `to` covers
// the whole selected day instead of stopping at midnight.
export function auditDateToIsoBound(
  value: string,
  endOfDay: boolean,
): string {
  return endOfDay
    ? `${value}T23:59:59.999Z`
    : `${value}T00:00:00.000Z`
}

export async function fetchAuditLogs(
  filters: AuditLogFilters,
  signal: AbortSignal,
): Promise<AuditLogListData> {
  const params: AuditLogRequestParams = {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(filters.scope ? { scope: filters.scope } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId !== undefined
      ? { entityId: filters.entityId }
      : {}),
    ...(filters.from
      ? { from: auditDateToIsoBound(filters.from, false) }
      : {}),
    ...(filters.to ? { to: auditDateToIsoBound(filters.to, true) } : {}),
  }

  const response = await apiClient.get<AuditLogListResponse>('/audit-logs', {
    params,
    signal,
  })

  return response.data.data
}
