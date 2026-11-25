import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import {
  createTestToken,
  testUser,
} from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import type { AuthUser } from './auth.types'

const currentUserUrl = `${env.apiBaseUrl}/users/me`
const forgotPasswordUrl = `${env.apiBaseUrl}/auth/forgot-password`
const resetPasswordUrl = `${env.apiBaseUrl}/auth/reset-password`
const changePasswordUrl = `${env.apiBaseUrl}/users/me/password`
const profileUrl = `${env.apiBaseUrl}/users/me`

const STRONG_PASSWORD = 'NuevaClave456!'

function mockRestoredSession(user: AuthUser = testUser) {
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

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('recuperación de contraseña', () => {
  it('enlaza la recuperación desde el login', async () => {
    const actor = userEvent.setup()

    renderApp(['/login'])

    await actor.click(
      await screen.findByRole('link', { name: 'Recupera tu acceso' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Recupera tu contraseña',
      }),
    ).toBeInTheDocument()
  })

  it('solicita el enlace y confirma de forma genérica', async () => {
    const actor = userEvent.setup()
    let forgotBody: Record<string, unknown> | null = null

    server.use(
      http.post(forgotPasswordUrl, async ({ request }) => {
        forgotBody = (await request.json()) as Record<string, unknown>

        return HttpResponse.json({
          success: true,
          message: 'Si el correo existe, recibirás un enlace.',
          data: {},
        })
      }),
    )

    renderApp(['/forgot-password'])

    expect(
      await screen.findByRole('heading', {
        name: 'Recupera tu contraseña',
      }),
    ).toBeInTheDocument()

    await actor.type(
      screen.getByLabelText('Correo electrónico'),
      'ana.torres@example.com',
    )
    await actor.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(
      await screen.findByRole('heading', { name: 'Enlace enviado' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('ana.torres@example.com'),
    ).toBeInTheDocument()
    expect(forgotBody).toEqual({
      email: 'ana.torres@example.com',
    })
  })

  it('marca los requisitos cumplidos mientras se escribe la contraseña', async () => {
    const actor = userEvent.setup()

    renderApp(['/reset-password#token=live-check-token-123456'])

    const newPasswordInput = await screen.findByLabelText(
      'Nueva contraseña',
    )

    expect(
      screen.getByText('Mínimo 12 caracteres').closest('li'),
    ).toHaveAttribute('data-met', 'false')

    await actor.type(newPasswordInput, STRONG_PASSWORD)

    await waitFor(() => {
      expect(
        screen.getByText('Mínimo 12 caracteres').closest('li'),
      ).toHaveAttribute('data-met', 'true')
    })
    expect(
      screen.getByText('Una letra mayúscula').closest('li'),
    ).toHaveAttribute('data-met', 'true')
    expect(
      screen.getByText('Una letra minúscula').closest('li'),
    ).toHaveAttribute('data-met', 'true')
    expect(
      screen.getByText('Un número').closest('li'),
    ).toHaveAttribute('data-met', 'true')
    expect(
      screen.getByText('Un carácter especial').closest('li'),
    ).toHaveAttribute('data-met', 'true')
    expect(
      screen.getByText('Máximo 72 caracteres').closest('li'),
    ).toHaveAttribute('data-met', 'true')
  })

  it('crea una contraseña nueva con un token válido', async () => {
    const actor = userEvent.setup()
    let resetBody: Record<string, unknown> | null = null

    server.use(
      http.post(resetPasswordUrl, async ({ request }) => {
        resetBody = (await request.json()) as Record<string, unknown>

        return HttpResponse.json({
          success: true,
          message: 'Contraseña actualizada exitosamente.',
          data: {},
        })
      }),
    )

    renderApp(['/reset-password#token=valid-reset-token-123456'])

    expect(
      await screen.findByRole('heading', {
        name: 'Crea tu nueva contraseña',
      }),
    ).toBeInTheDocument()

    await actor.type(
      screen.getByLabelText('Nueva contraseña'),
      STRONG_PASSWORD,
    )
    await actor.type(
      screen.getByLabelText('Confirmar contraseña'),
      STRONG_PASSWORD,
    )
    await actor.click(
      screen.getByRole('button', { name: 'Guardar contraseña' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Contraseña actualizada',
      }),
    ).toBeInTheDocument()
    expect(resetBody).toEqual({
      token: 'valid-reset-token-123456',
      newPassword: STRONG_PASSWORD,
    })
  })

  it('rechaza el enlace cuando no hay token', async () => {
    renderApp(['/reset-password'])

    expect(
      await screen.findByRole('heading', { name: 'Enlace inválido' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Nueva contraseña'),
    ).not.toBeInTheDocument()
  })

  it('valida que las contraseñas coincidan antes de enviar', async () => {
    const actor = userEvent.setup()
    let requestCount = 0

    server.use(
      http.post(resetPasswordUrl, () => {
        requestCount += 1

        return HttpResponse.json({
          success: true,
          message: 'Contraseña actualizada exitosamente.',
          data: {},
        })
      }),
    )

    renderApp(['/reset-password#token=valid-reset-token-123456'])

    await actor.type(
      screen.getByLabelText('Nueva contraseña'),
      STRONG_PASSWORD,
    )
    await actor.type(
      screen.getByLabelText('Confirmar contraseña'),
      'OtraClave789!',
    )
    await actor.click(
      screen.getByRole('button', { name: 'Guardar contraseña' }),
    )

    expect(
      await screen.findByText('Las contraseñas no coinciden.'),
    ).toBeInTheDocument()
    expect(requestCount).toBe(0)
  })
})

describe('cambio de contraseña', () => {
  it('cambia la contraseña obligatoria y cierra la sesión', async () => {
    const actor = userEvent.setup()
    let changeBody: Record<string, unknown> | null = null

    mockRestoredSession({ ...testUser, mustChangePassword: true })

    server.use(
      http.patch(changePasswordUrl, async ({ request }) => {
        changeBody = (await request.json()) as Record<string, unknown>

        return HttpResponse.json({
          success: true,
          message: 'Contraseña actualizada exitosamente.',
          data: {},
        })
      }),
    )

    renderApp(['/cambiar-contrasena'])

    expect(
      await screen.findByRole('heading', { name: 'Cambia tu contraseña' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Debes completar este paso para acceder al resto del panel.',
      ),
    ).toBeInTheDocument()

    await actor.type(
      screen.getByLabelText('Contraseña actual'),
      'Actual123!',
    )
    await actor.type(
      screen.getByLabelText('Nueva contraseña'),
      STRONG_PASSWORD,
    )
    await actor.type(
      screen.getByLabelText('Confirmar contraseña'),
      STRONG_PASSWORD,
    )
    await actor.click(
      screen.getByRole('button', { name: 'Guardar contraseña' }),
    )

    await waitFor(() => {
      expect(changeBody).toEqual({
        currentPassword: 'Actual123!',
        newPassword: STRONG_PASSWORD,
      })
    })

    expect(
      await screen.findByRole('heading', { name: 'Inicia sesión' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Tu contraseña se actualizó. Inicia sesión nuevamente.'),
    ).toBeInTheDocument()
    expect(window.sessionStorage.getItem('homekeys.access-token')).toBeNull()
  })
})

describe('perfil', () => {
  it('guarda los datos y actualiza la sesión en caliente', async () => {
    const actor = userEvent.setup()
    let profileBody: Record<string, unknown> | null = null

    mockRestoredSession()

    server.use(
      http.patch(profileUrl, async ({ request }) => {
        profileBody = (await request.json()) as Record<string, unknown>

        return HttpResponse.json({
          success: true,
          message: 'Perfil actualizado exitosamente.',
          data: {
            user: {
              ...testUser,
              ...(profileBody as Partial<AuthUser>),
            },
          },
        })
      }),
    )

    renderApp(['/perfil'])

    const firstNameInput = await screen.findByLabelText('Nombre')

    expect(firstNameInput).toHaveValue('Ana')
    expect(screen.getByLabelText('Apellido')).toHaveValue('Torres')
    expect(screen.getByLabelText('Teléfono')).toHaveValue(
      testUser.phone,
    )
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      testUser.email,
    )
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()

    await actor.clear(firstNameInput)
    await actor.type(firstNameInput, 'Ana María')
    await actor.clear(screen.getByLabelText('Teléfono'))
    await actor.type(screen.getByLabelText('Teléfono'), '0414-5556677')
    await actor.click(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    )

    await waitFor(() => {
      expect(profileBody).toEqual({
        firstName: 'Ana María',
        lastName: 'Torres',
        phone: '0414-5556677',
        photoUrl: null,
      })
    })

    expect(
      await screen.findByText('Perfil actualizado correctamente.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Mi perfil' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Ana María/).length).toBeGreaterThan(0)
  })
})
