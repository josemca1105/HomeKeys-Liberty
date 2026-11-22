import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  PropertyMapCanvas,
  type MapCoordinates,
} from './property-map-canvas'

interface PropertyLocationPickerProps {
  initialLatitude: number
  initialLongitude: number
  onChange: (coordinates: MapCoordinates) => void
  error?: string
}

function formatCoordinate(value: number): string {
  return value.toFixed(7)
}

function normalizeCoordinate(value: number): number {
  return Number(value.toFixed(7))
}

export function PropertyLocationPicker({
  initialLatitude,
  initialLongitude,
  onChange,
  error,
}: PropertyLocationPickerProps) {
  const [coordinates, setCoordinates] = useState<MapCoordinates>({
    latitude: initialLatitude,
    longitude: initialLongitude,
  })
  const [latitudeDraft, setLatitudeDraft] = useState(() =>
    formatCoordinate(initialLatitude),
  )
  const [longitudeDraft, setLongitudeDraft] = useState(() =>
    formatCoordinate(initialLongitude),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [mapKey, setMapKey] = useState(0)

  const handleMapChange = (nextCoordinates: MapCoordinates) => {
    const normalized = {
      latitude: normalizeCoordinate(nextCoordinates.latitude),
      longitude: normalizeCoordinate(nextCoordinates.longitude),
    }

    setCoordinates(normalized)
    setLatitudeDraft(formatCoordinate(normalized.latitude))
    setLongitudeDraft(formatCoordinate(normalized.longitude))
    setLocalError(null)
    onChange(normalized)
  }

  const applyDraftCoordinates = () => {
    const latitude = Number(latitudeDraft)
    const longitude = Number(longitudeDraft)

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setLocalError(
        'La latitud debe estar entre -90 y 90, y la longitud entre -180 y 180.',
      )
      return
    }

    const normalized = {
      latitude: normalizeCoordinate(latitude),
      longitude: normalizeCoordinate(longitude),
    }

    setCoordinates(normalized)
    setLatitudeDraft(formatCoordinate(normalized.latitude))
    setLongitudeDraft(formatCoordinate(normalized.longitude))
    setLocalError(null)
    setMapKey((current) => current + 1)
    onChange(normalized)
  }

  const displayedError = localError ?? error

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#c8e3ea] bg-[#f0fafc] px-3.5 py-3 text-sm leading-6 text-brand-cyan-ink">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          Toca el mapa o arrastra el marcador para ubicar la propiedad. Luego
          puedes ajustar las coordenadas exactas.
        </p>
      </div>

      <PropertyMapCanvas
        key={mapKey}
        latitude={coordinates.latitude}
        longitude={coordinates.longitude}
        editable
        onCoordinatesChange={handleMapChange}
        ariaLabel="Selector de ubicación de la captación"
        className="h-[320px] rounded-xl border border-line sm:h-[380px]"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="property-latitude"
            className="text-sm font-semibold text-ink"
          >
            Latitud
          </label>
          <input
            id="property-latitude"
            type="number"
            inputMode="decimal"
            min={-90}
            max={90}
            step="any"
            value={latitudeDraft}
            onChange={(event) => {
              setLatitudeDraft(event.target.value)
              setLocalError(null)
            }}
            className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink focus:border-brand-600"
          />
        </div>

        <div>
          <label
            htmlFor="property-longitude"
            className="text-sm font-semibold text-ink"
          >
            Longitud
          </label>
          <input
            id="property-longitude"
            type="number"
            inputMode="decimal"
            min={-180}
            max={180}
            step="any"
            value={longitudeDraft}
            onChange={(event) => {
              setLongitudeDraft(event.target.value)
              setLocalError(null)
            }}
            className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink focus:border-brand-600"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        onClick={applyDraftCoordinates}
      >
        Aplicar coordenadas
      </Button>

      {displayedError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-[#9a332b]">
          {displayedError}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-ink-muted">
          Coordenadas actuales: {formatCoordinate(coordinates.latitude)},{' '}
          {formatCoordinate(coordinates.longitude)}
        </p>
      )}
    </div>
  )
}
