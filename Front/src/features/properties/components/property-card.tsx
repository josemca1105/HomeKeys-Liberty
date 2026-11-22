import {
  Bath,
  BedDouble,
  Building2,
  CarFront,
  MapPin,
  Ruler,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router'
import { AuthenticatedImage } from '@/components/images/authenticated-image'
import {
  formatArea,
  formatUsd,
  getCoverPhoto,
  getPropertyLocation,
  LISTING_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../property-labels'
import type { Property } from '../property.types'
import { PropertyStatusBadge } from './property-status-badge'

interface PropertyCardProps {
  property: Property
  agentName?: string
}

export function PropertyCard({ property, agentName }: PropertyCardProps) {
  const coverPhoto = getCoverPhoto(property)
  const location = getPropertyLocation(property)

  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_45px_-40px_rgb(8_39_63/0.5)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-600/30 hover:shadow-[0_24px_55px_-38px_rgb(8_39_63/0.55)]">
      <Link
        to={`/captaciones/${property.id}`}
        aria-label={`Ver captación ${property.code}: ${property.title}`}
        className="flex h-full flex-col rounded-2xl focus-visible:outline-offset-[-3px]"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-surface">
          {coverPhoto ? (
            <AuthenticatedImage
              src={coverPhoto.url}
              alt={
                coverPhoto.altText ||
                `Fotografía de ${property.title}`
              }
              className="size-full transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-brand-950/[0.06] to-brand-cyan/10 text-brand-slate/60">
              <Building2 aria-hidden="true" className="size-8" />
            </div>
          )}

          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <PropertyStatusBadge
              status={property.status}
              className="shadow-sm backdrop-blur"
            />
            <span className="rounded-full bg-brand-950/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              {LISTING_TYPE_LABELS[property.listingType]}
            </span>
          </div>

          <span className="absolute bottom-3 left-3 rounded-lg bg-white/92 px-2.5 py-1 text-xs font-bold tracking-wide text-brand-900 shadow-sm backdrop-blur">
            {property.code}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <p className="text-xs font-semibold text-brand-slate">
            {PROPERTY_TYPE_LABELS[property.propertyType]}
          </p>
          <h2 className="mt-1.5 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-brand-950">
            {property.title}
          </h2>
          <p className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-ink-muted">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-brand-cyan-ink"
            />
            <span className="line-clamp-2">{location}</span>
          </p>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-display text-xl font-semibold tracking-[-0.03em] text-brand-900">
                {formatUsd(property.price)}
                {property.listingType === 'RENT' ? (
                  <span className="ml-1 text-xs font-medium text-ink-muted">
                    /mes
                  </span>
                ) : null}
              </p>
              {property.isNegotiable ? (
                <p className="mt-0.5 text-xs font-medium text-brand-cyan-ink">
                  Precio negociable
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line/70 pt-4 text-xs text-ink-muted">
            <span
              className="flex items-center gap-1.5 whitespace-nowrap"
              aria-label={`${property.bedrooms} habitaciones`}
            >
              <BedDouble aria-hidden="true" className="size-4 text-brand-slate" />
              {property.bedrooms}
            </span>
            <span
              className="flex items-center gap-1.5 whitespace-nowrap"
              aria-label={`${property.bathrooms} baños`}
            >
              <Bath aria-hidden="true" className="size-4 text-brand-slate" />
              {property.bathrooms}
            </span>
            <span
              className="flex items-center gap-1.5 whitespace-nowrap"
              aria-label={`${property.parkingSpaces} estacionamientos`}
            >
              <CarFront aria-hidden="true" className="size-4 text-brand-slate" />
              {property.parkingSpaces}
            </span>
            <span
              className="flex items-center gap-1.5 whitespace-nowrap"
              aria-label={`${formatArea(property.squareMeters)} de construcción`}
            >
              <Ruler aria-hidden="true" className="size-4 text-brand-slate" />
              {formatArea(property.squareMeters)}
            </span>
          </div>

          {agentName ? (
            <div className="mt-auto pt-3">
              <p className="flex items-center gap-1.5 border-t border-line/70 pt-3 text-xs text-ink-muted">
                <UserRound aria-hidden="true" className="size-3.5" />
                {agentName}
              </p>
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  )
}
