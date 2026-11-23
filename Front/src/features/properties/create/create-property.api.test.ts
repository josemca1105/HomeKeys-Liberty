import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import { testProperty } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import {
  MAX_PHOTO_BYTES,
  createProperty,
  uploadPhotoBinary,
  validatePhotoSelection,
} from './create-property.api'
import {
  CREATE_PROPERTY_DEFAULT_VALUES,
  toCreatePropertyRequest,
} from './create-property.schema'
import type { PhotoUploadTarget } from '../property.types'

function makeFile(
  name: string,
  type = 'image/jpeg',
  size = 1_024,
): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: size,
  })
  return file
}

describe('validatePhotoSelection', () => {
  it('acepta cinco imágenes válidas', () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      makeFile(`foto-${index + 1}.jpg`),
    )
    const result = validatePhotoSelection(files, 0)

    expect(result.validFiles).toHaveLength(5)
    expect(result.issues).toEqual([])
  })

  it('rechaza MIME inválido, archivos vacíos y mayores a 8 MB', () => {
    const result = validatePhotoSelection(
      [
        makeFile('documento.pdf', 'application/pdf'),
        makeFile('vacia.jpg', 'image/jpeg', 0),
        makeFile('grande.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1),
      ],
      0,
    )

    expect(result.validFiles).toHaveLength(0)
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'Solo se permiten imágenes JPEG, PNG o WebP.',
      'El archivo está vacío.',
      'La imagen supera el máximo de 8 MB.',
    ])
  })

  it('limita la selección a 20 fotografías', () => {
    const files = Array.from({ length: 21 }, (_, index) =>
      makeFile(`foto-${index + 1}.jpg`),
    )
    const result = validatePhotoSelection(files, 0)

    expect(result.validFiles).toHaveLength(20)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.message).toContain('máximo de 20')
  })

  it('descuenta las fotografías que ya existen en el lote', () => {
    const result = validatePhotoSelection(
      [makeFile('nueva-1.jpg'), makeFile('nueva-2.jpg')],
      19,
    )

    expect(result.validFiles).toHaveLength(1)
    expect(result.issues).toHaveLength(1)
  })
})

describe('uploadPhotoBinary', () => {
  it('sube el archivo sin Authorization y conserva la firma', async () => {
    let captured: Request | undefined

    server.use(
      http.put(
        `${env.apiBaseUrl}/property-photos/local-upload`,
        ({ request }) => {
          captured = request
          return new HttpResponse(null, { status: 204 })
        },
      ),
    )

    const target: PhotoUploadTarget = {
      url: '/api/v1/property-photos/local-upload',
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Photo-Upload-Token': 'signed-token',
      },
      storageKey: 'property-photos/pending/foto.jpg',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }

    await uploadPhotoBinary(target, makeFile('foto.jpg'), () => {})

    expect(captured).toBeDefined()
    expect(captured?.headers.get('authorization')).toBeNull()
    expect(captured?.headers.get('x-photo-upload-token')).toBe(
      'signed-token',
    )
  })
})

describe('createProperty', () => {
  it('envía el lote y la portada seleccionada', async () => {
    let captured: Record<string, unknown> | undefined

    server.use(
      http.post(`${env.apiBaseUrl}/properties`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>

        return HttpResponse.json(
          {
            success: true,
            message: 'Captación creada exitosamente.',
            data: { property: testProperty },
          },
          { status: 201 },
        )
      }),
    )

    const values = {
      ...CREATE_PROPERTY_DEFAULT_VALUES,
      title: 'Casa nueva',
      ownerName: 'Carlos Pérez',
      ownerPhone: '0414-1234567',
      address: 'Av. Principal, casa 12',
      city: 'Valencia',
      state: 'Carabobo',
      price: '150000',
      bedrooms: '3',
      bathrooms: '2',
      parkingSpaces: '2',
      squareMeters: '120',
    }
    const payload = toCreatePropertyRequest(values, {
      photoBatchId: 'batch-1',
      coverUploadId: 'upload-3',
    })

    const property = await createProperty(payload)

    expect(property.id).toBe(testProperty.id)
    expect(captured).toMatchObject({
      photoBatchId: 'batch-1',
      coverUploadId: 'upload-3',
      title: 'Casa nueva',
      price: 150000,
    })
    expect(captured).not.toHaveProperty('agentId')
  })
})
