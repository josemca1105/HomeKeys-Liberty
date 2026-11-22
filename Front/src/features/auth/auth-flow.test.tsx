import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import {
  createExpiredTestToken,
  createTestToken,
  testUser,
} from '@/test/fixtures'
import type { AuthUser } from './auth.types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const loginUrl = `${env.apiBaseUrl}/auth/login`
const currentUserUrl = `${env.apiBaseUrl}/users/me`
const logoutUrl = `${env.apiBaseUrl}/auth/logout`

const invalidCredentialsResponse = {
  success: false,
  code: 'INVALID_CREDENTIALS',
  message: 'El correo o la contraseña son incorrectos.',
}

function mockLoginSuccess(token = createTestToken()) {
  server.use(
    http.post(loginUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Sesión iniciada exitosamente.',
        data: {
          token,
          user: testUser,
        },
      }),
    ),
  )

  return token
}

function mockRestoredSession(
  token = createTestToken(),
  user: AuthUser = testUser,
) {
  setAccessToken(token)

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

function mockLogout() {
  server.use(
    http.post(logoutUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Sesión cerrada exitosamente.',
      }),
    ),
  )
}

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('flujo de autenticación', () => {
  it('inicia sesión y muestra el dashboard', async () => {
    const user = userEvent.setup()
    const token = mockLoginSuccess()

    renderApp(['/login'])

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument()

    await user.type(
      screen.getByLabelText('Correo electrónico'),
      testUser.email,
    )
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveSegura123!')
    await user.click(screen.getByRole('button', { name: 'Entrar al panel' }))

    expect(
      await screen.findByRole('heading', { name: 'Hola, Ana.' }),
    ).toBeInTheDocument()
    expect(window.sessionStorage.getItem('homekeys.access-token')).toBe(token)
  })

  it('muestra el error de credenciales sin abandonar el login', async () => {
    const user = userEvent.setup()

    server.use(
      http.post(loginUrl, () =>
        HttpResponse.json(invalidCredentialsResponse, { status: 401 }),
      ),
    )

    renderApp(['/login'])

    await user.type(
      screen.getByLabelText('Correo electrónico'),
      testUser.email,
    )
    await user.type(screen.getByLabelText('Contraseña'), 'ClaveIncorrecta123!')
    await user.click(screen.getByRole('button', { name: 'Entrar al panel' }))

    expect(
      await screen.findByText(invalidCredentialsResponse.message),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument()

    await user.type(
      screen.getByLabelText('Correo electrónico'),
      'x',
    )

    expect(
      screen.queryByText(invalidCredentialsResponse.message),
    ).not.toBeInTheDocument()
  })

  it('redirige al login con aviso cuando se intenta abrir una ruta privada', async () => {
    renderApp(['/dashboard'])

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Debes iniciar sesión para acceder a esta sección.'),
    ).toBeInTheDocument()
  })

  it('restaura una sesión válida desde sessionStorage', async () => {
    mockRestoredSession()

    renderApp(['/dashboard'])

    expect(
      await screen.findByRole('heading', { name: 'Hola, Ana.' }),
    ).toBeInTheDocument()
    expect(screen.getByText(testUser.email)).toBeInTheDocument()
  })

  it('redirige al dashboard si una sesión válida abre el login', async () => {
    mockRestoredSession()

    renderApp(['/login'])

    expect(
      await screen.findByRole('heading', { name: 'Hola, Ana.' }),
    ).toBeInTheDocument()
  })

  it('bloquea el dashboard cuando el cambio de contraseña está pendiente', async () => {
    mockRestoredSession(createTestToken(), {
      ...testUser,
      mustChangePassword: true,
    })

    renderApp(['/dashboard'])

    expect(
      await screen.findByRole('heading', {
        name: 'Cambia tu contraseña para continuar',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Datos de acceso')).not.toBeInTheDocument()
  })

  it('impide abrir captaciones con un cambio de contraseña pendiente', async () => {
    mockRestoredSession(createTestToken(), {
      ...testUser,
      mustChangePassword: true,
    })

    renderApp(['/captaciones'])

    expect(
      await screen.findByRole('heading', {
        name: 'Cambia tu contraseña para continuar',
      }),
    ).toBeInTheDocument()
  })

  it('rechaza una sesión expirada antes de consultar la API', async () => {
    setAccessToken(createExpiredTestToken())

    renderApp(['/dashboard'])

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tu sesión ha expirado o ya no es válida. Inicia sesión nuevamente.',
      ),
    ).toBeInTheDocument()
    expect(window.sessionStorage.getItem('homekeys.access-token')).toBeNull()
  })

  it('cierra sesión y regresa al login con confirmación', async () => {
    const user = userEvent.setup()
    mockRestoredSession()
    mockLogout()

    renderApp(['/dashboard'])

    await user.click(
      await screen.findByRole('button', { name: 'Cerrar sesión' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Has cerrado sesión correctamente.'),
    ).toBeInTheDocument()
    expect(window.sessionStorage.getItem('homekeys.access-token')).toBeNull()
  })
})
