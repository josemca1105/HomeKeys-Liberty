import type { AuthUser } from '@/features/auth/auth.types'
import type {
  Property,
  PropertyPhoto,
} from '@/features/properties/property.types'

export const testUser: AuthUser = {
  id: 1,
  firstName: 'Ana',
  lastName: 'Torres',
  email: 'ana.torres@example.com',
  phone: '+58 412-1234567',
  photoUrl: null,
  role: 'ADMIN',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-11-22T12:00:00.000Z',
  updatedAt: '2026-11-22T12:00:00.000Z',
}

export const testProperty: Property = {
  id: 1,
  agentId: 1,
  code: 'HK-0001',
  title: 'Casa familiar en El Viñedo',
  propertyType: 'HOUSE',
  listingType: 'SALE',
  status: 'ACTIVE',
  description: 'Casa de dos niveles con patio y estacionamiento.',
  ownerName: 'Carlos Pérez',
  ownerPhone: '0414-1234567',
  ownerEmail: 'carlos.perez@example.com',
  address: 'Av. Principal, casa 12',
  neighborhood: 'El Viñedo',
  city: 'Valencia',
  state: 'Carabobo',
  latitude: 10.1234567,
  longitude: -68.1234567,
  price: '150000.00',
  currency: 'USD',
  maintenanceFee: '80.00',
  isNegotiable: true,
  bedrooms: 3,
  bathrooms: 2,
  parkingSpaces: 2,
  squareMeters: '120.00',
  lotSquareMeters: '200.00',
  yearBuilt: 2010,
  apartmentFloor: null,
  hasWaterTank: true,
  hasPowerPlant: false,
  isFurnished: false,
  allowsPets: true,
  hasPool: false,
  hasGym: false,
  hasBalcony: true,
  hasAirConditioning: true,
  hasSecurity: true,
  hasElevator: false,
  videoUrl: null,
  virtualTourUrl: null,
  closedAt: null,
  createdAt: '2026-11-22T12:00:00.000Z',
  updatedAt: '2026-11-22T13:00:00.000Z',
  photos: [],
}

export function createTestPhotos(count = 5): PropertyPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    url: `/api/v1/properties/1/photos/${index + 1}/content`,
    mimeType: 'image/webp',
    sizeBytes: 1_024,
    width: 1_200,
    height: 900,
    altText: `Foto ${index + 1}`,
    sortOrder: index,
    isCover: index === 0,
    createdAt: '2026-11-22T12:00:00.000Z',
    updatedAt: '2026-11-22T12:00:00.000Z',
  }))
}

export function createTestToken(expiresInSeconds = 3_600): string {  const payload = {
    sub: '1',
    role: 'ADMIN',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }

  return [
    window.btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    window.btoa(JSON.stringify(payload)),
    'test-signature',
  ].join('.')
}

export function createExpiredTestToken(): string {
  return createTestToken(-60)
}
