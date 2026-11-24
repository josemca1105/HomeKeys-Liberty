import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import type { AuthUser } from '@/features/auth/auth.types'
import type { Property } from '@/features/properties/property.types'
import {
  createTestToken,
  testProperty,
  testUser,
} from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

vi.mock('@/features/properties/map/property-map-canvas', () => ({
  PropertyMapCanvas: ({ ariaLabel }: { ariaLabel: string }) => (
    <div role="region" aria-label={ariaLabel} />
  ),
}))

const meUrl = `${env.apiBaseUrl}/users/me`
const usersUrl = `${env.apiBaseUrl}/users`
const propertiesUrl = `${env.apiBaseUrl}/properties`

const testPartner: AuthUser = {
  ...testUser,
  id: 4,
  firstName: 'Luis',
  lastName: 'Mendoza',
  email: 'luis.mendoza@example.com',
  role: 'PARTNER',
}

function mockSession(user: AuthUser) {
  setAccessToken(createTestToken())

  server.use(
    http.get(meUrl, () =>
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

function mockPropertyLifecycle(initial: Property) {
  let current = initial
  let updateBody: Record<string, unknown> | null = null

  server.use(
    http.get(`${propertiesUrl}/${initial.id}`, () =>
      HttpResponse.json({
        success: true,
        message: 'Captación obtenida exitosamente.',
        data: { property: current },
      }),
    ),
    http.patch(`${propertiesUrl}/${initial.id}`, async ({ request }) => {
      updateBody = (await request.json()) as Record<string, unknown>
      current = {
        ...current,
        ...(updateBody as Partial<Property>),
      }

      return HttpResponse.json({
        success: true,
        message: 'Captación actualizada exitosamente.',
        data: { property: current },
      })
    }),
  )

  return {
    getUpdateBody: () => updateBody,
  }
}

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('acciones del detalle de captación', () => {
  it('permite a un ADMIN pausar una captación activa', async () => {
    const actor = userEvent.setup()
    const lifecycle = mockPropertyLifecycle(testProperty)

    mockSession(testUser)
    mockAgentDirectory()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderApp(['/captaciones/1'])

    expect(
      await screen.findByRole('heading', { name: testProperty.title }),
    ).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', { name: 'Pausar captación' }),
    )

    await waitFor(() => {
      expect(lifecycle.getUpdateBody()).toEqual({ status: 'PAUSED' })
    })

    expect(await screen.findByText('Pausada')).toBeInTheDocument()
    expect(
      await screen.findByText('Estado actualizado a Pausada.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reactivar captación' }),
    ).toBeInTheDocument()
  })

  it('permite a un ADMIN reabrir una captación cerrada', async () => {
    const actor = userEvent.setup()
    const closedProperty: Property = {
      ...testProperty,
      status: 'CLOSED',
      closedAt: '2026-11-22T13:00:00.000Z',
    }
    const lifecycle = mockPropertyLifecycle(closedProperty)

    mockSession(testUser)
    mockAgentDirectory()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderApp(['/captaciones/1'])

    expect(
      await screen.findByRole('heading', { name: testProperty.title }),
    ).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', { name: 'Reabrir captación' }),
    )

    await waitFor(() => {
      expect(lifecycle.getUpdateBody()).toEqual({ status: 'ACTIVE' })
    })

    expect(await screen.findByText('Activa')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Editar captación' }),
    ).toBeInTheDocument()
  })

  it('permite a un ADMIN eliminar la captación y volver al listado', async () => {
    const actor = userEvent.setup()
    let deleteCalled = false

    mockSession(testUser)
    mockAgentDirectory()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    server.use(
      http.get(`${propertiesUrl}/1`, () =>
        HttpResponse.json({
          success: true,
          message: 'Captación obtenida exitosamente.',
          data: { property: testProperty },
        }),
      ),
      http.delete(`${propertiesUrl}/1`, () => {
        deleteCalled = true

        return HttpResponse.json({
          success: true,
          message: 'Captación eliminada exitosamente.',
          data: { deletedId: 1 },
        })
      }),
      http.get(propertiesUrl, () =>
        HttpResponse.json({
          success: true,
          message: 'Captaciones obtenidas exitosamente.',
          data: {
            properties: [],
            pagination: {
              page: 1,
              pageSize: 12,
              total: 0,
              totalPages: 0,
            },
          },
        }),
      ),
    )

    renderApp(['/captaciones/1'])

    expect(
      await screen.findByRole('heading', { name: testProperty.title }),
    ).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', { name: 'Eliminar captación' }),
    )

    await waitFor(() => {
      expect(deleteCalled).toBe(true)
    })

    expect(
      await screen.findByRole('heading', { name: 'Captaciones' }),
    ).toBeInTheDocument()
  })

  it('oculta edición, estado y eliminación a un PARTNER con captación cerrada', async () => {
    mockSession(testPartner)
    mockPropertyLifecycle({
      ...testProperty,
      agentId: testPartner.id,
      status: 'CLOSED',
      closedAt: '2026-11-22T13:00:00.000Z',
    })

    renderApp(['/captaciones/1'])

    expect(
      await screen.findByRole('heading', { name: testProperty.title }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Editar captación' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /Pausar|Reactivar|Cerrar captación|Reabrir|Eliminar/,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Esta captación está cerrada/),
    ).toBeInTheDocument()
  })

  it('muestra edición y estados a un PARTNER con captación activa, sin eliminación', async () => {
    mockSession(testPartner)
    mockPropertyLifecycle({
      ...testProperty,
      agentId: testPartner.id,
    })

    renderApp(['/captaciones/1'])

    expect(
      await screen.findByRole('heading', { name: testProperty.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Editar captación' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pausar captación' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cerrar captación' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Eliminar captación' }),
    ).not.toBeInTheDocument()
  })
})
