import { useFormContext } from 'react-hook-form'
import {
  LISTING_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../../property-labels'
import {
  LISTING_TYPES,
  PROPERTY_TYPES,
} from '../../property-filters'
import type { CreatePropertyFormValues } from '../create-property.schema'
import {
  CheckboxField,
  SelectField,
  TextField,
  TextareaField,
} from './form-controls'

const listingDescriptions = {
  SALE: 'Precio total de venta en USD.',
  RENT: 'Precio mensual de alquiler en USD.',
} as const

export function StepMainInfo() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreatePropertyFormValues>()

  const listingTypeError = errors.listingType?.message

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
          Datos principales
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          Define cómo se identificará la captación en el inventario.
        </p>

        <div className="mt-5 space-y-5">
          <TextField
            name="title"
            label="Título"
            required
            maxLength={200}
            placeholder="Casa familiar en El Viñedo"
            autoComplete="off"
          />

          <SelectField
            name="propertyType"
            label="Tipo de propiedad"
            required
            options={PROPERTY_TYPES.map((propertyType) => ({
              value: propertyType,
              label: PROPERTY_TYPE_LABELS[propertyType],
            }))}
          />

          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              Operación
              <span aria-hidden="true" className="ml-1 text-[#9a332b]">
                *
              </span>
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {LISTING_TYPES.map((listingType) => (
                <label
                  key={listingType}
                  className="relative cursor-pointer rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:border-[#b8cbd2] has-[:checked]:border-brand-700 has-[:checked]:bg-[#f2fafb]"
                >
                  <input
                    {...register('listingType')}
                    type="radio"
                    value={listingType}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-brand-950">
                    {LISTING_TYPE_LABELS[listingType]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                    {listingDescriptions[listingType]}
                  </span>
                </label>
              ))}
            </div>
            {listingTypeError ? (
              <p role="alert" className="mt-1.5 text-sm text-[#9a332b]">
                {listingTypeError}
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="price"
              label="Precio"
              required
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="150000"
              hint="USD"
            />
            <TextField
              name="maintenanceFee"
              label="Mantenimiento mensual"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="80"
              hint="Opcional, USD por mes."
            />
          </div>

          <CheckboxField
            name="isNegotiable"
            label="Precio negociable"
            description="Permite que el precio se muestre como negociable."
          />

          <TextareaField
            name="description"
            label="Descripción"
            maxLength={2000}
            rows={5}
            placeholder="Describe la propiedad, su estado y los detalles más relevantes."
            hint="Máximo 2.000 caracteres."
          />
        </div>
      </section>
    </div>
  )
}
