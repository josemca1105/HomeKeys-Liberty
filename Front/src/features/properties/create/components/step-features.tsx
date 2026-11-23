import { AMENITIES } from '../../property-labels'
import {
  CheckboxField,
  TextField,
} from './form-controls'

type AmenityFieldName =
  | 'hasWaterTank'
  | 'hasPowerPlant'
  | 'isFurnished'
  | 'allowsPets'
  | 'hasPool'
  | 'hasGym'
  | 'hasBalcony'
  | 'hasAirConditioning'
  | 'hasSecurity'
  | 'hasElevator'

const amenityFields: Array<{
  name: AmenityFieldName
  label: string
}> = AMENITIES.map((amenity) => ({
  name: amenity.key as AmenityFieldName,
  label: amenity.label,
}))

export function StepFeatures() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
          Distribución y áreas
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          Estos valores ayudarán a filtrar y comparar las captaciones.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            name="bedrooms"
            label="Habitaciones"
            required
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="3"
          />
          <TextField
            name="bathrooms"
            label="Baños"
            required
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="2"
          />
          <TextField
            name="parkingSpaces"
            label="Estacionamientos"
            required
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="2"
          />
          <TextField
            name="squareMeters"
            label="Área de construcción"
            required
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="120"
            hint="Metros cuadrados."
          />
          <TextField
            name="lotSquareMeters"
            label="Área del terreno"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="200"
            hint="Opcional, en metros cuadrados."
          />
          <TextField
            name="yearBuilt"
            label="Año de construcción"
            type="number"
            inputMode="numeric"
            min={1800}
            step={1}
            placeholder="2018"
          />
          <TextField
            name="apartmentFloor"
            label="Piso"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="4"
            hint="Opcional. Aplica principalmente a apartamentos y oficinas."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
          Amenidades
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          Marca las características adicionales que ofrece la propiedad.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {amenityFields.map((amenity) => (
            <CheckboxField
              key={amenity.name}
              name={amenity.name}
              label={amenity.label}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
          Recursos adicionales
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          Enlaces opcionales para ampliar la presentación de la propiedad.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            name="videoUrl"
            label="Video"
            type="url"
            inputMode="url"
            placeholder="https://..."
            hint="Debe ser una URL http o https."
          />
          <TextField
            name="virtualTourUrl"
            label="Tour virtual"
            type="url"
            inputMode="url"
            placeholder="https://..."
            hint="Debe ser una URL http o https."
          />
        </div>
      </section>
    </div>
  )
}
