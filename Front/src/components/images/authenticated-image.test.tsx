import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  clearAccessToken,
  setAccessToken,
} from '@/api/access-token'
import { resolveApiResourceUrl } from '@/api/resource-url'
import { createTestToken } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { AuthenticatedImage } from './authenticated-image'

const photoUrl = '/api/v1/properties/1/photos/1/content'

function renderImage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthenticatedImage src={photoUrl} alt="Fachada" eager />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  clearAccessToken()
})

describe('AuthenticatedImage', () => {
  it('descarga la imagen con Bearer y libera el object URL', async () => {
    const createObjectUrl = vi.fn(() => 'blob:test-image')
    const revokeObjectUrl = vi.fn()

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    })

    const token = createTestToken()
    setAccessToken(token)

    let receivedAuthorization: string | null = null

    server.use(
      http.get(resolveApiResourceUrl(photoUrl), ({ request }) => {
        receivedAuthorization = request.headers.get('Authorization')

        return new HttpResponse(new Blob(['image-bytes']), {
          headers: {
            'Content-Type': 'image/webp',
          },
        })
      }),
    )

    const view = renderImage()
    const image = await screen.findByRole('img', { name: 'Fachada' })

    await waitFor(() => {
      expect(image).toHaveAttribute('src', 'blob:test-image')
    })
    expect(receivedAuthorization).toBe(`Bearer ${token}`)
    expect(createObjectUrl).toHaveBeenCalledOnce()

    view.unmount()

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test-image')
  })
})
