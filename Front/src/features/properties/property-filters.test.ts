import { describe, expect, it } from 'vitest'
import {
  countAdvancedPropertyFilters,
  getSortValue,
  parsePropertyFilters,
  parseSortValue,
  serializePropertyFilters,
  DEFAULT_PROPERTY_FILTERS,
} from './property-filters'

describe('filtros de captaciones', () => {
  it('interpreta filtros válidos de la URL', () => {
    const filters = parsePropertyFilters(
      new URLSearchParams(
        'page=2&search=viñedo&status=ACTIVE&propertyType=HOUSE&listingType=SALE&priceMin=100000&priceMax=200000&bedroomsMin=3&agentId=4&sortBy=price&sortOrder=asc',
      ),
    )

    expect(filters).toMatchObject({
      page: 2,
      search: 'viñedo',
      status: 'ACTIVE',
      propertyType: 'HOUSE',
      listingType: 'SALE',
      priceMin: 100000,
      priceMax: 200000,
      bedroomsMin: 3,
      agentId: 4,
      sortBy: 'price',
      sortOrder: 'asc',
    })
  })

  it('ignora valores inválidos y aplica los valores predeterminados', () => {
    const filters = parsePropertyFilters(
      new URLSearchParams(
        'page=-1&status=UNKNOWN&propertyType=UNKNOWN&priceMin=-5&bedroomsMin=1.5&agentId=0&sortBy=unknown&sortOrder=sideways',
      ),
    )

    expect(filters.page).toBe(1)
    expect(filters.status).toBeUndefined()
    expect(filters.propertyType).toBeUndefined()
    expect(filters.priceMin).toBeUndefined()
    expect(filters.bedroomsMin).toBeUndefined()
    expect(filters.agentId).toBeUndefined()
    expect(filters.sortBy).toBe(DEFAULT_PROPERTY_FILTERS.sortBy)
    expect(filters.sortOrder).toBe(DEFAULT_PROPERTY_FILTERS.sortOrder)
  })

  it('serializa y vuelve a interpretar los filtros', () => {
    const filters = parsePropertyFilters(
      new URLSearchParams(
        'search=casa&status=PAUSED&city=Valencia&parkingSpacesMin=2&page=3&sortBy=title&sortOrder=asc',
      ),
    )
    const params = serializePropertyFilters(filters)

    expect(params.get('search')).toBe('casa')
    expect(params.get('status')).toBe('PAUSED')
    expect(params.get('city')).toBe('Valencia')
    expect(params.get('parkingSpacesMin')).toBe('2')
    expect(params.get('page')).toBe('3')
    expect(params.get('sortBy')).toBe('title')
    expect(params.get('sortOrder')).toBe('asc')
    expect(parsePropertyFilters(params)).toEqual(filters)
  })

  it('cuenta únicamente filtros avanzados', () => {
    const filters = parsePropertyFilters(
      new URLSearchParams(
        'search=casa&status=ACTIVE&city=Valencia&agentId=2',
      ),
    )

    expect(countAdvancedPropertyFilters(filters)).toBe(3)
  })

  it('interpreta y genera el valor de ordenamiento', () => {
    expect(parseSortValue('price:asc')).toEqual({
      sortBy: 'price',
      sortOrder: 'asc',
    })
    expect(parseSortValue('createdAt:sideways')).toBeNull()
    expect(getSortValue({ ...DEFAULT_PROPERTY_FILTERS, sortBy: 'price' })).toBe(
      'price:desc',
    )
  })
})
