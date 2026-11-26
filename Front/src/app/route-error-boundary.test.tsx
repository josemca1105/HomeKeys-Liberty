import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import { createTestToken, testUser } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { RouteErrorBoundary } from './route-error-boundary'

function Bomb(): never {
  throw new Error('Exploto el render de prueba')
}

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('RouteErrorBoundary', () => {
  it('renderiza los hijos cuando nada falla', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <p>Contenido del panel</p>
        </RouteErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.getByText('Contenido del panel')).toBeInTheDocument()
  })

  it('muestra el respaldo cuando un hijo falla al renderizar', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'Algo salió mal' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByText('Exploto el render de prueba')).toBeInTheDocument()
  })
})

vi.mock('@/features/dashboard/dashboard-page', () => ({
  DashboardPage: (): never => {
    throw new Error('Error del dashboard de prueba')
  },
}))

describe('integración con las rutas de la aplicación', () => {
  it('sustituye la pantalla en blanco cuando una ruta perezosa falla', async () => {
    setAccessToken(createTestToken())

    server.use(
      http.get(`${env.apiBaseUrl}/users/me`, () =>
        HttpResponse.json({
          success: true,
          message: 'Usuario obtenido exitosamente.',
          data: { user: testUser },
        }),
      ),
    )

    renderApp(['/dashboard'])

    expect(
      await screen.findByRole('heading', { name: 'Algo salió mal' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Error del dashboard de prueba'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Volver al inicio' }),
    ).toBeInTheDocument()
  })
})
