import type { components } from '@/api/generated/schema'

export type Property = components['schemas']['Property']
export type PropertyPhoto = components['schemas']['PropertyPhoto']
export type PropertyStatus = components['schemas']['PropertyStatus']
export type PropertyType = components['schemas']['PropertyType']
export type ListingType = components['schemas']['ListingType']
export type Pagination = components['schemas']['Pagination']
export type CreatePropertyRequest = components['schemas']['CreatePropertyRequest']
export type UpdatePropertyRequest = components['schemas']['UpdatePropertyRequest']
export type PropertyPhotoBatch = components['schemas']['PropertyPhotoBatch']
export type PropertyPhotoUpload = components['schemas']['PropertyPhotoUpload']
export type PhotoUploadTarget = components['schemas']['PhotoUploadTarget']

export type PropertySortBy = 'createdAt' | 'updatedAt' | 'price' | 'title'
export type SortOrder = 'asc' | 'desc'

export interface PropertyFilters {
  page: number
  pageSize: number
  search?: string
  code?: string
  status?: PropertyStatus
  propertyType?: PropertyType
  listingType?: ListingType
  state?: string
  city?: string
  neighborhood?: string
  priceMin?: number
  priceMax?: number
  bedroomsMin?: number
  bathroomsMin?: number
  parkingSpacesMin?: number
  agentId?: number
  sortBy: PropertySortBy
  sortOrder: SortOrder
}

export interface PropertyListData {
  properties: Property[]
  pagination: Pagination
}

export interface AgentDirectoryEntry {
  id: number
  firstName: string
  lastName: string
  role: components['schemas']['Role']
}
