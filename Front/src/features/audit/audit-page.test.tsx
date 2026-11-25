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
import type { AuditLog } from './audit.types'

const currentUserUrl = `${env.apiBaseUrl}/users/me`
const auditLogsUrl = `${env.apiBaseUrl}/audit-logs`

function createTestAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 1,
    scope: 'BUSINESS',
    actorId: 1,
    actorRole: 'ADMIN',
    actorEmail: 'ana.torres@example.com',
    action: 'PROPERTY_STATUS_CHANGED',
    entityType: 'PROPERTY',
    entityId: 1,
    changes: { status: { before: 'ACTIVE', after: 'PAUSED' } },
    ip: '186.84.12.9',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    requestId: 'req-abc-123',
    createdAt: '2026-11-24T20:15:00.000Z',
    ...overrides,
  }
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

function mockAuditLogs(logs: AuditLog[], handlerUrl = auditLogsUrl) {
  server.use(
    http.get(handlerUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Historial obtenido exitosamente.',
        data: {
          logs,
          pagination: {
            page: 1,
            pageSize: 20,
            total: logs.length,
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

describe('listado de auditoría', () => {
  it('muestra los eventos con etiquetas, actores y entidades enlazadas', async () => {
    mockAuthenticatedSession()
    mockAuditLogs([
      createTestAuditLog(),
      createTestAuditLog({
        id: 2,
        scope: 'SECURITY',
        action: 'LOGIN_FAILED',
        actorId: null,
        actorRole: null,
        actorEmail: null,
        entityType: 'USER',
        entityId: 4,
        changes: null,
      }),
    ])

    renderApp(['/auditoria'])

    expect(
      await screen.findByRole('heading', { name: 'Auditoría' }),
    ).toBeInTheDocument()

    const results = await screen.findByRole('region', {
      name: 'Eventos de auditoría',
    })

    expect(
      await within(results).findByRole('button', {
        name: 'Ver detalles del evento 1',
      }),
    ).toBeInTheDocument()
    expect(
      within(results).getByText('Estado de captación cambiado'),
    ).toBeInTheDocument()
    expect(
      within(results).getByText('Intento de acceso fallido'),
    ).toBeInTheDocument()
    expect(within(results).getByText('Negocio')).toBeInTheDocument()
    expect(within(results).getByText('Seguridad')).toBeInTheDocument()
    expect(
      within(results).getByText('ana.torres@example.com'),
    ).toBeInTheDocument()
    expect(within(results).getByText('Sistema')).toBeInTheDocument()

    const propertyLink = within(results).getByRole('link', {
      name: 'Captación #1',
    })
    expect(propertyLink).toHaveAttribute('href', '/captaciones/1')
    expect(
      within(results).getByRole('link', { name: 'Usuario #4' }),
    ).toHaveAttribute('href', '/usuarios/4')

    expect(screen.getByText('2 eventos encontrados')).toBeInTheDocument()
  })

  it('expande una fila y muestra los cambios y el contexto', async () => {
    const actor = userEvent.setup()

    mockAuthenticatedSession()
    mockAuditLogs([createTestAuditLog()])

    renderApp(['/auditoria'])

    await actor.click(
      await screen.findByRole('button', {
        name: 'Ver detalles del evento 1',
      }),
    )

    expect(
      screen.getByRole('button', {
        name: 'Ocultar detalles del evento 1',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Cambios')).toBeInTheDocument()
    expect(screen.getByText('status')).toBeInTheDocument()
    expect(
      screen.getByText('{"before":"ACTIVE","after":"PAUSED"}'),
    ).toBeInTheDocument()
    expect(screen.getByText('Contexto')).toBeInTheDocument()
    expect(screen.getByText('186.84.12.9')).toBeInTheDocument()
    expect(screen.getByText('req-abc-123')).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', {
        name: 'Ocultar detalles del evento 1',
      }),
    )

    expect(screen.queryByText('req-abc-123')).not.toBeInTheDocument()
  })

  it('aplica los filtros de alcance y acción', async () => {
    const actor = userEvent.setup()
    let latestListRequest: URL | null = null

    mockAuthenticatedSession()

    server.use(
      http.get(auditLogsUrl, ({ request }) => {
        latestListRequest = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Historial obtenido exitosamente.',
          data: {
            logs: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          },
        })
      }),
    )

    renderApp(['/auditoria'])

    await screen.findByRole('heading', { name: 'Auditoría' })
    await actor.selectOptions(screen.getByLabelText('Alcance'), 'SECURITY')

    await waitFor(() => {
      expect(latestListRequest?.searchParams.get('scope')).toBe('SECURITY')
    })

    await actor.selectOptions(
      screen.getByLabelText('Acción'),
      'LOGIN_FAILED',
    )

    await waitFor(() => {
      expect(latestListRequest?.searchParams.get('action')).toBe(
        'LOGIN_FAILED',
      )
    })
  })

  it('muestra la actividad propia a un PARTNER', async () => {
    const partner: AuthUser = {
      ...testUser,
      id: 4,
      firstName: 'Luis',
      lastName: 'Mendoza',
      email: 'luis.mendoza@example.com',
      role: 'PARTNER',
    }

    mockAuthenticatedSession(partner)
    mockAuditLogs([
      createTestAuditLog({
        id: 9,
        scope: 'SECURITY',
        action: 'LOGOUT',
        actorId: 4,
        actorRole: 'PARTNER',
        actorEmail: 'luis.mendoza@example.com',
        entityType: null,
        entityId: null,
        changes: null,
      }),
    ])

    renderApp(['/auditoria'])

    expect(
      await screen.findByRole('heading', { name: 'Auditoría' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tu actividad queda registrada aquí: accesos y cambios en tus captaciones.',
      ),
    ).toBeInTheDocument()

    const results = await screen.findByRole('region', {
      name: 'Eventos de auditoría',
    })

    expect(
      await within(results).findByRole('button', {
        name: 'Ver detalles del evento 9',
      }),
    ).toBeInTheDocument()
    expect(within(results).getByText('Cierre de sesión')).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay eventos', async () => {
    mockAuthenticatedSession()
    mockAuditLogs([])

    renderApp(['/auditoria'])

    expect(
      await screen.findByRole('heading', {
        name: 'Aún no hay eventos registrados',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('0 eventos encontrados'),
    ).toBeInTheDocument()
  })

  it('muestra el estado de error de carga', async () => {
    mockAuthenticatedSession()

    server.use(
      http.get(auditLogsUrl, () =>
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

    renderApp(['/auditoria'])

    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar los eventos',
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
