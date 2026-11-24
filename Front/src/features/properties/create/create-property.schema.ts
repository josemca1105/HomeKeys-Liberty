import { z } from 'zod'
import type {
  CreatePropertyRequest,
  ListingType,
  PropertyType,
} from '../property.types'

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `Ingresa ${label}.`)
    .max(maxLength, `${label} no puede superar los ${maxLength} caracteres.`)

const optionalText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${label} no puede superar los ${maxLength} caracteres.`)

const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Ingresa un teléfono válido.')
  .max(20, 'El teléfono no puede superar los 20 caracteres.')
  .regex(/^\+?[0-9\s().-]{6,20}$/, 'Ingresa un teléfono válido.')

const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || z.string().email().safeParse(value).success,
    'Ingresa un correo electrónico válido.',
  )

const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) {
      return true
    }

    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Ingresa una URL http(s) válida.')

const requiredNumber = (
  message: string,
  options: { min: number; max: number; integer?: boolean },
) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => {
      const number = Number(value)
      return (
        Number.isFinite(number) &&
        number >= options.min &&
        number <= options.max &&
        (!options.integer || Number.isInteger(number))
      )
    }, message)

const optionalNumber = (
  message: string,
  options: { min: number; max?: number; integer?: boolean },
) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!value) {
        return true
      }

      const number = Number(value)
      return (
        Number.isFinite(number) &&
        number >= options.min &&
        (options.max === undefined || number <= options.max) &&
        (!options.integer || Number.isInteger(number))
      )
    }, message)

export const createPropertySchema = z.object({
  title: requiredText('el título', 200),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'TOWNHOUSE', 'LAND', 'COMMERCIAL', 'OFFICE', 'WAREHOUSE', 'FARM'], {
    message: 'Selecciona el tipo de propiedad.',
  }),
  listingType: z.enum(['SALE', 'RENT'], {
    message: 'Selecciona la operación.',
  }),
  description: optionalText('la descripción', 2000),
  ownerName: requiredText('el nombre del propietario', 150),
  ownerPhone: phoneSchema,
  ownerEmail: optionalEmailSchema,
  address: requiredText('la dirección', 500),
  neighborhood: optionalText('la zona o urbanización', 100),
  city: requiredText('la ciudad', 100),
  state: requiredText('el estado', 100),
  latitude: requiredNumber(
    'La latitud debe estar entre -90 y 90.',
    { min: -90, max: 90 },
  ),
  longitude: requiredNumber(
    'La longitud debe estar entre -180 y 180.',
    { min: -180, max: 180 },
  ),
  price: requiredNumber(
    'Ingresa un precio válido.',
    { min: 0, max: 9999999999.99 },
  ),
  maintenanceFee: optionalNumber(
    'Ingresa un mantenimiento válido.',
    { min: 0, max: 9999999999.99 },
  ),
  isNegotiable: z.boolean(),
  bedrooms: requiredNumber(
    'Ingresa las habitaciones.',
    { min: 0, max: 1000, integer: true },
  ),
  bathrooms: requiredNumber(
    'Ingresa los baños.',
    { min: 0, max: 1000, integer: true },
  ),
  parkingSpaces: requiredNumber(
    'Ingresa los estacionamientos.',
    { min: 0, max: 1000, integer: true },
  ),
  squareMeters: requiredNumber(
    'Ingresa el área de construcción.',
    { min: 0.01, max: 99999999.99 },
  ),
  lotSquareMeters: optionalNumber(
    'Ingresa un área de terreno válida.',
    { min: 0.01 },
  ),
  yearBuilt: optionalNumber(
    'Ingresa un año válido.',
    { min: 1800, max: 9999, integer: true },
  ),
  apartmentFloor: optionalNumber(
    'Ingresa un piso válido.',
    { min: 0, max: 500, integer: true },
  ),
  hasWaterTank: z.boolean(),
  hasPowerPlant: z.boolean(),
  isFurnished: z.boolean(),
  allowsPets: z.boolean(),
  hasPool: z.boolean(),
  hasGym: z.boolean(),
  hasBalcony: z.boolean(),
  hasAirConditioning: z.boolean(),
  hasSecurity: z.boolean(),
  hasElevator: z.boolean(),
  videoUrl: optionalUrlSchema,
  virtualTourUrl: optionalUrlSchema,
})

export type CreatePropertyFormValues = z.infer<typeof createPropertySchema>

export const CREATE_PROPERTY_DEFAULT_VALUES: CreatePropertyFormValues = {
  title: '',
  propertyType: 'HOUSE',
  listingType: 'SALE',
  description: '',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  address: '',
  neighborhood: '',
  city: '',
  state: '',
  latitude: '10.1620550',
  longitude: '-68.0054870',
  price: '',
  maintenanceFee: '',
  isNegotiable: false,
  bedrooms: '',
  bathrooms: '',
  parkingSpaces: '',
  squareMeters: '',
  lotSquareMeters: '',
  yearBuilt: '',
  apartmentFloor: '',
  hasWaterTank: false,
  hasPowerPlant: false,
  isFurnished: false,
  allowsPets: false,
  hasPool: false,
  hasGym: false,
  hasBalcony: false,
  hasAirConditioning: false,
  hasSecurity: false,
  hasElevator: false,
  videoUrl: '',
  virtualTourUrl: '',
}

export const CREATE_PROPERTY_STEP_FIELDS: ReadonlyArray<
  ReadonlyArray<keyof CreatePropertyFormValues>
> = [
  [
    'title',
    'propertyType',
    'listingType',
    'description',
    'price',
    'maintenanceFee',
    'isNegotiable',
  ],
  [
    'ownerName',
    'ownerPhone',
    'ownerEmail',
    'address',
    'neighborhood',
    'city',
    'state',
    'latitude',
    'longitude',
  ],
  [
    'bedrooms',
    'bathrooms',
    'parkingSpaces',
    'squareMeters',
    'lotSquareMeters',
    'yearBuilt',
    'apartmentFloor',
    'hasWaterTank',
    'hasPowerPlant',
    'isFurnished',
    'allowsPets',
    'hasPool',
    'hasGym',
    'hasBalcony',
    'hasAirConditioning',
    'hasSecurity',
    'hasElevator',
    'videoUrl',
    'virtualTourUrl',
  ],
  [],
  [],
]

const toNumber = (value: string): number => Number(value)

const toNullableNumber = (value: string): number | null =>
  value.trim() ? Number(value) : null

const toNullableText = (value: string): string | null =>
  value.trim() ? value.trim() : null

export function toPropertyRequestFields(
  values: CreatePropertyFormValues,
) {
  return {
    title: values.title.trim(),
    propertyType: values.propertyType as PropertyType,
    listingType: values.listingType as ListingType,
    description: toNullableText(values.description),
    ownerName: values.ownerName.trim(),
    ownerPhone: values.ownerPhone.trim(),
    ownerEmail: toNullableText(values.ownerEmail),
    address: values.address.trim(),
    neighborhood: toNullableText(values.neighborhood),
    city: values.city.trim(),
    state: values.state.trim(),
    latitude: toNumber(values.latitude),
    longitude: toNumber(values.longitude),
    price: toNumber(values.price),
    maintenanceFee: toNullableNumber(values.maintenanceFee),
    isNegotiable: values.isNegotiable,
    bedrooms: toNumber(values.bedrooms),
    bathrooms: toNumber(values.bathrooms),
    parkingSpaces: toNumber(values.parkingSpaces),
    squareMeters: toNumber(values.squareMeters),
    lotSquareMeters: toNullableNumber(values.lotSquareMeters),
    yearBuilt: toNullableNumber(values.yearBuilt),
    apartmentFloor: toNullableNumber(values.apartmentFloor),
    hasWaterTank: values.hasWaterTank,
    hasPowerPlant: values.hasPowerPlant,
    isFurnished: values.isFurnished,
    allowsPets: values.allowsPets,
    hasPool: values.hasPool,
    hasGym: values.hasGym,
    hasBalcony: values.hasBalcony,
    hasAirConditioning: values.hasAirConditioning,
    hasSecurity: values.hasSecurity,
    hasElevator: values.hasElevator,
    videoUrl: toNullableText(values.videoUrl),
    virtualTourUrl: toNullableText(values.virtualTourUrl),
  }
}

export function toCreatePropertyRequest(
  values: CreatePropertyFormValues,
  options: {
    photoBatchId: string
    coverUploadId?: string
  },
): CreatePropertyRequest {
  return {
    photoBatchId: options.photoBatchId,
    ...(options.coverUploadId
      ? { coverUploadId: options.coverUploadId }
      : {}),
    ...toPropertyRequestFields(values),
  }
}
