import type {
  Currency,
  ListingType,
  PropertyPhotoBatchStatus,
  PropertyPhotoUploadStatus,
  PropertyStatus,
  PropertyType,
} from "@prisma/client";

export interface CreatePropertyInput {
  agentId?: number;
  photoBatchId: string;
  coverUploadId?: string;
  title: string;
  propertyType: PropertyType;
  listingType: ListingType;
  description?: string | null;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string | null;
  address: string;
  neighborhood?: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  price: number;
  maintenanceFee?: number | null;
  isNegotiable?: boolean;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  squareMeters: number;
  lotSquareMeters?: number | null;
  yearBuilt?: number | null;
  apartmentFloor?: number | null;
  hasWaterTank?: boolean;
  hasPowerPlant?: boolean;
  isFurnished?: boolean;
  allowsPets?: boolean;
  hasPool?: boolean;
  hasGym?: boolean;
  hasBalcony?: boolean;
  hasAirConditioning?: boolean;
  hasSecurity?: boolean;
  hasElevator?: boolean;
  videoUrl?: string | null;
  virtualTourUrl?: string | null;
}

export interface UpdatePropertyInput {
  agentId?: number;
  title?: string;
  propertyType?: PropertyType;
  listingType?: ListingType;
  status?: PropertyStatus;
  description?: string | null;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string | null;
  address?: string;
  neighborhood?: string | null;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  price?: number;
  maintenanceFee?: number | null;
  isNegotiable?: boolean;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  squareMeters?: number;
  lotSquareMeters?: number | null;
  yearBuilt?: number | null;
  apartmentFloor?: number | null;
  hasWaterTank?: boolean;
  hasPowerPlant?: boolean;
  isFurnished?: boolean;
  allowsPets?: boolean;
  hasPool?: boolean;
  hasGym?: boolean;
  hasBalcony?: boolean;
  hasAirConditioning?: boolean;
  hasSecurity?: boolean;
  hasElevator?: boolean;
  videoUrl?: string | null;
  virtualTourUrl?: string | null;
}

export type PropertyPhotoMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface PropertyPhotoResponse {
  id: number;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  altText: string | null;
  sortOrder: number;
  isCover: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePhotoUploadTargetInput {
  mimeType: PropertyPhotoMimeType;
  sizeBytes: number;
}

export interface ConfirmPropertyPhotoInput {
  storageKey: string;
  altText?: string | null;
}

export interface PropertyPhotoUploadResponse {
  id: string;
  previewUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  altText: string | null;
  sortOrder: number;
  status: PropertyPhotoUploadStatus;
  createdAt: Date;
}

export interface PropertyPhotoBatchResponse {
  id: string;
  status: PropertyPhotoBatchStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  uploads: PropertyPhotoUploadResponse[];
}

export interface ReorderPropertyPhotosInput {
  photoIds: number[];
}

export interface PropertyPhotoContent {
  body: Buffer;
  mimeType: string;
  sizeBytes: number;
}

export interface PropertyResponse {
  id: number;
  agentId: number;
  code: string;
  title: string;
  propertyType: PropertyType;
  listingType: ListingType;
  status: PropertyStatus;
  description: string | null;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string | null;
  address: string;
  neighborhood: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  price: string;
  currency: Currency;
  maintenanceFee: string | null;
  isNegotiable: boolean;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  squareMeters: string;
  lotSquareMeters: string | null;
  yearBuilt: number | null;
  apartmentFloor: number | null;
  hasWaterTank: boolean;
  hasPowerPlant: boolean;
  isFurnished: boolean;
  allowsPets: boolean;
  hasPool: boolean;
  hasGym: boolean;
  hasBalcony: boolean;
  hasAirConditioning: boolean;
  hasSecurity: boolean;
  hasElevator: boolean;
  videoUrl: string | null;
  virtualTourUrl: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  photos: PropertyPhotoResponse[];
}

export type PropertySortField =
  | "createdAt"
  | "updatedAt"
  | "price"
  | "title";

export type PropertySortOrder = "asc" | "desc";

export interface ListPropertiesQuery {
  page: number;
  pageSize: number;
  search?: string;
  code?: string;
  status?: PropertyStatus;
  propertyType?: PropertyType;
  listingType?: ListingType;
  state?: string;
  city?: string;
  neighborhood?: string;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  parkingSpacesMin?: number;
  agentId?: number;
  sortBy: PropertySortField;
  sortOrder: PropertySortOrder;
}

export interface PropertyPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedPropertiesResult {
  properties: PropertyResponse[];
  pagination: PropertyPagination;
}
