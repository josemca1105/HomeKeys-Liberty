import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  CarFront,
  ExternalLink,
  Hash,
  Home,
  LandPlot,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Ruler,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { AuthenticatedImage } from '@/components/images/authenticated-image'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import {
  AMENITIES,
  formatArea,
  formatLongDate,
  formatShortDate,
  formatUsd,
  getAgentDisplayName,
  getOpenStreetMapUrl,
  getPropertyLocation,
  LISTING_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../property-labels'
import {
  toAgentDirectory,
  useAgentDirectoryQuery,
  usePropertyQuery,
} from '../property-queries'
import type { Property } from '../property.types'
import { PropertyStatusBadge } from '../components/property-status-badge'
import { PropertyLocationMap } from '../map/property-location-map'

function DetailLoading() {
  return (
    <div className="mx-auto max-w-[1180px]" aria-busy="true">
      <div className="h-5 w-36 animate-pulse rounded bg-white" />
      <div className="mt-5 h-10 w-2/3 animate-pulse rounded-xl bg-white" />
      <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-white" />
      <div className="mt-7 aspect-[16/9] animate-pulse rounded-2xl bg-brand-950/[0.07]" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  )
}

function DetailError({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#e7b2ae] bg-white p-7 text-center shadow-panel">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff2f0] text-[#9a332b]">
        <Building2 aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.035em] text-brand-950">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
        {message}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          to="/captaciones"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-surface"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a captaciones
        </Link>
        {onRetry ? (
          <Button onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Reintentar
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl bg-surface p-3.5">
      <Icon
        aria-hidden="true"
        className="size-4 text-brand-slate"
      />
      <p className="mt-2 text-lg font-semibold text-brand-950">{value}</p>
      <p className="mt-0.5 text-xs leading-4 text-ink-muted">{label}</p>
    </div>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  )
}

function PropertyGallery({ property }: { property: Property }) {
  const photos = useMemo(
    () => [...property.photos].sort((a, b) => a.sortOrder - b.sortOrder),
    [property.photos],
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const safeIndex = Math.min(selectedIndex, Math.max(photos.length - 1, 0))
  const selectedPhoto = photos[safeIndex] ?? null

  if (!selectedPhoto) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-2xl border border-line bg-white text-brand-slate/55">
        <Building2 aria-hidden="true" className="size-10" />
      </div>
    )
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-brand-950/[0.07]">
        <AuthenticatedImage
          key={selectedPhoto.id}
          src={selectedPhoto.url}
          alt={selectedPhoto.altText || `Fotografía de ${property.title}`}
          className="aspect-[16/10] w-full sm:aspect-[16/9]"
          eager
        />
        <span className="absolute bottom-3 right-3 rounded-lg bg-brand-950/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          {safeIndex + 1} de {photos.length}
        </span>
      </div>

      {photos.length > 1 ? (
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="Miniaturas de fotografías"
        >
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Ver fotografía ${index + 1} de ${photos.length}`}
              aria-pressed={index === safeIndex}
              className={cn(
                'relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-colors',
                index === safeIndex
                  ? 'border-brand-700'
                  : 'border-transparent hover:border-brand-600/35',
              )}
            >
              <AuthenticatedImage
                src={photo.url}
                alt=""
                className="size-full"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function PropertyDetailPage() {
  const { propertyId: propertyIdParam } = useParams()
  const { user } = useAuth()
  const parsedPropertyId = Number(propertyIdParam)
  const propertyId =
    Number.isInteger(parsedPropertyId) && parsedPropertyId > 0
      ? parsedPropertyId
      : null
  const propertyQuery = usePropertyQuery(propertyId)
  const agentsQuery = useAgentDirectoryQuery(user?.role === 'ADMIN')
  const agentDirectory = useMemo(
    () => toAgentDirectory(agentsQuery.data),
    [agentsQuery.data],
  )
  const property = propertyQuery.data

  useEffect(() => {
    document.title = property
      ? `${property.code} | HomeKeys Liberty`
      : 'Captación | HomeKeys Liberty'
  }, [property])

  const queryError = propertyQuery.isError
    ? normalizeApiError(propertyQuery.error)
    : null

  if (!user) {
    return null
  }

  if (propertyId === null) {
    return (
      <AppShell pageTitle="Detalle de captación">
        <DetailError
          title="Captación no encontrada"
          message="El identificador de la captación no es válido."
        />
      </AppShell>
    )
  }

  if (propertyQuery.isPending) {
    return (
      <AppShell pageTitle="Detalle de captación">
        <DetailLoading />
      </AppShell>
    )
  }

  if (queryError) {
    const isNotFound = queryError.status === 404

    return (
      <AppShell pageTitle="Detalle de captación">
        <DetailError
          title={isNotFound ? 'Captación no encontrada' : 'No pudimos cargar la captación'}
          message={
            isNotFound
              ? 'La captación no existe, fue eliminada o no tienes acceso a ella.'
              : queryError.message
          }
          {...(!isNotFound
            ? { onRetry: () => void propertyQuery.refetch() }
            : {})}
        />
      </AppShell>
    )
  }

  if (!property) {
    return null
  }

  const currentUserName = `${user.firstName} ${user.lastName}`
  const agentName = getAgentDisplayName(
    property.agentId,
    user.id,
    currentUserName,
    agentDirectory,
  )
  const activeAmenities = AMENITIES.filter((amenity) =>
    Boolean(property[amenity.key]),
  )
  const location = getPropertyLocation(property)
  const phoneHref = `tel:${property.ownerPhone.replace(/[^\d+]/g, '')}`

  return (
    <AppShell pageTitle="Detalle de captación">
      <div className="mx-auto max-w-[1180px]">
        <Link
          to="/captaciones"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a captaciones
        </Link>

        <header className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-brand-slate">
              <Hash aria-hidden="true" className="size-3.5" />
              {property.code}
            </span>
            <PropertyStatusBadge status={property.status} />
            <span className="rounded-full border border-brand-cyan/30 bg-[#eaf9fc] px-2.5 py-1 text-xs font-semibold text-brand-cyan-ink">
              {LISTING_TYPE_LABELS[property.listingType]}
            </span>
          </div>

          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-brand-950 sm:text-5xl">
            {property.title}
          </h1>
          <p className="mt-3 flex items-start gap-2 text-base leading-7 text-ink-muted">
            <MapPin
              aria-hidden="true"
              className="mt-1 size-4.5 shrink-0 text-brand-cyan-ink"
            />
            <span>{location}</span>
          </p>
        </header>

        <div className="mt-6">
          <PropertyGallery key={property.id} property={property} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-2 space-y-6 lg:order-1">
            <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
                Descripción
              </h2>
              <p className="mt-3 whitespace-pre-line text-base leading-7 text-ink-muted">
                {property.description ||
                  'Esta captación todavía no tiene una descripción.'}
              </p>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
                Características
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric
                  icon={BedDouble}
                  label="Habitaciones"
                  value={property.bedrooms}
                />
                <Metric
                  icon={Bath}
                  label="Baños"
                  value={property.bathrooms}
                />
                <Metric
                  icon={CarFront}
                  label="Estacionamientos"
                  value={property.parkingSpaces}
                />
                <Metric
                  icon={Ruler}
                  label="Construcción"
                  value={formatArea(property.squareMeters)}
                />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line/70 pt-5 sm:grid-cols-3">
                <DetailField
                  label="Tipo"
                  value={PROPERTY_TYPE_LABELS[property.propertyType]}
                />
                <DetailField
                  label="Operación"
                  value={LISTING_TYPE_LABELS[property.listingType]}
                />
                <DetailField
                  label="Área del terreno"
                  value={formatArea(property.lotSquareMeters)}
                />
                <DetailField
                  label="Año de construcción"
                  value={property.yearBuilt ?? 'No indicado'}
                />
                <DetailField
                  label="Piso"
                  value={
                    property.apartmentFloor === null
                      ? 'No aplica'
                      : property.apartmentFloor
                  }
                />
                <DetailField
                  label="Moneda"
                  value={property.currency}
                />
              </dl>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
                Amenidades
              </h2>
              {activeAmenities.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {activeAmenities.map((amenity) => (
                    <li
                      key={amenity.key}
                      className="rounded-full border border-[#bfe5d2] bg-[#effaf4] px-3 py-1.5 text-sm font-medium text-[#176444]"
                    >
                      {amenity.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">
                  No se registraron amenidades adicionales.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
                Ubicación
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailField label="Dirección" value={property.address} />
                <DetailField
                  label="Zona / urbanización"
                  value={property.neighborhood || 'No indicada'}
                />
                <DetailField label="Ciudad" value={property.city} />
                <DetailField label="Estado" value={property.state} />
                <DetailField
                  label="Latitud"
                  value={property.latitude.toFixed(7)}
                />
                <DetailField
                  label="Longitud"
                  value={property.longitude.toFixed(7)}
                />
              </dl>

              <div className="mt-5">
                <PropertyLocationMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  title={property.title}
                />
              </div>

              <a
                href={getOpenStreetMapUrl(property)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg text-sm font-semibold text-brand-700 hover:text-brand-900"
              >
                <MapPin aria-hidden="true" className="size-4" />
                Abrir ubicación en OpenStreetMap
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </section>
          </div>

          <aside className="order-1 space-y-5 lg:order-2">
            <section className="rounded-2xl border border-line bg-white p-5 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] lg:sticky lg:top-24">
              <p className="text-sm font-semibold text-brand-slate">
                Precio de {LISTING_TYPE_LABELS[property.listingType].toLowerCase()}
              </p>
              <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950">
                {formatUsd(property.price)}
                {property.listingType === 'RENT' ? (
                  <span className="ml-1 text-sm font-medium text-ink-muted">
                    /mes
                  </span>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-surface px-2.5 py-1 font-medium text-ink-muted">
                  {property.isNegotiable ? 'Negociable' : 'Precio fijo'}
                </span>
                {property.maintenanceFee ? (
                  <span className="rounded-full bg-surface px-2.5 py-1 font-medium text-ink-muted">
                    Mantenimiento {formatUsd(property.maintenanceFee)}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 space-y-3 border-t border-line/70 pt-5">
                <div>
                  <p className="text-xs text-ink-muted">Propietario</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {property.ownerName}
                  </p>
                </div>
                <a
                  href={phoneHref}
                  className="flex min-h-12 items-center gap-2 rounded-lg text-sm font-semibold text-brand-700 hover:bg-surface hover:text-brand-900"
                >
                  <Phone aria-hidden="true" className="size-4" />
                  {property.ownerPhone}
                </a>
                {property.ownerEmail ? (
                  <a
                    href={`mailto:${property.ownerEmail}`}
                    className="flex min-h-12 items-center gap-2 break-all rounded-lg text-sm font-semibold text-brand-700 hover:bg-surface hover:text-brand-900"
                  >
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    {property.ownerEmail}
                  </a>
                ) : null}
              </div>

              {property.videoUrl || property.virtualTourUrl ? (
                <div className="mt-3 flex flex-wrap gap-3 border-t border-line/70 pt-4">
                  {property.videoUrl ? (
                    <a
                      href={property.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-brand-700"
                    >
                      Ver video
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : null}
                  {property.virtualTourUrl ? (
                    <a
                      href={property.virtualTourUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-brand-700"
                    >
                      Tour virtual
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-2">
                <UserRound
                  aria-hidden="true"
                  className="size-4 text-brand-slate"
                />
                <h2 className="font-display text-base font-semibold text-brand-950">
                  Seguimiento
                </h2>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Agente asignado</dt>
                  <dd className="mt-1 font-semibold text-ink">{agentName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Fecha de captación</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {formatLongDate(property.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Última actualización</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {formatShortDate(property.updatedAt)}
                  </dd>
                </div>
                {property.closedAt ? (
                  <div>
                    <dt className="text-xs text-ink-muted">Fecha de cierre</dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {formatLongDate(property.closedAt)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-4 flex items-start gap-2 border-t border-line/70 pt-4 text-xs leading-5 text-ink-muted">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-brand-cyan-ink"
                />
                La información del propietario solo está disponible para
                usuarios autenticados con acceso a esta captación.
              </p>
            </section>

            <div className="rounded-2xl border border-line/80 bg-white/65 p-4">
              <p className="flex items-center gap-2 text-xs leading-5 text-ink-muted">
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand-slate"
                />
                Código interno permanente. No incluye el año.
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-ink-muted">
                <Home
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand-slate"
                />
                {property.address}, {property.city}
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-ink-muted">
                <LandPlot
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand-slate"
                />
                Área de construcción: {formatArea(property.squareMeters)}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
