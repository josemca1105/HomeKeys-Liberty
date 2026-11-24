import { z } from 'zod'
import {
  createPropertySchema,
  toPropertyRequestFields,
} from '../create/create-property.schema'
import type { Property, UpdatePropertyRequest } from '../property.types'

const agentIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Selecciona un agente válido.')
  .refine(
    (value) => Number(value) >= 1,
    'Selecciona un agente válido.',
  )

export const editPropertySchema = createPropertySchema.extend({
  agentId: agentIdSchema,
})

export type EditPropertyFormValues = z.infer<typeof editPropertySchema>

export function toEditPropertyFormValues(
  property: Property,
): EditPropertyFormValues {
  return {
    agentId: String(property.agentId),
    title: property.title,
    propertyType: property.propertyType,
    listingType: property.listingType,
    description: property.description ?? '',
    ownerName: property.ownerName,
    ownerPhone: property.ownerPhone,
    ownerEmail: property.ownerEmail ?? '',
    address: property.address,
    neighborhood: property.neighborhood ?? '',
    city: property.city,
    state: property.state,
    latitude: String(property.latitude),
    longitude: String(property.longitude),
    price: String(property.price),
    maintenanceFee:
      property.maintenanceFee === null
        ? ''
        : String(property.maintenanceFee),
    isNegotiable: property.isNegotiable,
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
    parkingSpaces: String(property.parkingSpaces),
    squareMeters: String(property.squareMeters),
    lotSquareMeters:
      property.lotSquareMeters === null
        ? ''
        : String(property.lotSquareMeters),
    yearBuilt:
      property.yearBuilt === null ? '' : String(property.yearBuilt),
    apartmentFloor:
      property.apartmentFloor === null
        ? ''
        : String(property.apartmentFloor),
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
    videoUrl: property.videoUrl ?? '',
    virtualTourUrl: property.virtualTourUrl ?? '',
  }
}

export function toUpdatePropertyRequest(
  values: EditPropertyFormValues,
  options: { isAdmin: boolean },
): UpdatePropertyRequest {
  return {
    ...toPropertyRequestFields(values),
    ...(options.isAdmin ? { agentId: Number(values.agentId) } : {}),
  }
}
