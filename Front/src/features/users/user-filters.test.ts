import { describe, expect, it } from 'vitest'
import {
  DEFAULT_USER_FILTERS,
  getUserSortValue,
  hasUserFilters,
  parseUserFilters,
  parseUserSortValue,
  serializeUserFilters,
} from './user-filters'

describe('filtros de usuarios', () => {
  it('interpreta filtros válidos de la URL', () => {
    const filters = parseUserFilters(
      new URLSearchParams(
        'page=3&search=ana&role=ADMIN&isActive=false&sortBy=firstName&sortOrder=asc',
      ),
    )

    expect(filters).toMatchObject({
      page: 3,
      search: 'ana',
      role: 'ADMIN',
      isActive: false,
      sortBy: 'firstName',
      sortOrder: 'asc',
    })
  })

  it('ignora valores inválidos y aplica los valores predeterminados', () => {
    const filters = parseUserFilters(
      new URLSearchParams(
        'page=0&role=SUPERUSER&isActive=maybe&sortBy=unknown&sortOrder=sideways',
      ),
    )

    expect(filters.page).toBe(1)
    expect(filters.role).toBeUndefined()
    expect(filters.isActive).toBeUndefined()
    expect(filters.search).toBeUndefined()
    expect(filters.sortBy).toBe(DEFAULT_USER_FILTERS.sortBy)
    expect(filters.sortOrder).toBe(DEFAULT_USER_FILTERS.sortOrder)
  })

  it('serializa y vuelve a interpretar los filtros', () => {
    const filters = parseUserFilters(
      new URLSearchParams(
        'search=ana&role=PARTNER&isActive=true&page=2&sortBy=email&sortOrder=asc',
      ),
    )
    const params = serializeUserFilters(filters)

    expect(params.get('search')).toBe('ana')
    expect(params.get('role')).toBe('PARTNER')
    expect(params.get('isActive')).toBe('true')
    expect(params.get('page')).toBe('2')
    expect(params.get('sortBy')).toBe('email')
    expect(params.get('sortOrder')).toBe('asc')
    expect(parseUserFilters(params)).toEqual(filters)
  })

  it('detecta si hay filtros activos', () => {
    expect(hasUserFilters(parseUserFilters(new URLSearchParams()))).toBe(false)
    expect(
      hasUserFilters(parseUserFilters(new URLSearchParams('role=ADMIN'))),
    ).toBe(true)
    expect(
      hasUserFilters(parseUserFilters(new URLSearchParams('isActive=false'))),
    ).toBe(true)
  })

  it('interpreta y genera el valor de ordenamiento', () => {
    expect(parseUserSortValue('firstName:asc')).toEqual({
      sortBy: 'firstName',
      sortOrder: 'asc',
    })
    expect(parseUserSortValue('createdAt:sideways')).toBeNull()
    expect(
      getUserSortValue({ ...DEFAULT_USER_FILTERS, sortBy: 'firstName' }),
    ).toBe('firstName:desc')
  })
})
