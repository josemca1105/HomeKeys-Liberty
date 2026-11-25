import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import type { User } from './user.types'
import { createTestToken, testUser } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const currentUserUrl = `${env.apiBaseUrl}/users/me`
const usersUrl = `${env.apiBaseUrl}/users`
const detailUrl = `${usersUrl}/4`

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

const activatedPartner: User = {
  ...partnerUser,
  mustChangePassword: false,
}

function mockAuthenticatedSession(user: User = testUser) {
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

function mockUserDetail(user: User) {
  server.use(
    http.get(detailUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Usuario obtenido exitosamente.',
        data: { user },
      }),
    ),
  )
}

function mockUsersList() {
  server.use(
    http.get(usersUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Usuarios obtenidos exitosamente.',
        data: {
          users: [partnerUser],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      }),
    ),
  )
}

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('detalle de usuario', () => {
  it('carga el usuario y guarda los cambios', async () => {
    const actor = userEvent.setup()
    let captured: Record<string, unknown> | undefined

    mockAuthenticatedSession()
    mockUserDetail(partnerUser)

    server.use(
      http.patch(detailUrl, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>

        return HttpResponse.json({
          success: true,
          message: 'Usuario actualizado exitosamente.',
          data: { user: { ...partnerUser, firstName: 'José' } },
        })
      }),
    )

    renderApp(['/usuarios/4'])

    expect(
      await screen.findByRole('heading', { name: 'Luis Mendoza' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Invitación pendiente')).toBeInTheDocument()

    const firstNameInput = screen.getByLabelText('Nombre')
    await actor.clear(firstNameInput)
    await actor.type(firstNameInput, 'José')
    await actor.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await screen.findByText('Usuario actualizado correctamente.'),
    ).toBeInTheDocument()
    expect(captured).toMatchObject({
      firstName: 'José',
      lastName: 'Mendoza',
      email: 'luis.mendoza@example.com',
      phone: '0414-1234567',
      role: 'PARTNER',
    })
    expect(captured).not.toHaveProperty('password')
    expect(captured).not.toHaveProperty('isActive')
  })

  it('reenvía la invitación mientras está pendiente', async () => {
    const actor = userEvent.setup()
    let resendRequested = false

    mockAuthenticatedSession()
    mockUserDetail(partnerUser)

    server.use(
      http.post(`${detailUrl}/resend-invitation`, () => {
        resendRequested = true

        return HttpResponse.json({
          success: true,
          message: 'Invitación reenviada.',
          data: { emailSent: true },
        })
      }),
    )

    renderApp(['/usuarios/4'])

    await actor.click(
      await screen.findByRole('button', { name: 'Reenviar invitación' }),
    )

    expect(
      await screen.findByText(/Invitación reenviada\./),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(resendRequested).toBe(true)
    })
  })

  it('ofrece restablecimiento en lugar de invitación a cuentas activas', async () => {
    const actor = userEvent.setup()
    let resetRequested = false

    mockAuthenticatedSession()
    mockUserDetail(activatedPartner)

    server.use(
      http.post(`${detailUrl}/send-password-reset`, () => {
        resetRequested = true

        return HttpResponse.json({
          success: true,
          message: 'Enlace de restablecimiento enviado.',
          data: { emailSent: true },
        })
      }),
    )

    renderApp(['/usuarios/4'])

    await screen.findByRole('heading', { name: 'Luis Mendoza' })

    expect(
      screen.queryByRole('button', { name: 'Reenviar invitación' }),
    ).not.toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', {
        name: 'Enviar enlace de restablecimiento',
      }),
    )

    expect(
      await screen.findByText('Enlace de restablecimiento enviado.'),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(resetRequested).toBe(true)
    })
  })

  it('desactiva la cuenta con confirmación', async () => {
    const actor = userEvent.setup()
    let captured: Record<string, unknown> | undefined

    mockAuthenticatedSession()
    mockUserDetail(activatedPartner)

    server.use(
      http.patch(detailUrl, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>

        return HttpResponse.json({
          success: true,
          message: 'Usuario actualizado exitosamente.',
          data: { user: { ...activatedPartner, isActive: false } },
        })
      }),
    )

    renderApp(['/usuarios/4'])

    await screen.findByRole('heading', { name: 'Luis Mendoza' })

    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(true)

    await actor.click(
      screen.getByRole('button', { name: 'Desactivar cuenta' }),
    )

    expect(
      await screen.findByText('Cuenta desactivada correctamente.'),
    ).toBeInTheDocument()
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(captured).toEqual({ isActive: false })
  })

  it('elimina el usuario con confirmación y vuelve al listado', async () => {
    const actor = userEvent.setup()
    let deleteRequested = false

    mockAuthenticatedSession()
    mockUserDetail(activatedPartner)
    mockUsersList()

    server.use(
      http.delete(detailUrl, () => {
        deleteRequested = true

        return HttpResponse.json({
          success: true,
          message: 'Usuario eliminado exitosamente.',
          data: { deletedId: 4 },
        })
      }),
    )

    renderApp(['/usuarios/4'])

    await screen.findByRole('heading', { name: 'Luis Mendoza' })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await actor.click(
      screen.getByRole('button', { name: 'Eliminar usuario' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Usuarios' }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(deleteRequested).toBe(true)
    })
  })

  it('muestra el estado de usuario no encontrado', async () => {
    mockAuthenticatedSession()

    server.use(
      http.get(`${usersUrl}/999`, () =>
        HttpResponse.json(
          {
            success: false,
            code: 'USER_NOT_FOUND',
            message: 'El usuario no fue encontrado.',
          },
          { status: 404 },
        ),
      ),
    )

    renderApp(['/usuarios/999'])

    expect(
      await screen.findByRole('heading', { name: 'Usuario no encontrado' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('El usuario no existe o fue eliminado del panel.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Volver a usuarios' }),
    ).toBeInTheDocument()
  })
})
