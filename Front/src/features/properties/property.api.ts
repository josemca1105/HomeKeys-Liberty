import { apiClient } from '@/api/client'
import type { components, paths } from '@/api/generated/schema'
import type {
  PropertyFilters,
  PropertyListData,
  Property,
  UpdatePropertyRequest,
} from './property.types'

type PropertyListResponse = components['schemas']['PropertyListResponse']
type PropertyResponse = components['schemas']['PropertyResponse']
type DeletePropertyResponse = components['schemas']['DeletePropertyResponse']
type UserListResponse = components['schemas']['UserListResponse']
type PropertyListRequestParams = NonNullable<
  paths['/api/v1/properties']['get']['parameters']['query']
>

export async function fetchProperties(
  filters: PropertyFilters,
  signal: AbortSignal,
): Promise<PropertyListData> {
  const params: PropertyListRequestParams = {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.code ? { code: filters.code } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.propertyType
      ? { propertyType: filters.propertyType }
      : {}),
    ...(filters.listingType ? { listingType: filters.listingType } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.neighborhood ? { neighborhood: filters.neighborhood } : {}),
    ...(filters.priceMin !== undefined
      ? { priceMin: filters.priceMin }
      : {}),
    ...(filters.priceMax !== undefined
      ? { priceMax: filters.priceMax }
      : {}),
    ...(filters.bedroomsMin !== undefined
      ? { bedroomsMin: filters.bedroomsMin }
      : {}),
    ...(filters.bathroomsMin !== undefined
      ? { bathroomsMin: filters.bathroomsMin }
      : {}),
    ...(filters.parkingSpacesMin !== undefined
      ? { parkingSpacesMin: filters.parkingSpacesMin }
      : {}),
    ...(filters.agentId !== undefined ? { agentId: filters.agentId } : {}),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }

  const response = await apiClient.get<PropertyListResponse>('/properties', {
    params,
    signal,
  })

  return response.data.data
}

export async function fetchProperty(
  propertyId: number,
  signal: AbortSignal,
): Promise<Property> {
  const response = await apiClient.get<PropertyResponse>(
    `/properties/${propertyId}`,
    { signal },
  )

  return response.data.data.property
}

export async function updateProperty(
  propertyId: number,
  input: UpdatePropertyRequest,
): Promise<Property> {
  const response = await apiClient.patch<PropertyResponse>(
    `/properties/${propertyId}`,
    input,
  )

  return response.data.data.property
}

export async function deleteProperty(
  propertyId: number,
): Promise<number> {
  const response = await apiClient.delete<DeletePropertyResponse>(
    `/properties/${propertyId}`,
  )

  return response.data.data.deletedId
}

export async function fetchAgentDirectory(
  signal: AbortSignal,
): Promise<UserListResponse['data']['users']> {
  const response = await apiClient.get<UserListResponse>('/users', {
    params: {
      page: 1,
      pageSize: 100,
      isActive: true,
      sortBy: 'firstName',
      sortOrder: 'asc',
    },
    signal,
  })

  return response.data.data.users
}
