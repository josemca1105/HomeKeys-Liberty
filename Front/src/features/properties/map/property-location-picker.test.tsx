import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PropertyLocationPicker } from './property-location-picker'

vi.mock('./property-map-canvas', () => ({
  PropertyMapCanvas: ({
    onCoordinatesChange,
    ariaLabel,
  }: {
    onCoordinatesChange?: (coordinates: {
      latitude: number
      longitude: number
    }) => void
    ariaLabel: string
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() =>
        onCoordinatesChange?.({ latitude: 10.25, longitude: -68.45 })
      }
    >
      Mapa de prueba
    </button>
  ),
}))

describe('PropertyLocationPicker', () => {
  it('sincroniza el mapa con los campos de coordenadas', async () => {
    const actor = userEvent.setup()
    const onChange = vi.fn()

    render(
      <PropertyLocationPicker
        initialLatitude={10.1}
        initialLongitude={-68.1}
        onChange={onChange}
      />,
    )

    await actor.click(
      screen.getByRole('button', {
        name: 'Selector de ubicación de la captación',
      }),
    )

    expect(onChange).toHaveBeenCalledWith({
      latitude: 10.25,
      longitude: -68.45,
    })
    expect(screen.getByLabelText('Latitud')).toHaveValue(10.25)
    expect(screen.getByLabelText('Longitud')).toHaveValue(-68.45)
  })

  it('valida y aplica coordenadas escritas manualmente', async () => {
    const actor = userEvent.setup()
    const onChange = vi.fn()

    render(
      <PropertyLocationPicker
        initialLatitude={10.1}
        initialLongitude={-68.1}
        onChange={onChange}
      />,
    )

    await actor.clear(screen.getByLabelText('Latitud'))
    await actor.type(screen.getByLabelText('Latitud'), '100')
    await actor.click(
      screen.getByRole('button', { name: 'Aplicar coordenadas' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La latitud debe estar entre -90 y 90',
    )
    expect(onChange).not.toHaveBeenCalled()

    await actor.clear(screen.getByLabelText('Latitud'))
    await actor.type(screen.getByLabelText('Latitud'), '10.1234567')
    await actor.clear(screen.getByLabelText('Longitud'))
    await actor.type(screen.getByLabelText('Longitud'), '-68.7654321')
    await actor.click(
      screen.getByRole('button', { name: 'Aplicar coordenadas' }),
    )

    expect(onChange).toHaveBeenCalledWith({
      latitude: 10.1234567,
      longitude: -68.7654321,
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
