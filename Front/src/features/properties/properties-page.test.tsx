import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import type { AuthUser } from '@/features/auth/auth.types'
import { createTestToken, testProperty, testUser } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const currentUserUrl = `${env.apiBaseUrl}/users/me`
const usersUrl = `${env.apiBaseUrl}/users`
const propertiesUrl = `${env.apiBaseUrl}/properties`

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

function mockAgentDirectory() {
  server.use(
    http.get(usersUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Usuarios obtenidos exitosamente.',
        data: {
          users: [testUser],
          pagination: {
            page: 1,
            pageSize: 100,
            total: 1,
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

describe('consulta de captaciones', () => {
  it('muestra el listado y aplica un filtro desde el panel', async () => {
    const actor = userEvent.setup()
    let latestListRequest: URL | null = null

    mockAuthenticatedSession()
    mockAgentDirectory()

    server.use(
      http.get(propertiesUrl, ({ request }) => {
        latestListRequest = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Captaciones obtenidas exitosamente.',
          data: {
            properties: [testProperty],
            pagination: {
              page: 1,
              pageSize: 12,
              total: 1,
              totalPages: 1,
            },
          },
        })
      }),
    )

    renderApp(['/captaciones'])

    expect(
      await screen.findByRole('heading', { name: 'Captaciones' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', {
        name: 'Casa familiar en El Viñedo',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('HK-0001')).toBeInTheDocument()
    expect(screen.getByText('$150.000')).toBeInTheDocument()

    await actor.selectOptions(screen.getByLabelText('Estado'), 'ACTIVE')
    await actor.click(screen.getByRole('button', { name: 'Aplicar' }))

    await waitFor(() => {
      expect(latestListRequest?.searchParams.get('status')).toBe('ACTIVE')
    })
  })

  it('muestra el detalle de una captación accesible', async () => {
    mockAuthenticatedSession()
    mockAgentDirectory()

    server.use(
      http.get(`${propertiesUrl}/1`, () =>
        HttpResponse.json({
          success: true,
          message: 'Captación obtenida exitosamente.',
          data: { property: testProperty },
        }),
      ),
    )

    renderApp(['/captaciones/1'])

    expect(
      await screen.findByRole('heading', {
        name: 'Casa familiar en El Viñedo',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Carlos Pérez')).toBeInTheDocument()
    expect(screen.getByText('Av. Principal, casa 12')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /Abrir ubicación en OpenStreetMap/,
      }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('openstreetmap.org'),
    )
  })

  it('mantiene el alcance del PARTNER sin consultar la lista de usuarios', async () => {
    const partner: AuthUser = {
      ...testUser,
      id: 4,
      firstName: 'Luis',
      lastName: 'Mendoza',
      email: 'luis.mendoza@example.com',
      role: 'PARTNER',
    }

    mockAuthenticatedSession(partner)

    server.use(
      http.get(propertiesUrl, () =>
        HttpResponse.json({
          success: true,
          message: 'Captaciones obtenidas exitosamente.',
          data: {
            properties: [{ ...testProperty, agentId: partner.id }],
            pagination: {
              page: 1,
              pageSize: 12,
              total: 1,
              totalPages: 1,
            },
          },
        }),
      ),
    )

    renderApp(['/captaciones'])

    expect(
      await screen.findByRole('heading', {
        name: 'Casa familiar en El Viñedo',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Agente')).not.toBeInTheDocument()
    expect(screen.getAllByText('Luis Mendoza').length).toBeGreaterThan(0)
  })

  it('muestra el estado de captación no encontrada', async () => {
    mockAuthenticatedSession()
    mockAgentDirectory()

    server.use(
      http.get(`${propertiesUrl}/999`, () =>
        HttpResponse.json(
          {
            success: false,
            code: 'PROPERTY_NOT_FOUND',
            message: 'La captación no fue encontrada.',
          },
          { status: 404 },
        ),
      ),
    )

    renderApp(['/captaciones/999'])

    expect(
      await screen.findByRole('heading', {
        name: 'Captación no encontrada',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'La captación no existe, fue eliminada o no tienes acceso a ella.',
      ),
    ).toBeInTheDocument()
  })
})
