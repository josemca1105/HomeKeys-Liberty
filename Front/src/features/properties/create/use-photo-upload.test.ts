import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPhotoLocalId } from './use-photo-upload'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createPhotoLocalId', () => {
  it('usa crypto.randomUUID cuando está disponible', () => {
    const randomUUID = vi.fn(() => 'uuid-1')
    vi.stubGlobal('crypto', { randomUUID })

    expect(createPhotoLocalId()).toBe('uuid-1')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('genera IDs locales cuando crypto.randomUUID no está disponible', () => {
    vi.stubGlobal('crypto', {})

    const first = createPhotoLocalId()
    const second = createPhotoLocalId()

    expect(first).toMatch(/^photo-[a-z0-9]+-\d+$/)
    expect(second).toMatch(/^photo-[a-z0-9]+-\d+$/)
    expect(first).not.toBe(second)
  })
})
