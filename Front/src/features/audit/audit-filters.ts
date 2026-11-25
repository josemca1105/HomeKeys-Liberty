import type { AuditEntityType, AuditLogFilters, AuditScope } from './audit.types'

export const AUDIT_PAGE_SIZE = 20

export const AUDIT_SCOPES: readonly AuditScope[] = ['SECURITY', 'BUSINESS']

export const AUDIT_ENTITY_TYPES: readonly AuditEntityType[] = [
  'USER',
  'PROPERTY',
]

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const DEFAULT_AUDIT_FILTERS: AuditLogFilters = {
  page: 1,
  pageSize: AUDIT_PAGE_SIZE,
}

function isOneOf<T extends string>(
  value: string | null,
  options: readonly T[],
): value is T {
  return value !== null && (options as readonly string[]).includes(value)
}

function readText(
  params: URLSearchParams,
  key: string,
  maxLength: number,
): string | undefined {
  const value = params.get(key)?.trim()

  if (!value) {
    return undefined
  }

  return value.slice(0, maxLength)
}

function readPage(params: URLSearchParams): number | undefined {
  const rawValue = params.get('page')

  if (rawValue === null || rawValue.trim() === '') {
    return undefined
  }

  const value = Number(rawValue)

  if (!Number.isInteger(value) || value < 1) {
    return undefined
  }

  return value
}

function readEntityId(params: URLSearchParams): number | undefined {
  const rawValue = params.get('entityId')

  if (rawValue === null || rawValue.trim() === '') {
    return undefined
  }

  const value = Number(rawValue)

  if (!Number.isInteger(value) || value < 1) {
    return undefined
  }

  return value
}

function readDate(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)

  if (!value || !DATE_PATTERN.test(value)) {
    return undefined
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return value
}

export function parseAuditFilters(params: URLSearchParams): AuditLogFilters {
  const scope = params.get('scope')
  const action = readText(params, 'action', 80)
  const entityType = params.get('entityType')
  const entityId = readEntityId(params)
  const from = readDate(params, 'from')
  const to = readDate(params, 'to')

  // The server rejects a range where from > to; drop the upper bound instead
  // of ever sending an invalid query.
  const safeTo = from && to && from > to ? undefined : to

  return {
    page: readPage(params) ?? 1,
    pageSize: AUDIT_PAGE_SIZE,
    ...(isOneOf(scope, AUDIT_SCOPES) ? { scope } : {}),
    ...(action ? { action } : {}),
    ...(isOneOf(entityType, AUDIT_ENTITY_TYPES) ? { entityType } : {}),
    ...(entityId !== undefined ? { entityId } : {}),
    ...(from ? { from } : {}),
    ...(safeTo ? { to: safeTo } : {}),
  }
}

export function serializeAuditFilters(
  filters: AuditLogFilters,
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.scope) params.set('scope', filters.scope)
  if (filters.action) params.set('action', filters.action)
  if (filters.entityType) params.set('entityType', filters.entityType)
  if (filters.entityId !== undefined)
    params.set('entityId', String(filters.entityId))
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.page > 1) params.set('page', String(filters.page))

  return params
}

export function hasAuditFilters(filters: AuditLogFilters): boolean {
  return Boolean(
    filters.scope ||
      filters.action ||
      filters.entityType ||
      filters.entityId !== undefined ||
      filters.from ||
      filters.to,
  )
}
