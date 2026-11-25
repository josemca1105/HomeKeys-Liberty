import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import { testUser } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import {
  createUser,
  deleteUser,
  fetchUsers,
  resendUserInvitation,
  updateUser,
} from './user.api'
import { DEFAULT_USER_FILTERS } from './user-filters'

const usersUrl = `${env.apiBaseUrl}/users`

describe('fetchUsers', () => {
  it('envía la paginación, los filtros y el orden', async () => {
    let captured: URL | null = null

    server.use(
      http.get(usersUrl, ({ request }) => {
        captured = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Usuarios obtenidos exitosamente.',
          data: {
            users: [],
            pagination: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
          },
        })
      }),
    )

    const data = await fetchUsers(
      {
        ...DEFAULT_USER_FILTERS,
        page: 2,
        search: 'ana',
        role: 'ADMIN',
        isActive: false,
        sortBy: 'firstName',
        sortOrder: 'asc',
      },
      new AbortController().signal,
    )

    // The handler runs inside an MSW closure, so read the captured URL through
    // a closure as well; TypeScript control flow cannot narrow it otherwise.
    const readParam = (key: string) => captured?.searchParams.get(key)

    expect(data.users).toEqual([])
    expect(readParam('page')).toBe('2')
    expect(readParam('pageSize')).toBe('20')
    expect(readParam('search')).toBe('ana')
    expect(readParam('role')).toBe('ADMIN')
    expect(readParam('isActive')).toBe('false')
    expect(readParam('sortBy')).toBe('firstName')
    expect(readParam('sortOrder')).toBe('asc')
  })

  it('omite los filtros vacíos', async () => {
    let captured: URL | null = null

    server.use(
      http.get(usersUrl, ({ request }) => {
        captured = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Usuarios obtenidos exitosamente.',
          data: {
            users: [testUser],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
        })
      }),
    )

    await fetchUsers(DEFAULT_USER_FILTERS, new AbortController().signal)

    const readParam = (key: string) => captured?.searchParams.get(key)

    expect(readParam('search')).toBeNull()
    expect(readParam('role')).toBeNull()
    expect(readParam('isActive')).toBeNull()
  })
})

describe('createUser', () => {
  it('registra el usuario sin contraseña y devuelve la invitación', async () => {
    let captured: Record<string, unknown> | undefined

    server.use(
      http.post(`${usersUrl}/add`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>

        return HttpResponse.json(
          {
            success: true,
            message: 'Usuario registrado exitosamente.',
            data: { user: testUser, invitationSent: true },
          },
          { status: 201 },
        )
      }),
    )

    const result = await createUser({
      firstName: 'Luis',
      lastName: 'Mendoza',
      email: 'luis.mendoza@example.com',
      phone: '0414-1234567',
      role: 'PARTNER',
    })

    expect(result.user.id).toBe(testUser.id)
    expect(result.invitationSent).toBe(true)
    expect(captured).toMatchObject({
      firstName: 'Luis',
      lastName: 'Mendoza',
      email: 'luis.mendoza@example.com',
      phone: '0414-1234567',
      role: 'PARTNER',
    })
    expect(captured).not.toHaveProperty('password')
    expect(captured).not.toHaveProperty('isActive')
  })
})

describe('updateUser', () => {
  it('actualiza con un cuerpo parcial', async () => {
    let captured: Record<string, unknown> | undefined

    server.use(
      http.patch(`${usersUrl}/2`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>

        return HttpResponse.json({
          success: true,
          message: 'Usuario actualizado exitosamente.',
          data: { user: testUser },
        })
      }),
    )

    const updated = await updateUser(2, { role: 'ADMIN' })

    expect(updated.id).toBe(testUser.id)
    expect(captured).toEqual({ role: 'ADMIN' })
    expect(captured).not.toHaveProperty('password')
  })
})

describe('resendUserInvitation', () => {
  it('reenvía la invitación y reporta el correo en cola', async () => {
    let capturedPath = ''

    server.use(
      http.post(`${usersUrl}/2/resend-invitation`, ({ request }) => {
        capturedPath = new URL(request.url).pathname

        return HttpResponse.json({
          success: true,
          message: 'Invitación reenviada.',
          data: { emailSent: true },
        })
      }),
    )

    await expect(resendUserInvitation(2)).resolves.toBe(true)
    expect(capturedPath).toBe('/api/v1/users/2/resend-invitation')
  })
})

describe('deleteUser', () => {
  it('elimina y devuelve el identificador', async () => {
    let capturedPath = ''

    server.use(
      http.delete(`${usersUrl}/5`, ({ request }) => {
        capturedPath = new URL(request.url).pathname

        return HttpResponse.json({
          success: true,
          message: 'Usuario eliminado exitosamente.',
          data: { deletedId: 5 },
        })
      }),
    )

    await expect(deleteUser(5)).resolves.toBe(5)
    expect(capturedPath).toBe('/api/v1/users/5')
  })
})
