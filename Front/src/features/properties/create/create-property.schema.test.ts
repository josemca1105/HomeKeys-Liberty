import { describe, expect, it } from 'vitest'
import {
  CREATE_PROPERTY_DEFAULT_VALUES,
  createPropertySchema,
  toCreatePropertyRequest,
  type CreatePropertyFormValues,
} from './create-property.schema'

const validValues: CreatePropertyFormValues = {
  ...CREATE_PROPERTY_DEFAULT_VALUES,
  title: 'Casa familiar en El Viñedo',
  description: '  Casa de dos niveles.  ',
  price: '150000',
  maintenanceFee: '80',
  bedrooms: '3',
  bathrooms: '2',
  parkingSpaces: '2',
  squareMeters: '120',
  lotSquareMeters: '200',
  yearBuilt: '2010',
  ownerName: 'Carlos Pérez',
  ownerPhone: '0414-1234567',
  ownerEmail: 'carlos@example.com',
  address: 'Av. Principal, casa 12',
  neighborhood: 'El Viñedo',
  city: 'Valencia',
  state: 'Carabobo',
  videoUrl: 'https://example.com/video',
  virtualTourUrl: 'https://example.com/tour',
}

const minimalValues: CreatePropertyFormValues = {
  ...CREATE_PROPERTY_DEFAULT_VALUES,
  title: 'Casa',
  price: '1',
  bedrooms: '0',
  bathrooms: '0',
  parkingSpaces: '0',
  squareMeters: '0.01',
  ownerName: 'Ana',
  ownerPhone: '123456',
  address: 'Calle 1',
  city: 'Valencia',
  state: 'Carabobo',
}

function parseWith(
  field: keyof CreatePropertyFormValues,
  value: string,
) {
  return createPropertySchema.safeParse({
    ...validValues,
    [field]: value,
  })
}

describe('createPropertySchema', () => {
  it('acepta los valores mínimos obligatorios', () => {
    const result = createPropertySchema.safeParse(minimalValues)

    expect(result.success).toBe(true)
  })

  it.each([
    ['title', 'Ingresa el título.'],
    ['ownerName', 'Ingresa el nombre del propietario.'],
    ['ownerPhone', 'Ingresa un teléfono válido.'],
    ['address', 'Ingresa la dirección.'],
    ['city', 'Ingresa la ciudad.'],
    ['state', 'Ingresa el estado.'],
  ])('rechaza el campo obligatorio %s vacío', (field, message) => {
    const result = parseWith(
      field as keyof CreatePropertyFormValues,
      '   ',
    )

    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: [field], message }),
        ]),
      )
    }
  })

  it('rechaza precios y superficies fuera de rango', () => {
    expect(parseWith('price', '-1').success).toBe(false)
    expect(parseWith('price', 'abc').success).toBe(false)
    expect(parseWith('squareMeters', '0').success).toBe(false)
    expect(parseWith('bedrooms', '2.5').success).toBe(false)
    expect(parseWith('yearBuilt', '1799').success).toBe(false)
  })

  it('rechaza coordenadas fuera de rango', () => {
    expect(parseWith('latitude', '91').success).toBe(false)
    expect(parseWith('longitude', '-181').success).toBe(false)
    expect(parseWith('latitude', '10.16').success).toBe(true)
    expect(parseWith('longitude', '-68.01').success).toBe(true)
  })

  it('rechaza teléfono, correo y URL inválidos', () => {
    expect(parseWith('ownerPhone', 'abc123').success).toBe(false)
    expect(parseWith('ownerEmail', 'no-es-correo').success).toBe(false)
    expect(parseWith('videoUrl', 'ftp://example.com/video').success).toBe(
      false,
    )
  })

  it('acepta los campos opcionales vacíos', () => {
    const result = createPropertySchema.safeParse({
      ...minimalValues,
      ownerEmail: '',
      neighborhood: '',
      maintenanceFee: '',
      lotSquareMeters: '',
      yearBuilt: '',
      apartmentFloor: '',
      description: '',
      videoUrl: '',
      virtualTourUrl: '',
    })

    expect(result.success).toBe(true)
  })
})

describe('toCreatePropertyRequest', () => {
  it('convierte los valores y no envía agentId', () => {
    const payload = toCreatePropertyRequest(validValues, {
      photoBatchId: 'batch-1',
      coverUploadId: 'upload-2',
    })

    expect(payload).toMatchObject({
      photoBatchId: 'batch-1',
      coverUploadId: 'upload-2',
      title: 'Casa familiar en El Viñedo',
      description: 'Casa de dos niveles.',
      price: 150000,
      maintenanceFee: 80,
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 2,
      squareMeters: 120,
      lotSquareMeters: 200,
      yearBuilt: 2010,
      ownerEmail: 'carlos@example.com',
      videoUrl: 'https://example.com/video',
    })
    expect(payload).not.toHaveProperty('agentId')
  })

  it('convierte los opcionales vacíos en null', () => {
    const payload = toCreatePropertyRequest(
      {
        ...validValues,
        description: '   ',
        ownerEmail: '',
        neighborhood: '',
        maintenanceFee: '',
        lotSquareMeters: '',
        yearBuilt: '',
        apartmentFloor: '',
        videoUrl: '',
        virtualTourUrl: '',
      },
      {
        photoBatchId: 'batch-1',
      },
    )

    expect(payload).toMatchObject({
      description: null,
      ownerEmail: null,
      neighborhood: null,
      maintenanceFee: null,
      lotSquareMeters: null,
      yearBuilt: null,
      apartmentFloor: null,
      videoUrl: null,
      virtualTourUrl: null,
    })
  })
})
