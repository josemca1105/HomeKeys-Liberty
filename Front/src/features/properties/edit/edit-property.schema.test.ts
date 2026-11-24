import { describe, expect, it } from 'vitest'
import { testProperty } from '@/test/fixtures'
import {
  editPropertySchema,
  toEditPropertyFormValues,
  toUpdatePropertyRequest,
} from './edit-property.schema'

describe('toEditPropertyFormValues', () => {
  it('convierte la captación al formulario editable', () => {
    const values = toEditPropertyFormValues(testProperty)

    expect(values).toMatchObject({
      agentId: '1',
      title: 'Casa familiar en El Viñedo',
      propertyType: 'HOUSE',
      listingType: 'SALE',
      price: '150000.00',
      maintenanceFee: '80.00',
      bedrooms: '3',
      bathrooms: '2',
      parkingSpaces: '2',
      squareMeters: '120.00',
      lotSquareMeters: '200.00',
      yearBuilt: '2010',
      latitude: '10.1234567',
      longitude: '-68.1234567',
      ownerEmail: 'carlos.perez@example.com',
      videoUrl: '',
      virtualTourUrl: '',
    })
  })

  it('convierte los opcionales nulos en cadenas vacías', () => {
    const values = toEditPropertyFormValues({
      ...testProperty,
      description: null,
      ownerEmail: null,
      neighborhood: null,
      maintenanceFee: null,
      lotSquareMeters: null,
      yearBuilt: null,
      apartmentFloor: null,
    })

    expect(values).toMatchObject({
      description: '',
      ownerEmail: '',
      neighborhood: '',
      maintenanceFee: '',
      lotSquareMeters: '',
      yearBuilt: '',
      apartmentFloor: '',
    })
  })
})

describe('editPropertySchema', () => {
  it('acepta el formulario prellenado', () => {
    const result = editPropertySchema.safeParse(
      toEditPropertyFormValues(testProperty),
    )

    expect(result.success).toBe(true)
  })

  it('hereda las validaciones de la creación', () => {
    const result = editPropertySchema.safeParse({
      ...toEditPropertyFormValues(testProperty),
      title: '   ',
      ownerPhone: 'abc',
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['title'] }),
          expect.objectContaining({ path: ['ownerPhone'] }),
        ]),
      )
    }
  })

  it('rechaza un agente inválido', () => {
    const result = editPropertySchema.safeParse({
      ...toEditPropertyFormValues(testProperty),
      agentId: '',
    })

    expect(result.success).toBe(false)
  })
})

describe('toUpdatePropertyRequest', () => {
  it('incluye agentId para un ADMIN', () => {
    const values = {
      ...toEditPropertyFormValues(testProperty),
      agentId: '7',
      title: '  Casa actualizada  ',
      description: '   ',
      maintenanceFee: '',
    }
    const payload = toUpdatePropertyRequest(values, { isAdmin: true })

    expect(payload).toMatchObject({
      agentId: 7,
      title: 'Casa actualizada',
      description: null,
      maintenanceFee: null,
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 2,
      squareMeters: 120,
      latitude: 10.1234567,
      longitude: -68.1234567,
    })
  })

  it('omite agentId para un PARTNER', () => {
    const payload = toUpdatePropertyRequest(
      toEditPropertyFormValues(testProperty),
      { isAdmin: false },
    )

    expect(payload).not.toHaveProperty('agentId')
    expect(payload).toMatchObject({
      title: 'Casa familiar en El Viñedo',
      price: 150000,
      yearBuilt: 2010,
    })
  })
})
