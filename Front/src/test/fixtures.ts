import type { AuthUser } from '@/features/auth/auth.types'

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

export function createTestToken(expiresInSeconds = 3_600): string {
  const payload = {
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
