import type { components } from '@/api/generated/schema'

export type AuditLog = components['schemas']['AuditLog']
export type AuditScope = components['schemas']['AuditScope']
export type Pagination = components['schemas']['Pagination']

// The only entity types the backend records today. The filter still sends
// whatever is selected and the list renders unknown types as raw text.
export type AuditEntityType = 'USER' | 'PROPERTY'

// `from` and `to` are plain day strings (YYYY-MM-DD). They expand to UTC day
// boundaries at the API layer.
export interface AuditLogFilters {
  page: number
  pageSize: number
  scope?: AuditScope
  action?: string
  entityType?: AuditEntityType
  entityId?: number
  from?: string
  to?: string
}

export interface AuditLogListData {
  logs: AuditLog[]
  pagination: Pagination
}
