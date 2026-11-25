import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
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
const createUserUrl = `${env.apiBaseUrl}/users/add`

const createdUser: User = {
  id: 9,
  firstName: 'María',
  lastName: 'López',
  email: 'maria.lopez@example.com',
  phone: '0414-1234567',
  photoUrl: null,
  role: 'ADMIN',
  isActive: true,
  mustChangePassword: true,
  createdAt: '2026-11-24T12:00:00.000Z',
  updatedAt: '2026-11-24T12:00:00.000Z',
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

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('invitación de usuarios', () => {
  it('valida los campos obligatorios', async () => {
    const actor = userEvent.setup()

    mockAuthenticatedSession()

    renderApp(['/usuarios/nuevo'])

    await screen.findByRole('heading', { name: 'Invitar usuario' })

    await actor.click(
      screen.getByRole('button', { name: 'Enviar invitación' }),
    )

    expect(await screen.findByText('Ingresa el nombre.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa el apellido.')).toBeInTheDocument()
    expect(
      screen.getByText('Ingresa el correo electrónico.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ingresa un teléfono válido.')).toBeInTheDocument()
  })

  it('crea el usuario y confirma el envío de la invitación', async () => {
    const actor = userEvent.setup()
    let captured: Record<string, unknown> | undefined

    mockAuthenticatedSession()

    server.use(
      http.post(createUserUrl, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>

        return HttpResponse.json(
          {
            success: true,
            message: 'Usuario registrado exitosamente.',
            data: { user: createdUser, invitationSent: true },
          },
          { status: 201 },
        )
      }),
    )

    renderApp(['/usuarios/nuevo'])

    await screen.findByRole('heading', { name: 'Invitar usuario' })

    await actor.type(screen.getByLabelText('Nombre'), 'María')
    await actor.type(screen.getByLabelText('Apellido'), 'López')
    await actor.type(
      screen.getByLabelText('Correo electrónico'),
      'maria.lopez@example.com',
    )
    await actor.type(screen.getByLabelText('Teléfono'), '0414-1234567')
    await actor.selectOptions(screen.getByLabelText('Rol'), 'ADMIN')
    await actor.click(
      screen.getByRole('button', { name: 'Enviar invitación' }),
    )

    expect(
      await screen.findByText('Invitación enviada a maria.lopez@example.com.'),
    ).toBeInTheDocument()
    expect(captured).toMatchObject({
      firstName: 'María',
      lastName: 'López',
      email: 'maria.lopez@example.com',
      phone: '0414-1234567',
      role: 'ADMIN',
    })
    expect(captured).not.toHaveProperty('password')
    expect(captured).not.toHaveProperty('isActive')
    expect(
      (screen.getByLabelText('Nombre') as HTMLInputElement).value,
    ).toBe('')
  })

  it('muestra el error de correo duplicado del servidor', async () => {
    const actor = userEvent.setup()

    mockAuthenticatedSession()

    server.use(
      http.post(createUserUrl, () =>
        HttpResponse.json(
          {
            success: false,
            code: 'EMAIL_ALREADY_REGISTERED',
            message: 'Ese correo ya pertenece a otro usuario.',
          },
          { status: 409 },
        ),
      ),
    )

    renderApp(['/usuarios/nuevo'])

    await screen.findByRole('heading', { name: 'Invitar usuario' })

    await actor.type(screen.getByLabelText('Nombre'), 'María')
    await actor.type(screen.getByLabelText('Apellido'), 'López')
    await actor.type(
      screen.getByLabelText('Correo electrónico'),
      'maria.lopez@example.com',
    )
    await actor.type(screen.getByLabelText('Teléfono'), '0414-1234567')
    await actor.click(
      screen.getByRole('button', { name: 'Enviar invitación' }),
    )

    expect(
      await screen.findByText('Ese correo ya pertenece a otro usuario.'),
    ).toBeInTheDocument()
  })
})
