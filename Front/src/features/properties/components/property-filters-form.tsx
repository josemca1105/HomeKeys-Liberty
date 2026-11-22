import { RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  filtersToDraft,
  LISTING_TYPES,
  parseFilterDraft,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type PropertyFilterDraft,
} from '../property-filters'
import {
  LISTING_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from '../property-labels'
import type {
  AgentDirectoryEntry,
  PropertyFilters,
} from '../property.types'

interface PropertyFiltersFormProps {
  filters: PropertyFilters
  agents: AgentDirectoryEntry[]
  showAgentFilter: boolean
  isLoadingAgents?: boolean
  idPrefix: string
  onApply: (patch: Partial<PropertyFilters>) => void
  onClear: () => void
}

const fieldClassName =
  'mt-1.5 h-12 w-full rounded-lg border border-line bg-white px-3 text-base text-ink placeholder:text-[#93a5ad] hover:border-[#b8cbd2] focus:border-brand-600'

export function PropertyFiltersForm({
  filters,
  agents,
  showAgentFilter,
  isLoadingAgents = false,
  idPrefix,
  onApply,
  onClear,
}: PropertyFiltersFormProps) {
  const [draft, setDraft] = useState<PropertyFilterDraft>(() =>
    filtersToDraft(filters),
  )
  const [error, setError] = useState<string | null>(null)

  const updateField = (field: keyof PropertyFilterDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = parseFilterDraft(draft)

    if ('error' in result) {
      setError(result.error)
      return
    }

    onApply(result.patch)
  }

  const handleClear = () => {
    setDraft(filtersToDraft({ ...filters, page: 1 }))
    setError(null)
    onClear()
  }

  const fieldId = (field: string) => `${idPrefix}-${field}`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor={fieldId('code')}
          className="text-sm font-semibold text-ink"
        >
          Código
        </label>
        <input
          id={fieldId('code')}
          value={draft.code}
          onChange={(event) => updateField('code', event.target.value)}
          maxLength={22}
          placeholder="HK-0001"
          className={fieldClassName}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={fieldId('status')}
            className="text-sm font-semibold text-ink"
          >
            Estado
          </label>
          <select
            id={fieldId('status')}
            value={draft.status}
            onChange={(event) => updateField('status', event.target.value)}
            className={fieldClassName}
          >
            <option value="">Todos</option>
            {PROPERTY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROPERTY_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={fieldId('listingType')}
            className="text-sm font-semibold text-ink"
          >
            Operación
          </label>
          <select
            id={fieldId('listingType')}
            value={draft.listingType}
            onChange={(event) =>
              updateField('listingType', event.target.value)
            }
            className={fieldClassName}
          >
            <option value="">Todas</option>
            {LISTING_TYPES.map((listingType) => (
              <option key={listingType} value={listingType}>
                {LISTING_TYPE_LABELS[listingType]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor={fieldId('propertyType')}
          className="text-sm font-semibold text-ink"
        >
          Tipo de propiedad
        </label>
        <select
          id={fieldId('propertyType')}
          value={draft.propertyType}
          onChange={(event) => updateField('propertyType', event.target.value)}
          className={fieldClassName}
        >
          <option value="">Todos</option>
          {PROPERTY_TYPES.map((propertyType) => (
            <option key={propertyType} value={propertyType}>
              {PROPERTY_TYPE_LABELS[propertyType]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={fieldId('state')}
            className="text-sm font-semibold text-ink"
          >
            Estado / región
          </label>
          <input
            id={fieldId('state')}
            value={draft.state}
            onChange={(event) => updateField('state', event.target.value)}
            maxLength={100}
            placeholder="Carabobo"
            className={fieldClassName}
          />
        </div>
        <div>
          <label
            htmlFor={fieldId('city')}
            className="text-sm font-semibold text-ink"
          >
            Ciudad
          </label>
          <input
            id={fieldId('city')}
            value={draft.city}
            onChange={(event) => updateField('city', event.target.value)}
            maxLength={100}
            placeholder="Valencia"
            className={fieldClassName}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={fieldId('neighborhood')}
          className="text-sm font-semibold text-ink"
        >
          Zona / urbanización
        </label>
        <input
          id={fieldId('neighborhood')}
          value={draft.neighborhood}
          onChange={(event) =>
            updateField('neighborhood', event.target.value)
          }
          maxLength={100}
          placeholder="El Viñedo"
          className={fieldClassName}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={fieldId('priceMin')}
            className="text-sm font-semibold text-ink"
          >
            Precio mínimo
          </label>
          <input
            id={fieldId('priceMin')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={draft.priceMin}
            onChange={(event) => updateField('priceMin', event.target.value)}
            placeholder="USD"
            className={fieldClassName}
          />
        </div>
        <div>
          <label
            htmlFor={fieldId('priceMax')}
            className="text-sm font-semibold text-ink"
          >
            Precio máximo
          </label>
          <input
            id={fieldId('priceMax')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={draft.priceMax}
            onChange={(event) => updateField('priceMax', event.target.value)}
            placeholder="USD"
            className={fieldClassName}
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">
          Mínimos requeridos
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <label
              htmlFor={fieldId('bedroomsMin')}
              className="text-xs text-ink-muted"
            >
              Habitaciones
            </label>
            <input
              id={fieldId('bedroomsMin')}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={draft.bedroomsMin}
              onChange={(event) =>
                updateField('bedroomsMin', event.target.value)
              }
              className={fieldClassName}
            />
          </div>
          <div>
            <label
              htmlFor={fieldId('bathroomsMin')}
              className="text-xs text-ink-muted"
            >
              Baños
            </label>
            <input
              id={fieldId('bathroomsMin')}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={draft.bathroomsMin}
              onChange={(event) =>
                updateField('bathroomsMin', event.target.value)
              }
              className={fieldClassName}
            />
          </div>
          <div>
            <label
              htmlFor={fieldId('parkingSpacesMin')}
              className="text-xs text-ink-muted"
            >
              Puestos
            </label>
            <input
              id={fieldId('parkingSpacesMin')}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={draft.parkingSpacesMin}
              onChange={(event) =>
                updateField('parkingSpacesMin', event.target.value)
              }
              className={fieldClassName}
            />
          </div>
        </div>
      </fieldset>

      {showAgentFilter ? (
        <div>
          <label
            htmlFor={fieldId('agentId')}
            className="text-sm font-semibold text-ink"
          >
            Agente
          </label>
          <select
            id={fieldId('agentId')}
            value={draft.agentId}
            onChange={(event) => updateField('agentId', event.target.value)}
            disabled={isLoadingAgents}
            className={fieldClassName}
          >
            <option value="">
              {isLoadingAgents ? 'Cargando agentes…' : 'Todos los agentes'}
            </option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.firstName} {agent.lastName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-[#9a332b]">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 border-t border-line/70 pt-4">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={handleClear}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Limpiar
        </Button>
        <Button type="submit" fullWidth>
          Aplicar
        </Button>
      </div>
    </form>
  )
}
