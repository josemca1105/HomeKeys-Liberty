import {
  fireEvent,
  screen,
  waitFor,
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
import type {
  Property,
  PropertyPhoto,
} from '@/features/properties/property.types'
import {
  createTestPhotos,
  createTestToken,
  testProperty,
  testUser,
} from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

vi.mock('@/components/images/authenticated-image', () => ({
  AuthenticatedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const meUrl = `${env.apiBaseUrl}/users/me`
const propertiesUrl = `${env.apiBaseUrl}/properties`
const propertyUrl = `${propertiesUrl}/1`
const photosUrl = `${propertyUrl}/photos`

const testPartner: AuthUser = {
  ...testUser,
  id: 4,
  firstName: 'Luis',
  lastName: 'Mendoza',
  email: 'luis.mendoza@example.com',
  role: 'PARTNER',
}

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' })
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

function mockProperty(
  getCurrent: () => Property,
) {
  server.use(
    http.get(propertyUrl, () =>
      HttpResponse.json({
        success: true,
        message: 'Captación obtenida exitosamente.',
        data: { property: getCurrent() },
      }),
    ),
  )
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

describe('gestión de fotografías', () => {
  it('permite elegir una nueva portada', async () => {
    const actor = userEvent.setup()
    let current: Property = {
      ...testProperty,
      photos: createTestPhotos(6),
    }
    let coverPhotoId: number | null = null

    mockSession(testUser)
    mockProperty(() => current)

    server.use(
      http.patch(`${photosUrl}/:photoId/cover`, ({ params }) => {
        coverPhotoId = Number(params.photoId)
        current = {
          ...current,
          photos: current.photos.map((photo) => ({
            ...photo,
            isCover: photo.id === coverPhotoId,
          })),
        }

        return HttpResponse.json({
          success: true,
          message: 'Portada actualizada.',
          data: {
            photo: current.photos.find(
              (photo) => photo.id === coverPhotoId,
            ),
          },
        })
      }),
    )

    renderApp(['/captaciones/1/fotos'])

    expect(
      await screen.findByRole('heading', { name: 'Fotografías' }),
    ).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', {
        name: 'Elegir fotografía 2 como portada',
      }),
    )

    await waitFor(() => {
      expect(coverPhotoId).toBe(2)
    })
    expect(
      await screen.findByRole('button', { name: 'Portada actual' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Portada actualizada.'),
    ).toBeInTheDocument()
  })

  it('permite reordenar las fotografías', async () => {
    const actor = userEvent.setup()
    let current: Property = {
      ...testProperty,
      photos: createTestPhotos(6),
    }
    let reorderIds: number[] | null = null

    mockSession(testUser)
    mockProperty(() => current)

    server.use(
      http.patch(`${photosUrl}/order`, async ({ request }) => {
        const body = (await request.json()) as {
          photoIds: number[]
        }
        reorderIds = body.photoIds
        const byId = new Map(
          current.photos.map((photo) => [photo.id, photo]),
        )
        const photos = body.photoIds.map((id, index) => ({
          ...byId.get(id)!,
          sortOrder: index,
        }))
        current = { ...current, photos }

        return HttpResponse.json({
          success: true,
          message: 'Orden actualizado.',
          data: { photos },
        })
      }),
    )

    renderApp(['/captaciones/1/fotos'])

    expect(
      await screen.findByRole('heading', { name: 'Fotografías' }),
    ).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', {
        name: 'Mover fotografía 2 hacia arriba',
      }),
    )

    await waitFor(() => {
      expect(reorderIds).toEqual([2, 1, 3, 4, 5, 6])
    })
    await waitFor(() => {
      expect(screen.getAllByAltText(/^Foto \d+$/)[0]).toHaveAttribute(
        'alt',
        'Foto 2',
      )
    })
    expect(
      await screen.findByText('Orden actualizado.'),
    ).toBeInTheDocument()
  })

  it('elimina una foto y bloquea la eliminación al llegar a cinco', async () => {
    const actor = userEvent.setup()
    let current: Property = {
      ...testProperty,
      photos: createTestPhotos(6),
    }
    let deletedPhotoId: number | null = null

    mockSession(testUser)
    mockProperty(() => current)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    server.use(
      http.delete(`${photosUrl}/:photoId`, ({ params }) => {
        deletedPhotoId = Number(params.photoId)
        current = {
          ...current,
          photos: current.photos.filter(
            (photo) => photo.id !== deletedPhotoId,
          ),
        }

        return HttpResponse.json({
          success: true,
          message: 'Fotografía eliminada.',
          data: { deletedId: deletedPhotoId },
        })
      }),
    )

    renderApp(['/captaciones/1/fotos'])

    expect(
      await screen.findByRole('heading', { name: 'Fotografías' }),
    ).toBeInTheDocument()

    await actor.click(
      screen.getByRole('button', {
        name: 'Eliminar fotografía 6',
      }),
    )

    await waitFor(() => {
      expect(deletedPhotoId).toBe(6)
    })
    expect(
      await screen.findByText('Fotografía eliminada.'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Eliminar fotografía 1',
        }),
      ).toBeDisabled()
    })
    expect(
      screen.getByText(/No puedes eliminar más fotografías/),
    ).toBeInTheDocument()
  })

  it('sube una fotografía nueva a la captación', async () => {
    let current: Property = {
      ...testProperty,
      photos: createTestPhotos(5),
    }
    let confirmBody: Record<string, unknown> | null = null

    mockSession(testUser)
    mockProperty(() => current)

    server.use(
      http.post(`${photosUrl}/upload-url`, ({ request }) =>
        request.json().then(() =>
          HttpResponse.json({
            success: true,
            message: 'URL de carga generada.',
            data: {
              upload: {
                url: '/api/v1/property-photos/local-upload',
                method: 'PUT',
                headers: {
                  'Content-Type': 'image/jpeg',
                  'X-Photo-Upload-Token': 'signed-token',
                },
                expiresAt: futureIso(),
                storageKey: 'property-photos/pending/foto-6.jpg',
              },
            },
          }),
        ),
      ),
      http.put(
        `${env.apiBaseUrl}/property-photos/local-upload`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.post(`${photosUrl}/confirm`, async ({ request }) => {
        confirmBody = (await request.json()) as Record<
          string,
          unknown
        >
        const newPhoto: PropertyPhoto = {
          id: 6,
          url: '/api/v1/properties/1/photos/6/content',
          mimeType: 'image/webp',
          sizeBytes: 1_024,
          width: 1_200,
          height: 900,
          altText: 'foto-6',
          sortOrder: 5,
          isCover: false,
          createdAt: '2026-11-22T12:00:00.000Z',
          updatedAt: '2026-11-22T12:00:00.000Z',
        }
        current = {
          ...current,
          photos: [...current.photos, newPhoto],
        }

        return HttpResponse.json(
          {
            success: true,
            message: 'Fotografía confirmada.',
            data: { photo: newPhoto },
          },
          { status: 201 },
        )
      }),
    )

    renderApp(['/captaciones/1/fotos'])

    expect(
      await screen.findByRole('heading', { name: 'Fotografías' }),
    ).toBeInTheDocument()

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )

    expect(input).not.toBeNull()
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [makeFile('foto-6.jpg')] },
    })

    await waitFor(() => {
      expect(confirmBody).not.toBeNull()
    })
    expect(confirmBody).toMatchObject({ altText: 'foto-6' })
    expect(await screen.findByAltText('foto-6')).toBeInTheDocument()
    expect(
      await screen.findByText(/6 fotografías · mínimo 5/),
    ).toBeInTheDocument()
  })

  it('muestra la galería en solo lectura para un PARTNER con captación cerrada', async () => {
    mockSession(testPartner)
    mockProperty(() => ({
      ...testProperty,
      agentId: testPartner.id,
      status: 'CLOSED',
      closedAt: '2026-11-22T13:00:00.000Z',
      photos: createTestPhotos(5),
    }))

    renderApp(['/captaciones/1/fotos'])

    expect(
      await screen.findByText(
        /Solo un administrador puede agregar, ordenar o eliminar/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByAltText('Foto 1'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Elegir fotos' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Elegir portada' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /Eliminar fotografía/,
      }),
    ).not.toBeInTheDocument()
  })

  it('deshabilita la carga al alcanzar veinte fotografías', async () => {
    mockSession(testUser)
    mockProperty(() => ({
      ...testProperty,
      photos: createTestPhotos(20),
    }))

    renderApp(['/captaciones/1/fotos'])

    expect(
      await screen.findByText(
        'Alcanzaste el máximo de 20 fotografías.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Elegir fotos' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Tomar foto' }),
    ).toBeDisabled()
  })

  it('permite a un ADMIN gestionar una captación cerrada', async () => {
    mockSession(testUser)
    mockProperty(() => ({
      ...testProperty,
      status: 'CLOSED',
      closedAt: '2026-11-22T13:00:00.000Z',
      photos: createTestPhotos(5),
    }))

    renderApp(['/captaciones/1/fotos'])

    expect(
      await screen.findByText(
        /Como administrador aún puedes gestionar las fotografías/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Elegir fotos' }),
    ).toBeEnabled()
  })
})
