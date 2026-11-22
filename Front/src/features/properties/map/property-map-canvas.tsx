import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from 'maplibre-gl'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { env } from '@/config/env'
import { cn } from '@/lib/cn'
import './maplibre-setup'

export interface MapCoordinates {
  latitude: number
  longitude: number
}

interface PropertyMapCanvasProps {
  latitude: number
  longitude: number
  editable?: boolean
  onCoordinatesChange?: (coordinates: MapCoordinates) => void
  ariaLabel: string
  className?: string
}

export function PropertyMapCanvas({
  latitude,
  longitude,
  editable = false,
  onCoordinatesChange,
  ariaLabel,
  className,
}: PropertyMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const initialCoordinatesRef = useRef({ latitude, longitude })
  const editableRef = useRef(editable)
  const onCoordinatesChangeRef = useRef(onCoordinatesChange)
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    editableRef.current = editable
  }, [editable])

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange
  }, [onCoordinatesChange])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let map: MapLibreMap

    try {
      map = new MapLibreMap({
        container,
        style: env.mapStyleUrl,
        center: [
          initialCoordinatesRef.current.longitude,
          initialCoordinatesRef.current.latitude,
        ],
        zoom: 16,
        attributionControl: { compact: true },
      })
    } catch {
      // MapLibre initialization depends on browser capabilities such as WebGL.
      // oxlint-disable-next-line react/set-state-in-effect
      setHasError(true)
      return
    }

    mapRef.current = map
    map.addControl(
      new NavigationControl({ showCompass: false }),
      'top-right',
    )
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()

    const marker = new Marker({
      color: '#075b9e',
      draggable: editableRef.current,
    })
      .setLngLat([
        initialCoordinatesRef.current.longitude,
        initialCoordinatesRef.current.latitude,
      ])
      .addTo(map)
    markerRef.current = marker

    const handleLoad = () => {
      setIsReady(true)
      setHasError(false)
    }

    const handleError = () => {
      if (!map.isStyleLoaded()) {
        setHasError(true)
        setIsReady(false)
      }
    }

    const handleClick = (event: { lngLat: { lat: number; lng: number } }) => {
      if (!editableRef.current) {
        return
      }

      const nextCoordinates = {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      }

      marker.setLngLat([nextCoordinates.longitude, nextCoordinates.latitude])
      onCoordinatesChangeRef.current?.(nextCoordinates)
    }

    const handleDragEnd = () => {
      const position = marker.getLngLat()

      onCoordinatesChangeRef.current?.({
        latitude: position.lat,
        longitude: position.lng,
      })
    }

    map.on('load', handleLoad)
    map.on('error', handleError)
    map.on('click', handleClick)
    marker.on('dragend', handleDragEnd)

    return () => {
      marker.off('dragend', handleDragEnd)
      marker.remove()
      map.off('load', handleLoad)
      map.off('error', handleError)
      map.off('click', handleClick)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude])
  }, [latitude, longitude])

  return (
    <div
      className={cn(
        'homekeys-map relative isolate size-full overflow-hidden bg-[#dce9ec]',
        editable && 'cursor-crosshair',
        className,
      )}
      role="region"
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="size-full" />

      {!isReady && !hasError ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 grid place-items-center bg-[#dce9ec]"
        >
          <div className="flex flex-col items-center text-center">
            <LoaderCircle
              aria-hidden="true"
              className="size-6 animate-spin text-brand-700"
            />
            <p className="mt-3 text-sm font-semibold text-brand-900">
              Cargando mapa…
            </p>
          </div>
        </div>
      ) : null}

      {hasError ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 grid place-items-center bg-surface p-5 text-center"
        >
          <div>
            <TriangleAlert
              aria-hidden="true"
              className="mx-auto size-7 text-[#9a332b]"
            />
            <p className="mt-3 font-display text-lg font-semibold text-brand-950">
              No pudimos cargar el mapa
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-muted">
              La dirección y las coordenadas continúan disponibles. También
              puedes abrir la ubicación en OpenStreetMap.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
