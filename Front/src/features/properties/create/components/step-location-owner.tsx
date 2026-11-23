import { useFormContext } from 'react-hook-form'
import { MapPin, UserRound } from 'lucide-react'
import { PropertyLocationPicker } from '../../map/property-location-picker'
import type { CreatePropertyFormValues } from '../create-property.schema'
import { TextField } from './form-controls'

export function StepLocationOwner() {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreatePropertyFormValues>()
  const latitude = watch('latitude')
  const longitude = watch('longitude')

  const coordinateError =
    errors.latitude?.message ??
    errors.longitude?.message ??
    undefined

  const handleCoordinatesChange = (coordinates: {
    latitude: number
    longitude: number
  }) => {
    setValue('latitude', coordinates.latitude.toFixed(7), {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue('longitude', coordinates.longitude.toFixed(7), {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand-slate">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
              Propietario
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Datos de contacto del propietario de la captación.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            name="ownerName"
            label="Nombre completo"
            required
            maxLength={150}
            autoComplete="off"
            placeholder="Nombre del propietario"
          />
          <TextField
            name="ownerPhone"
            label="Teléfono"
            required
            type="tel"
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="0414-1234567"
          />
          <div className="sm:col-span-2">
            <TextField
              name="ownerEmail"
              label="Correo electrónico"
              type="email"
              inputMode="email"
              maxLength={255}
              autoComplete="email"
              placeholder="propietario@correo.com"
              hint="Opcional."
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand-slate">
            <MapPin aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
              Ubicación
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Ajusta la dirección y marca la ubicación exacta en el mapa.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              name="address"
              label="Dirección"
              required
              maxLength={500}
              autoComplete="street-address"
              placeholder="Av. Principal, edificio o casa"
            />
          </div>
          <TextField
            name="neighborhood"
            label="Zona o urbanización"
            maxLength={100}
            autoComplete="address-line2"
            placeholder="El Viñedo"
          />
          <TextField
            name="city"
            label="Ciudad"
            required
            maxLength={100}
            autoComplete="address-level2"
            placeholder="Valencia"
          />
          <div className="sm:col-span-2">
            <TextField
              name="state"
              label="Estado"
              required
              maxLength={100}
              autoComplete="address-level1"
              placeholder="Carabobo"
            />
          </div>
        </div>

        <div className="mt-5 border-t border-line/70 pt-5">
          <PropertyLocationPicker
            initialLatitude={Number(latitude)}
            initialLongitude={Number(longitude)}
            onChange={handleCoordinatesChange}
            error={coordinateError}
          />
        </div>
      </section>
    </div>
  )
}
