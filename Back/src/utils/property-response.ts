import type { Photo, Property } from "@prisma/client";
import type {
  PropertyPhotoResponse,
  PropertyResponse,
} from "../types/property";

export const toPropertyPhotoResponse = (
  photo: Photo,
): PropertyPhotoResponse => {
  return {
    id: photo.id,
    url: `/api/v1/properties/${photo.propertyId}/photos/${photo.id}/content`,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    width: photo.width,
    height: photo.height,
    altText: photo.altText,
    sortOrder: photo.sortOrder,
    isCover: photo.isCover,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
  };
};

// Decimal values are serialized as fixed strings so callers never lose money
// or area precision through JavaScript floating-point arithmetic.
export const toPropertyResponse = (
  property: Property,
  photos: Photo[],
): PropertyResponse => {
  return {
    id: property.id,
    agentId: property.agentId,
    code: property.code,
    title: property.title,
    propertyType: property.propertyType,
    listingType: property.listingType,
    status: property.status,
    description: property.description,
    ownerName: property.ownerName,
    ownerPhone: property.ownerPhone,
    ownerEmail: property.ownerEmail,
    address: property.address,
    neighborhood: property.neighborhood,
    city: property.city,
    state: property.state,
    latitude: property.latitude.toNumber(),
    longitude: property.longitude.toNumber(),
    price: property.price.toFixed(2),
    currency: property.currency,
    maintenanceFee: property.maintenanceFee?.toFixed(2) ?? null,
    isNegotiable: property.isNegotiable,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parkingSpaces: property.parkingSpaces,
    squareMeters: property.squareMeters.toFixed(2),
    lotSquareMeters: property.lotSquareMeters?.toFixed(2) ?? null,
    yearBuilt: property.yearBuilt,
    apartmentFloor: property.apartmentFloor,
    hasWaterTank: property.hasWaterTank,
    hasPowerPlant: property.hasPowerPlant,
    isFurnished: property.isFurnished,
    allowsPets: property.allowsPets,
    hasPool: property.hasPool,
    hasGym: property.hasGym,
    hasBalcony: property.hasBalcony,
    hasAirConditioning: property.hasAirConditioning,
    hasSecurity: property.hasSecurity,
    hasElevator: property.hasElevator,
    videoUrl: property.videoUrl,
    virtualTourUrl: property.virtualTourUrl,
    closedAt: property.closedAt,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
    photos: photos.map(toPropertyPhotoResponse),
  };
};
