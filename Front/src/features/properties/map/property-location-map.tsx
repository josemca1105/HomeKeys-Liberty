import { lazy, Suspense } from 'react'
import { LoaderCircle, MapPin } from 'lucide-react'
import { useNearViewport } from '@/hooks/use-near-viewport'
import { cn } from '@/lib/cn'

const PropertyMapCanvas = lazy(async () => {
  const module = await import('./property-map-canvas')
  return { default: module.PropertyMapCanvas }
})

interface PropertyLocationMapProps {
  latitude: number
  longitude: number
  title: string
  className?: string
}

function MapLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid size-full place-items-center bg-[#dce9ec]"
    >
      <div className="flex flex-col items-center text-center">
        <LoaderCircle
          aria-hidden="true"
          className="size-6 animate-spin text-brand-700"
        />
        <p className="mt-3 text-sm font-semibold text-brand-900">
          Preparando mapa…
        </p>
      </div>
    </div>
  )
}

function InvalidLocation() {
  return (
    <div className="grid size-full place-items-center bg-surface p-5 text-center">
      <div>
        <MapPin
          aria-hidden="true"
          className="mx-auto size-7 text-brand-slate"
        />
        <p className="mt-3 text-sm font-semibold text-brand-900">
          Ubicación no disponible
        </p>
      </div>
    </div>
  )
}

export function PropertyLocationMap({
  latitude,
  longitude,
  title,
  className,
}: PropertyLocationMapProps) {
  const { ref, isNearViewport } = useNearViewport<HTMLDivElement>()
  const hasValidCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180

  return (
    <div
      ref={ref}
      role="region"
      aria-label={`Mapa de ubicación de ${title}`}
      className={cn(
        'relative h-[300px] overflow-hidden rounded-xl border border-line bg-[#dce9ec] sm:h-[360px]',
        className,
      )}
    >
      {!hasValidCoordinates ? (
        <InvalidLocation />
      ) : isNearViewport ? (
        <Suspense fallback={<MapLoading />}>
          <PropertyMapCanvas
            latitude={latitude}
            longitude={longitude}
            ariaLabel="Mapa interactivo de la propiedad"
          />
        </Suspense>
      ) : (
        <MapLoading />
      )}
    </div>
  )
}
