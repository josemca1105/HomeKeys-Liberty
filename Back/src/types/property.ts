import type {
  Currency,
  ListingType,
  PropertyStatus,
  PropertyType,
} from "@prisma/client";

export interface CreatePropertyInput {
  agentId?: number;
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
}
