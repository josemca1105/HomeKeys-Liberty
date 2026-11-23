import { useFormContext } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CreatePropertyFormValues } from '../create-property.schema'
import {
  AMENITIES,
  formatArea,
  formatUsd,
  LISTING_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../property-labels'
import type { PhotoUploadController } from '../use-photo-upload'

interface StepReviewProps {
  photoUpload: PhotoUploadController
  agentName: string
  onEditStep: (step: number) => void
}

function ReviewValue({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink">
        {value}
      </dd>
    </div>
  )
}

function ReviewSection({
  title,
  step,
  onEditStep,
  children,
}: {
  title: string
  step: number
  onEditStep: (step: number) => void
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => onEditStep(step)}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-surface hover:text-brand-900"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editar
        </button>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function StepReview({
  photoUpload,
  agentName,
  onEditStep,
}: StepReviewProps) {
  const { watch } = useFormContext<CreatePropertyFormValues>()
  const values = watch()
  const activeAmenities = AMENITIES.filter((amenity) =>
    Boolean(values[amenity.key]),
  )
  const coverPhoto =
    photoUpload.readyPhotos.find(
      (photo) => photo.uploadId === photoUpload.coverUploadId,
    ) ?? photoUpload.readyPhotos[0]

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-cyan/30 bg-[#f1fafc] px-4 py-3 text-sm leading-6 text-brand-cyan-ink">
        Revisa la información antes de crear la captación. Podrás editarla
        después desde el detalle.
      </div>

      <ReviewSection title="Datos principales" step={1} onEditStep={onEditStep}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReviewValue label="Título" value={values.title} />
          <ReviewValue
            label="Tipo"
            value={PROPERTY_TYPE_LABELS[values.propertyType]}
          />
          <ReviewValue
            label="Operación"
            value={LISTING_TYPE_LABELS[values.listingType]}
          />
          <ReviewValue label="Precio" value={formatUsd(values.price)} />
          <ReviewValue label="Agente" value={agentName} />
          <ReviewValue
            label="Negociable"
            value={values.isNegotiable ? 'Sí' : 'No'}
          />
          <ReviewValue
            label="Mantenimiento"
            value={
              values.maintenanceFee
                ? formatUsd(values.maintenanceFee)
                : 'No indicado'
            }
          />
          <div className="sm:col-span-2">
            <ReviewValue
              label="Descripción"
              value={values.description || 'Sin descripción'}
            />
          </div>
        </dl>
      </ReviewSection>

      <ReviewSection
        title="Propietario y ubicación"
        step={2}
        onEditStep={onEditStep}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReviewValue label="Propietario" value={values.ownerName} />
          <ReviewValue label="Teléfono" value={values.ownerPhone} />
          <ReviewValue
            label="Correo"
            value={values.ownerEmail || 'No indicado'}
          />
          <ReviewValue
            label="Zona"
            value={values.neighborhood || 'No indicada'}
          />
          <div className="sm:col-span-2">
            <ReviewValue label="Dirección" value={values.address} />
          </div>
          <ReviewValue label="Ciudad" value={values.city} />
          <ReviewValue label="Estado" value={values.state} />
          <ReviewValue
            label="Latitud"
            value={Number(values.latitude).toFixed(7)}
          />
          <ReviewValue
            label="Longitud"
            value={Number(values.longitude).toFixed(7)}
          />
        </dl>
      </ReviewSection>

      <ReviewSection title="Características" step={3} onEditStep={onEditStep}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ReviewValue label="Habitaciones" value={values.bedrooms} />
          <ReviewValue label="Baños" value={values.bathrooms} />
          <ReviewValue label="Puestos" value={values.parkingSpaces} />
          <ReviewValue
            label="Construcción"
            value={formatArea(values.squareMeters)}
          />
          <ReviewValue
            label="Terreno"
            value={
              values.lotSquareMeters
                ? formatArea(values.lotSquareMeters)
                : 'No indicado'
            }
          />
          <ReviewValue
            label="Año"
            value={values.yearBuilt || 'No indicado'}
          />
          <ReviewValue
            label="Piso"
            value={values.apartmentFloor || 'No aplica'}
          />
        </dl>

        <div className="mt-5 border-t border-line/70 pt-4">
          <p className="text-xs text-ink-muted">Amenidades</p>
          {activeAmenities.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {activeAmenities.map((amenity) => (
                <li
                  key={amenity.key}
                  className="rounded-full bg-[#effaf4] px-2.5 py-1 text-xs font-medium text-[#176444]"
                >
                  {amenity.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">
              No se marcaron amenidades adicionales.
            </p>
          )}
        </div>
      </ReviewSection>

      <ReviewSection title="Fotografías" step={4} onEditStep={onEditStep}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {coverPhoto ? (
            <img
              src={coverPhoto.previewUrl}
              alt={`Portada: ${coverPhoto.file.name}`}
              className="h-28 w-full rounded-xl object-cover sm:w-40"
            />
          ) : null}
          <div>
            <p className="font-display text-lg font-semibold text-brand-950">
              {photoUpload.readyPhotos.length} fotografías listas
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              La portada seleccionada se muestra como imagen principal.
            </p>
          </div>
        </div>
      </ReviewSection>
    </div>
  )
}
