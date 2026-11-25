import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import type { AuthUser } from '@/features/auth/auth.types'
import { createTestToken, testUser } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import type { User } from './user.types'

const currentUserUrl = `${env.apiBaseUrl}/users/me`
const usersUrl = `${env.apiBaseUrl}/users`

const partnerUser: User = {
  id: 4,
  firstName: 'Luis',
  lastName: 'Mendoza',
  email: 'luis.mendoza@example.com',
  phone: '0414-1234567',
  photoUrl: null,
  role: 'PARTNER',
  isActive: true,
  mustChangePassword: true,
  createdAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
}

function mockAuthenticatedSession(user: AuthUser = testUser) {
  setAccessToken(createTestToken())

  server.use(
    http.get(currentUserUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Usuario obtenido exitosamente.',
        data: { user },
      }),
    ),
  )
}

function mockUsersList(users: User[]) {
  server.use(
    http.get(usersUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Usuarios obtenidos exitosamente.',
        data: {
          users,
          pagination: {
            page: 1,
            pageSize: 20,
            total: users.length,
            totalPages: 1,
          },
        },
      }),
    ),
  )
}

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('listado de usuarios', () => {
  it('muestra el equipo con roles, estados e invitaciones', async () => {
    mockAuthenticatedSession()
    mockUsersList([testUser, partnerUser])

    renderApp(['/usuarios'])

    expect(
      await screen.findByRole('heading', { name: 'Usuarios' }),
    ).toBeInTheDocument()

    const results = await screen.findByRole('region', {
      name: 'Resultados de usuarios',
    })

    // The region renders before the data; wait for the first row before the
    // synchronous assertions.
    expect(
      await within(results).findByRole('link', { name: 'Ana Torres' }),
    ).toBeInTheDocument()
    expect(
      within(results).getByRole('link', { name: 'Luis Mendoza' }),
    ).toBeInTheDocument()
    expect(
      within(results).getByText('ana.torres@example.com'),
    ).toBeInTheDocument()
    expect(within(results).getByText('Administrador')).toBeInTheDocument()
    expect(within(results).getByText('Partner')).toBeInTheDocument()
    expect(within(results).getAllByText('Activa')).toHaveLength(2)
    expect(
      within(results).getByText('Invitación pendiente'),
    ).toBeInTheDocument()
    expect(screen.getByText('2 usuarios encontrados')).toBeInTheDocument()
  })

  it('aplica el filtro por rol desde el listado', async () => {
    const actor = userEvent.setup()
    let latestListRequest: URL | null = null

    mockAuthenticatedSession()

    server.use(
      http.get(usersUrl, ({ request }) => {
        latestListRequest = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Usuarios obtenidos exitosamente.',
          data: {
            users: [partnerUser],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
        })
      }),
    )

    renderApp(['/usuarios'])

    await screen.findByRole('heading', { name: 'Usuarios' })
    await actor.selectOptions(screen.getByLabelText('Rol'), 'PARTNER')

    await waitFor(() => {
      expect(latestListRequest?.searchParams.get('role')).toBe('PARTNER')
    })
  })

  it('aplica el filtro por estado desde el listado', async () => {
    const actor = userEvent.setup()
    let latestListRequest: URL | null = null

    mockAuthenticatedSession()

    server.use(
      http.get(usersUrl, ({ request }) => {
        latestListRequest = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Usuarios obtenidos exitosamente.',
          data: {
            users: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          },
        })
      }),
    )

    renderApp(['/usuarios'])

    await screen.findByRole('heading', { name: 'Usuarios' })
    await actor.selectOptions(screen.getByLabelText('Estado'), 'false')

    await waitFor(() => {
      expect(latestListRequest?.searchParams.get('isActive')).toBe('false')
    })
  })

  it('redirige a un PARTNER que intenta abrir la sección', async () => {
    const partner: AuthUser = {
      ...testUser,
      id: 4,
      firstName: 'Luis',
      lastName: 'Mendoza',
      email: 'luis.mendoza@example.com',
      role: 'PARTNER',
    }

    mockAuthenticatedSession(partner)

    renderApp(['/usuarios'])

    expect(
      await screen.findByRole('heading', { name: /Hola, Luis\./ }),
    ).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay invitados', async () => {
    mockAuthenticatedSession()
    mockUsersList([])

    renderApp(['/usuarios'])

    expect(
      await screen.findByRole('heading', {
        name: 'Aún no hay usuarios invitados',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('0 usuarios encontrados'),
    ).toBeInTheDocument()
  })

  it('muestra el estado de error de carga', async () => {
    mockAuthenticatedSession()

    server.use(
      http.get(usersUrl, () =>
        HttpResponse.json(
          {
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'El servicio no está disponible.',
          },
          { status: 500 },
        ),
      ),
    )

    renderApp(['/usuarios'])

    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar los usuarios',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('El servicio no está disponible.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument()
  })
})
