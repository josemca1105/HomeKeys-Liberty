import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PropertyMapCanvas } from './property-map-canvas'

const mapMocks = vi.hoisted(() => {
  const marker = {
    setLngLat: vi.fn(),
    addTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    getLngLat: vi.fn(() => ({ lat: 10.5, lng: -68.5 })),
  }
  marker.setLngLat.mockReturnValue(marker)
  marker.addTo.mockReturnValue(marker)

  const map = {
    addControl: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    isStyleLoaded: vi.fn(() => false),
    dragRotate: { disable: vi.fn() },
    touchZoomRotate: { disableRotation: vi.fn() },
  }

  return {
    marker,
    map,
    MapMock: vi.fn(function MapMock(options: {
      center: [number, number]
      zoom: number
      style: string
    }) {
      void options
      return map
    }),
    MarkerMock: vi.fn(function MarkerMock(options: {
      color: string
      draggable: boolean
    }) {
      void options
      return marker
    }),
    NavigationControlMock: vi.fn(function NavigationControlMock(options: {
      showCompass: boolean
    }) {
      void options
    }),
  }
})

vi.mock('maplibre-gl', () => ({
  Map: mapMocks.MapMock,
  Marker: mapMocks.MarkerMock,
  NavigationControl: mapMocks.NavigationControlMock,
}))

vi.mock('./maplibre-setup', () => ({}))

function getMapHandler(eventName: string) {
  return mapMocks.map.on.mock.calls.find(
    ([event]) => event === eventName,
  )?.[1] as ((event: unknown) => void) | undefined
}

describe('PropertyMapCanvas', () => {
  it('inicializa MapLibre, muestra el mapa y reporta interacciones', () => {
    const onCoordinatesChange = vi.fn()

    render(
      <PropertyMapCanvas
        latitude={10.1234567}
        longitude={-68.1234567}
        editable
        onCoordinatesChange={onCoordinatesChange}
        ariaLabel="Mapa de prueba"
      />,
    )

    expect(mapMocks.MapMock).toHaveBeenCalledOnce()
    expect(mapMocks.MapMock.mock.calls[0]?.[0]).toMatchObject({
      center: [-68.1234567, 10.1234567],
      zoom: 16,
    })
    expect(
      screen.getByText('Cargando mapa…'),
    ).toBeInTheDocument()

    const loadHandler = getMapHandler('load')
    expect(loadHandler).toBeDefined()

    act(() => {
      loadHandler?.({})
    })

    expect(screen.queryByText('Cargando mapa…')).not.toBeInTheDocument()

    const clickHandler = getMapHandler('click') as
      | ((event: {
          lngLat: { lat: number; lng: number }
        }) => void)
      | undefined

    act(() => {
      clickHandler?.({ lngLat: { lat: 10.4, lng: -68.2 } })
    })

    expect(mapMocks.marker.setLngLat).toHaveBeenLastCalledWith([
      -68.2, 10.4,
    ])
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: 10.4,
      longitude: -68.2,
    })
  })

  it('muestra el fallback cuando el estilo no puede cargarse', () => {
    render(
      <PropertyMapCanvas
        latitude={10.1234567}
        longitude={-68.1234567}
        ariaLabel="Mapa de prueba"
      />,
    )

    const errorHandler = getMapHandler('error')

    act(() => {
      errorHandler?.({ error: new Error('style failed') })
    })

    expect(
      screen.getByText('No pudimos cargar el mapa'),
    ).toBeInTheDocument()
  })
})
