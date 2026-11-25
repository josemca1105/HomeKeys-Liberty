import type { UserRole } from '@/features/auth/auth.types'
import type { UserFilters, UserSortBy, UserSortOrder } from './user.types'

export const USER_PAGE_SIZE = 20

export const USER_ROLES: readonly UserRole[] = ['ADMIN', 'PARTNER']

export const USER_SORT_BY_OPTIONS: readonly UserSortBy[] = [
  'createdAt',
  'firstName',
  'lastName',
  'email',
  'role',
]

export const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Más recientes' },
  { value: 'createdAt:asc', label: 'Más antiguos' },
  { value: 'firstName:asc', label: 'Nombre: A–Z' },
  { value: 'firstName:desc', label: 'Nombre: Z–A' },
  { value: 'lastName:asc', label: 'Apellido: A–Z' },
  { value: 'email:asc', label: 'Correo: A–Z' },
] as const

export const DEFAULT_USER_FILTERS: UserFilters = {
  page: 1,
  pageSize: USER_PAGE_SIZE,
  sortBy: 'createdAt',
  sortOrder: 'desc',
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

function readIsActive(params: URLSearchParams): boolean | undefined {
  const value = params.get('isActive')

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return undefined
}

export function parseUserFilters(params: URLSearchParams): UserFilters {
  const search = readText(params, 'search', 100)
  const role = params.get('role')
  const isActive = readIsActive(params)
  const sortBy = params.get('sortBy')
  const sortOrder = params.get('sortOrder')

  return {
    page: readPage(params) ?? 1,
    pageSize: USER_PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(isOneOf(role, USER_ROLES) ? { role } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    sortBy: isOneOf(sortBy, USER_SORT_BY_OPTIONS)
      ? sortBy
      : DEFAULT_USER_FILTERS.sortBy,
    sortOrder:
      sortOrder === 'asc' || sortOrder === 'desc'
        ? sortOrder
        : DEFAULT_USER_FILTERS.sortOrder,
  }
}

export function serializeUserFilters(
  filters: UserFilters,
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.role) params.set('role', filters.role)
  if (filters.isActive !== undefined)
    params.set('isActive', filters.isActive ? 'true' : 'false')
  if (filters.page > 1) params.set('page', String(filters.page))
  if (filters.sortBy !== DEFAULT_USER_FILTERS.sortBy)
    params.set('sortBy', filters.sortBy)
  if (filters.sortOrder !== DEFAULT_USER_FILTERS.sortOrder)
    params.set('sortOrder', filters.sortOrder)

  return params
}

export function getUserSortValue(filters: UserFilters): string {
  return `${filters.sortBy}:${filters.sortOrder}`
}

export function parseUserSortValue(
  value: string,
): { sortBy: UserSortBy; sortOrder: UserSortOrder } | null {
  const [sortBy, sortOrder] = value.split(':')

  if (
    !sortBy ||
    !sortOrder ||
    !isOneOf(sortBy, USER_SORT_BY_OPTIONS) ||
    (sortOrder !== 'asc' && sortOrder !== 'desc')
  ) {
    return null
  }

  return { sortBy, sortOrder }
}

export function hasUserFilters(filters: UserFilters): boolean {
  return Boolean(
    filters.search || filters.role || filters.isActive !== undefined,
  )
}
