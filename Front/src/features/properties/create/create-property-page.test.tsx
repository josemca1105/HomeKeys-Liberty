import {
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { env } from '@/config/env'
import type { AuthUser } from '@/features/auth/auth.types'
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
const batchesUrl = `${env.apiBaseUrl}/property-photo-batches`
const localUploadUrl = `${env.apiBaseUrl}/property-photos/local-upload`

type Actor = ReturnType<typeof userEvent.setup>

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function mockAuthenticatedSession(user: AuthUser = testUser) {
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

function mockEmptyPropertyList() {
  server.use(
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
}

function mockPhotoPipeline() {
  let uploadSequence = 0

  server.use(
    http.post(
      batchesUrl,
      () =>
        HttpResponse.json(
          {
            success: true,
            message: 'Lote creado exitosamente.',
            data: {
              batch: {
                id: 'batch-1',
                status: 'OPEN',
                expiresAt: futureIso(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                uploads: [],
              },
            },
          },
          { status: 201 },
        ),
    ),
    http.post(
      `${batchesUrl}/batch-1/photos/upload-url`,
      async ({ request }) => {
        const body = (await request.json()) as {
          mimeType: string
          sizeBytes: number
        }

        uploadSequence += 1

        return HttpResponse.json(
          {
            success: true,
            message: 'URL de carga generada.',
            data: {
              upload: {
                url: '/api/v1/property-photos/local-upload',
                method: 'PUT',
                headers: {
                  'Content-Type': body.mimeType,
                  'X-Photo-Upload-Token': 'signed-token',
                },
                expiresAt: futureIso(),
                storageKey: `property-photos/pending/foto-${uploadSequence}.jpg`,
              },
            },
          },
          { status: 201 },
        )
      },
    ),
    http.put(
      localUploadUrl,
      () => new HttpResponse(null, { status: 204 }),
    ),
    http.post(
      `${batchesUrl}/batch-1/photos/confirm`,
      async ({ request }) => {
        const body = (await request.json()) as {
          storageKey: string
          altText: string
        }

        return HttpResponse.json(
          {
            success: true,
            message: 'Fotografía confirmada.',
            data: {
              upload: {
                id: `upload-${body.altText}`,
                previewUrl: `/api/v1/property-photos/${body.altText}`,
                mimeType: 'image/webp',
                sizeBytes: 1_024,
                width: 800,
                height: 600,
                altText: body.altText,
                sortOrder: 0,
                status: 'READY',
                createdAt: new Date().toISOString(),
              },
            },
          },
          { status: 201 },
        )
      },
    ),
    http.delete(
      `${batchesUrl}/batch-1/photos/:uploadId`,
      () => new HttpResponse(null, { status: 204 }),
    ),
  )
}

function mockCreatedProperty(onCreate?: (body: Record<string, unknown>) => void) {
  server.use(
    http.post(propertiesUrl, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      onCreate?.(body)

      return HttpResponse.json(
        {
          success: true,
          message: 'Captación creada exitosamente.',
          data: { property: testProperty },
        },
        { status: 201 },
      )
    }),
    http.get(`${propertiesUrl}/1`, () =>
      HttpResponse.json({
        success: true,
        message: 'Captación obtenida exitosamente.',
        data: { property: testProperty },
      }),
    ),
  )
}

async function fillMainInfo(actor: Actor) {
  await actor.type(
    screen.getByLabelText(/^Título\*$/),
    'Apartamento nuevo en Naguanagua',
  )
  await actor.type(screen.getByLabelText(/^Precio\*$/), '120000')
}

async function fillLocation(actor: Actor) {
  await actor.type(
    screen.getByLabelText(/^Nombre completo\*$/),
    'María Rodríguez',
  )
  await actor.type(
    screen.getByLabelText(/^Teléfono\*$/),
    '0414-5556677',
  )
  await actor.type(
    screen.getByLabelText(/^Dirección\*$/),
    'Av. Universidad, torre 4',
  )
  await actor.type(screen.getByLabelText(/^Ciudad\*$/), 'Naguanagua')
  await actor.type(screen.getByLabelText(/^Estado\*$/), 'Carabobo')
}

async function fillFeatures(actor: Actor) {
  await actor.type(screen.getByLabelText(/^Habitaciones\*$/), '3')
  await actor.type(screen.getByLabelText(/^Baños\*$/), '2')
  await actor.type(screen.getByLabelText(/^Estacionamientos\*$/), '1')
  await actor.type(
    screen.getByLabelText(/^Área de construcción\*$/),
    '95',
  )
}

async function continueToPhotos(actor: Actor) {
  await fillMainInfo(actor)
  await actor.click(screen.getByRole('button', { name: 'Continuar' }))

  await screen.findByLabelText(/^Nombre completo\*$/)
  await fillLocation(actor)
  await actor.click(screen.getByRole('button', { name: 'Continuar' }))

  await screen.findByLabelText(/^Habitaciones\*$/)
  await fillFeatures(actor)
  await actor.click(screen.getByRole('button', { name: 'Continuar' }))

  await screen.findByRole('heading', { name: 'Fotografías' })
}

function uploadFiles(files: File[]) {
  const input = document.querySelector<HTMLInputElement>(
    'input[type="file"]',
  )

  expect(input).not.toBeNull()
  fireEvent.change(input as HTMLInputElement, {
    target: { files },
  })
}

async function waitForReadyPhotos(count: number) {
  await waitFor(() => {
    const summary = screen.getByText((_, element) => {
      return (
        element?.tagName === 'P' &&
        element.textContent?.includes('mínimo requerido') === true
      )
    })

    expect(summary).toHaveTextContent(`${count} listas`)
  })
}

beforeEach(() => {
  let previewCount = 0

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => `blob:preview-${previewCount++}`),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  clearAccessToken()
  window.sessionStorage.clear()
})

describe('creación de captaciones', () => {
  it('valida cada paso antes de avanzar', async () => {
    const actor = userEvent.setup()

    mockAuthenticatedSession()

    renderApp(['/captaciones/nueva'])

    expect(
      await screen.findByRole('heading', { name: 'Nueva captación' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Agente asignado/),
    ).not.toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Ingresa el título.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Título\*$/)).toBeInTheDocument()

    await fillMainInfo(actor)
    await actor.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByLabelText(/^Nombre completo\*$/),
    ).toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Ingresa el nombre del propietario.'),
    ).toBeInTheDocument()
  })

  it(
    'bloquea el paso de fotos con 4 y lo permite con 5',
    { timeout: 15_000 },
    async () => {
      const actor = userEvent.setup()

      mockAuthenticatedSession()
      mockPhotoPipeline()

      renderApp(['/captaciones/nueva'])
      await screen.findByRole('heading', { name: 'Nueva captación' })

      await continueToPhotos(actor)
      uploadFiles([
        makeFile('foto-1.jpg'),
        makeFile('foto-2.jpg'),
        makeFile('foto-3.jpg'),
        makeFile('foto-4.jpg'),
      ])

      await waitForReadyPhotos(4)

      expect(
        screen.getByRole('button', { name: 'Continuar' }),
      ).toBeDisabled()

      uploadFiles([makeFile('foto-5.jpg')])
      await waitForReadyPhotos(5)

      expect(
        screen.getByRole('button', { name: 'Continuar' }),
      ).toBeEnabled()
    },
  )

  it(
    'crea la captación con portada elegida y abre el detalle',
    { timeout: 15_000 },
    async () => {
    const actor = userEvent.setup()
    let createPayload: Record<string, unknown> | undefined

    mockAuthenticatedSession()
    mockAgentDirectory()
    mockPhotoPipeline()
    mockCreatedProperty((body) => {
      createPayload = body
    })

    renderApp(['/captaciones/nueva'])
    await screen.findByRole('heading', { name: 'Nueva captación' })

    await continueToPhotos(actor)
    uploadFiles([
      makeFile('foto-1.jpg'),
      makeFile('foto-2.jpg'),
      makeFile('foto-3.jpg'),
      makeFile('foto-4.jpg'),
      makeFile('foto-5.jpg'),
    ])
    await waitForReadyPhotos(5)

    const coverCard = screen
      .getByAltText('Vista previa de foto-3.jpg')
      .closest('li')

    expect(coverCard).not.toBeNull()
    await actor.click(
      within(coverCard as HTMLElement).getByRole('button', {
        name: /portada/i,
      }),
    )

    expect(
      within(coverCard as HTMLElement).getByRole('button', {
        name: 'Portada',
      }),
    ).toHaveAttribute('aria-pressed', 'true')

    await actor.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByRole('button', { name: 'Crear captación' }),
    ).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', { name: 'Crear captación' }),
    )

    await waitFor(() => {
      expect(createPayload).toBeDefined()
    })

    expect(createPayload).toMatchObject({
      photoBatchId: 'batch-1',
      coverUploadId: 'upload-foto-3',
      title: 'Apartamento nuevo en Naguanagua',
      price: 120000,
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 1,
      squareMeters: 95,
    })
    expect(createPayload).not.toHaveProperty('agentId')

    expect(
      await screen.findByRole('heading', { name: testProperty.title }),
    ).toBeInTheDocument()
  })

  it('pide confirmación antes de abandonar el borrador por navegación SPA', async () => {
    const actor = userEvent.setup()

    mockAuthenticatedSession()
    mockAgentDirectory()
    mockEmptyPropertyList()

    renderApp(['/captaciones/nueva'])
    await screen.findByRole('heading', { name: 'Nueva captación' })

    await actor.type(
      screen.getByLabelText(/^Título\*$/),
      'Borrador sin guardar',
    )

    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(false)

    await actor.click(
      screen.getByRole('link', { name: 'Captaciones' }),
    )

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('heading', { name: 'Nueva captación' }),
    ).toBeInTheDocument()

    confirmSpy.mockReturnValue(true)

    await actor.click(
      screen.getByRole('link', { name: 'Captaciones' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Captaciones' }),
    ).toBeInTheDocument()
  })
})
