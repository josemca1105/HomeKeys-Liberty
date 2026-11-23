import { describe, expect, it } from 'vitest'
import { PROPERTY_TYPE_LABELS } from './property-labels'

describe('PROPERTY_TYPE_LABELS', () => {
  it('muestra Townhouse para el tipo TOWNHOUSE', () => {
    expect(PROPERTY_TYPE_LABELS.TOWNHOUSE).toBe('Townhouse')
  })
})
