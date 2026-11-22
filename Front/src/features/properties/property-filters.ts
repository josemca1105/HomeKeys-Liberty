import type {
  ListingType,
  PropertyFilters,
  PropertySortBy,
  PropertyStatus,
  PropertyType,
  SortOrder,
} from './property.types'

export const PROPERTY_PAGE_SIZE = 12

export const PROPERTY_TYPES: readonly PropertyType[] = [
  'HOUSE',
  'APARTMENT',
  'TOWNHOUSE',
  'LAND',
  'COMMERCIAL',
  'OFFICE',
  'WAREHOUSE',
  'FARM',
]

export const LISTING_TYPES: readonly ListingType[] = ['SALE', 'RENT']

export const PROPERTY_STATUSES: readonly PropertyStatus[] = [
  'ACTIVE',
  'PAUSED',
  'CLOSED',
]

export const PROPERTY_SORT_BY_OPTIONS: readonly PropertySortBy[] = [
  'createdAt',
  'updatedAt',
  'price',
  'title',
]

export const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Más recientes' },
  { value: 'createdAt:asc', label: 'Más antiguas' },
  { value: 'updatedAt:desc', label: 'Actualizadas recientemente' },
  { value: 'price:asc', label: 'Precio: menor a mayor' },
  { value: 'price:desc', label: 'Precio: mayor a menor' },
  { value: 'title:asc', label: 'Título: A–Z' },
] as const

export const DEFAULT_PROPERTY_FILTERS: PropertyFilters = {
  page: 1,
  pageSize: PROPERTY_PAGE_SIZE,
  sortBy: 'createdAt',
  sortOrder: 'desc',
}

export interface PropertyFilterDraft {
  code: string
  status: string
  propertyType: string
  listingType: string
  state: string
  city: string
  neighborhood: string
  priceMin: string
  priceMax: string
  bedroomsMin: string
  bathroomsMin: string
  parkingSpacesMin: string
  agentId: string
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

function readNumber(
  params: URLSearchParams,
  key: string,
  options: { integer?: boolean; min?: number } = {},
): number | undefined {
  const rawValue = params.get(key)

  if (rawValue === null || rawValue.trim() === '') {
    return undefined
  }

  const value = Number(rawValue)

  if (
    !Number.isFinite(value) ||
    value < (options.min ?? 0) ||
    (options.integer && !Number.isInteger(value))
  ) {
    return undefined
  }

  return value
}

export function parsePropertyFilters(
  params: URLSearchParams,
): PropertyFilters {
  const page = readNumber(params, 'page', { integer: true, min: 1 })
  const search = readText(params, 'search', 100)
  const code = readText(params, 'code', 22)
  const status = params.get('status')
  const propertyType = params.get('propertyType')
  const listingType = params.get('listingType')
  const state = readText(params, 'state', 100)
  const city = readText(params, 'city', 100)
  const neighborhood = readText(params, 'neighborhood', 100)
  const priceMin = readNumber(params, 'priceMin', { min: 0 })
  const priceMax = readNumber(params, 'priceMax', { min: 0 })
  const bedroomsMin = readNumber(params, 'bedroomsMin', {
    integer: true,
    min: 0,
  })
  const bathroomsMin = readNumber(params, 'bathroomsMin', {
    integer: true,
    min: 0,
  })
  const parkingSpacesMin = readNumber(params, 'parkingSpacesMin', {
    integer: true,
    min: 0,
  })
  const agentId = readNumber(params, 'agentId', {
    integer: true,
    min: 1,
  })
  const sortBy = params.get('sortBy')
  const sortOrder = params.get('sortOrder')

  return {
    page: page ?? 1,
    pageSize: PROPERTY_PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(code ? { code } : {}),
    ...(isOneOf(status, PROPERTY_STATUSES) ? { status } : {}),
    ...(isOneOf(propertyType, PROPERTY_TYPES) ? { propertyType } : {}),
    ...(isOneOf(listingType, LISTING_TYPES) ? { listingType } : {}),
    ...(state ? { state } : {}),
    ...(city ? { city } : {}),
    ...(neighborhood ? { neighborhood } : {}),
    ...(priceMin !== undefined ? { priceMin } : {}),
    ...(priceMax !== undefined ? { priceMax } : {}),
    ...(bedroomsMin !== undefined ? { bedroomsMin } : {}),
    ...(bathroomsMin !== undefined ? { bathroomsMin } : {}),
    ...(parkingSpacesMin !== undefined ? { parkingSpacesMin } : {}),
    ...(agentId !== undefined ? { agentId } : {}),
    sortBy: isOneOf(sortBy, PROPERTY_SORT_BY_OPTIONS)
      ? sortBy
      : DEFAULT_PROPERTY_FILTERS.sortBy,
    sortOrder:
      sortOrder === 'asc' || sortOrder === 'desc'
        ? sortOrder
        : DEFAULT_PROPERTY_FILTERS.sortOrder,
  }
}

export function serializePropertyFilters(
  filters: PropertyFilters,
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.code) params.set('code', filters.code)
  if (filters.status) params.set('status', filters.status)
  if (filters.propertyType) params.set('propertyType', filters.propertyType)
  if (filters.listingType) params.set('listingType', filters.listingType)
  if (filters.state) params.set('state', filters.state)
  if (filters.city) params.set('city', filters.city)
  if (filters.neighborhood) params.set('neighborhood', filters.neighborhood)
  if (filters.priceMin !== undefined)
    params.set('priceMin', String(filters.priceMin))
  if (filters.priceMax !== undefined)
    params.set('priceMax', String(filters.priceMax))
  if (filters.bedroomsMin !== undefined)
    params.set('bedroomsMin', String(filters.bedroomsMin))
  if (filters.bathroomsMin !== undefined)
    params.set('bathroomsMin', String(filters.bathroomsMin))
  if (filters.parkingSpacesMin !== undefined)
    params.set('parkingSpacesMin', String(filters.parkingSpacesMin))
  if (filters.agentId !== undefined)
    params.set('agentId', String(filters.agentId))
  if (filters.page > 1) params.set('page', String(filters.page))
  if (filters.sortBy !== DEFAULT_PROPERTY_FILTERS.sortBy)
    params.set('sortBy', filters.sortBy)
  if (filters.sortOrder !== DEFAULT_PROPERTY_FILTERS.sortOrder)
    params.set('sortOrder', filters.sortOrder)

  return params
}

export function getSortValue(filters: PropertyFilters): string {
  return `${filters.sortBy}:${filters.sortOrder}`
}

export function parseSortValue(
  value: string,
): { sortBy: PropertySortBy; sortOrder: SortOrder } | null {
  const [sortBy, sortOrder] = value.split(':')

  if (
    !sortBy ||
    !sortOrder ||
    !isOneOf(sortBy, PROPERTY_SORT_BY_OPTIONS) ||
    (sortOrder !== 'asc' && sortOrder !== 'desc')
  ) {
    return null
  }

  return { sortBy, sortOrder }
}

export function hasPropertyFilters(filters: PropertyFilters): boolean {
  return Boolean(
    filters.search ||
      filters.code ||
      filters.status ||
      filters.propertyType ||
      filters.listingType ||
      filters.state ||
      filters.city ||
      filters.neighborhood ||
      filters.priceMin !== undefined ||
      filters.priceMax !== undefined ||
      filters.bedroomsMin !== undefined ||
      filters.bathroomsMin !== undefined ||
      filters.parkingSpacesMin !== undefined ||
      filters.agentId !== undefined,
  )
}

export function countAdvancedPropertyFilters(
  filters: PropertyFilters,
): number {
  const values = [
    filters.code,
    filters.status,
    filters.propertyType,
    filters.listingType,
    filters.state,
    filters.city,
    filters.neighborhood,
    filters.priceMin,
    filters.priceMax,
    filters.bedroomsMin,
    filters.bathroomsMin,
    filters.parkingSpacesMin,
    filters.agentId,
  ]

  return values.filter((value) => value !== undefined && value !== '').length
}

export function filtersToDraft(filters: PropertyFilters): PropertyFilterDraft {
  return {
    code: filters.code ?? '',
    status: filters.status ?? '',
    propertyType: filters.propertyType ?? '',
    listingType: filters.listingType ?? '',
    state: filters.state ?? '',
    city: filters.city ?? '',
    neighborhood: filters.neighborhood ?? '',
    priceMin: filters.priceMin !== undefined ? String(filters.priceMin) : '',
    priceMax: filters.priceMax !== undefined ? String(filters.priceMax) : '',
    bedroomsMin:
      filters.bedroomsMin !== undefined ? String(filters.bedroomsMin) : '',
    bathroomsMin:
      filters.bathroomsMin !== undefined ? String(filters.bathroomsMin) : '',
    parkingSpacesMin:
      filters.parkingSpacesMin !== undefined
        ? String(filters.parkingSpacesMin)
        : '',
    agentId: filters.agentId !== undefined ? String(filters.agentId) : '',
  }
}

function parseDraftNumber(
  value: string,
  options: { integer?: boolean; min?: number } = {},
): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  const parsed = Number(value)

  if (
    !Number.isFinite(parsed) ||
    parsed < (options.min ?? 0) ||
    (options.integer && !Number.isInteger(parsed))
  ) {
    throw new Error('Número inválido.')
  }

  return parsed
}

export function parseFilterDraft(
  draft: PropertyFilterDraft,
): { patch: Partial<PropertyFilters> } | { error: string } {
  try {
    const priceMin = parseDraftNumber(draft.priceMin, { min: 0 })
    const priceMax = parseDraftNumber(draft.priceMax, { min: 0 })

    if (
      priceMin !== undefined &&
      priceMax !== undefined &&
      priceMin > priceMax
    ) {
      return { error: 'El precio mínimo no puede ser mayor que el máximo.' }
    }

    return {
      patch: {
        code: draft.code.trim() || undefined,
        status: draft.status ? (draft.status as PropertyStatus) : undefined,
        propertyType: draft.propertyType
          ? (draft.propertyType as PropertyType)
          : undefined,
        listingType: draft.listingType
          ? (draft.listingType as ListingType)
          : undefined,
        state: draft.state.trim() || undefined,
        city: draft.city.trim() || undefined,
        neighborhood: draft.neighborhood.trim() || undefined,
        priceMin,
        priceMax,
        bedroomsMin: parseDraftNumber(draft.bedroomsMin, {
          integer: true,
          min: 0,
        }),
        bathroomsMin: parseDraftNumber(draft.bathroomsMin, {
          integer: true,
          min: 0,
        }),
        parkingSpacesMin: parseDraftNumber(draft.parkingSpacesMin, {
          integer: true,
          min: 0,
        }),
        agentId: parseDraftNumber(draft.agentId, {
          integer: true,
          min: 1,
        }),
      },
    }
  } catch {
    return { error: 'Revisa los valores numéricos de los filtros.' }
  }
}
