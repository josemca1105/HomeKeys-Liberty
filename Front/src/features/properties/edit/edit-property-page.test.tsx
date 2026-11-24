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

const reassignedAgent: AuthUser = {
  ...testUser,
  id: 7,
  firstName: 'María',
  lastName: 'Rodríguez',
  email: 'maria.rodriguez@example.com',
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

function mockAgentDirectory(users: AuthUser[]) {
  server.use(
    http.get(usersUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Usuarios obtenidos exitosamente.',
        data: {
          users,
          pagination: {
            page: 1,
            pageSize: 100,
            total: users.length,
            totalPages: 1,
          },
        },
      }),
    ),
  )
}

function mockProperty(property: Property) {
  server.use(
    http.get(`${propertiesUrl}/${property.id}`, () =>
      HttpResponse.json({
        success: true,
        message: 'Captación obtenida exitosamente.',
        data: { property },
      }),
    ),
  )
}

function mockPropertyUpdate(
  initial: Property,
  onUpdate?: (body: Record<string, unknown>) => void,
) {
  let current = initial

  server.use(
    http.patch(`${propertiesUrl}/${initial.id}`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      onUpdate?.(body)
      current = {
        ...current,
        ...(body as Partial<Property>),
      }

      return HttpResponse.json({
        success: true,
        message: 'Captación actualizada exitosamente.',
        data: { property: current },
      })
    }),
    http.get(`${propertiesUrl}/${initial.id}`, () =>
      HttpResponse.json({
        success: true,
        message: 'Captación obtenida exitosamente.',
        data: { property: current },
      }),
    ),
  )
}

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('edición de captaciones', () => {
  it('permite a un ADMIN editar y reasignar el agente', async () => {
    const actor = userEvent.setup()
    let updateBody: Record<string, unknown> | null = null

    mockSession(testUser)
    mockAgentDirectory([testUser, reassignedAgent])
    mockProperty(testProperty)
    mockPropertyUpdate(testProperty, (body) => {
      updateBody = body
    })

    renderApp(['/captaciones/1/editar'])

    expect(
      await screen.findByRole('heading', { name: 'Editar captación' }),
    ).toBeInTheDocument()

    const titleInput = screen.getByLabelText(/^Título\*$/)

    expect(titleInput).toHaveValue(testProperty.title)
    expect(screen.getByLabelText(/^Precio\*$/)).toHaveValue(150000)

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'María Rodríguez' }),
      ).toBeInTheDocument()
    })

    await actor.clear(titleInput)
    await actor.type(titleInput, 'Casa renovada')
    await actor.selectOptions(
      screen.getByLabelText(/Agente asignado/),
      '7',
    )
    await actor.click(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    )

    await waitFor(() => {
      expect(updateBody).not.toBeNull()
    })

    expect(updateBody).toMatchObject({
      agentId: 7,
      title: 'Casa renovada',
      price: 150000,
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 2,
      squareMeters: 120,
    })

    expect(
      await screen.findByRole('heading', { name: 'Casa renovada' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Cambios guardados correctamente.'),
    ).toBeInTheDocument()
  })

  it('permite a un PARTNER editar sin enviar agentId', async () => {
    const actor = userEvent.setup()
    let updateBody: Record<string, unknown> | null = null
    const partnerProperty: Property = {
      ...testProperty,
      agentId: testPartner.id,
    }

    mockSession(testPartner)
    mockProperty(partnerProperty)
    mockPropertyUpdate(partnerProperty, (body) => {
      updateBody = body
    })

    renderApp(['/captaciones/1/editar'])

    expect(
      await screen.findByRole('heading', { name: 'Editar captación' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Agente asignado/),
    ).not.toBeInTheDocument()

    const titleInput = screen.getByLabelText(/^Título\*$/)
    await actor.clear(titleInput)
    await actor.type(titleInput, 'Casa del partner')
    await actor.click(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    )

    await waitFor(() => {
      expect(updateBody).not.toBeNull()
    })

    expect(updateBody).not.toHaveProperty('agentId')
    expect(updateBody).toMatchObject({
      title: 'Casa del partner',
    })

    expect(
      await screen.findByRole('heading', { name: 'Casa del partner' }),
    ).toBeInTheDocument()
  })

  it('bloquea la edición de una captación cerrada para un PARTNER', async () => {
    mockSession(testPartner)
    mockProperty({
      ...testProperty,
      agentId: testPartner.id,
      status: 'CLOSED',
      closedAt: '2026-11-22T13:00:00.000Z',
    })

    renderApp(['/captaciones/1/editar'])

    expect(
      await screen.findByRole('heading', { name: 'Captación cerrada' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Guardar cambios' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Agente asignado/),
    ).not.toBeInTheDocument()
  })

  it('permite a un ADMIN editar una captación cerrada', async () => {
    mockSession(testUser)
    mockAgentDirectory([testUser])
    mockProperty({
      ...testProperty,
      status: 'CLOSED',
      closedAt: '2026-11-22T13:00:00.000Z',
    })

    renderApp(['/captaciones/1/editar'])

    expect(
      await screen.findByRole('heading', { name: 'Editar captación' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Esta captación está cerrada/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeInTheDocument()
  })
})
