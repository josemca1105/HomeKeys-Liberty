import { useFormContext } from 'react-hook-form'
import type { EditPropertyFormValues } from '../edit-property.schema'

interface AgentOption {
  value: string
  label: string
}

interface AgentFieldProps {
  options: AgentOption[]
  isLoading: boolean
}

export function AgentField({ options, isLoading }: AgentFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<EditPropertyFormValues>()
  const error = errors.agentId?.message
  const errorId = error ? 'edit-agentId-error' : undefined

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
        Asignación
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink-muted">
        Solo un administrador puede reasignar esta captación.
      </p>

      <div className="mt-5 max-w-md">
        <label
          htmlFor="edit-agentId"
          className="text-sm font-semibold text-ink"
        >
          Agente asignado
          <span aria-hidden="true" className="ml-1 text-[#9a332b]">
            *
          </span>
        </label>
        <select
          {...register('agentId')}
          id="edit-agentId"
          aria-required="true"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink transition-colors hover:border-[#b8cbd2] focus:border-brand-600"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-1.5 text-sm text-[#9a332b]"
          >
            {error}
          </p>
        ) : (
          <p className="mt-1.5 text-xs leading-5 text-ink-muted">
            {isLoading
              ? 'Cargando agentes activos…'
              : 'Al reasignar, el agente anterior perderá acceso a esta captación.'}
          </p>
        )}
      </div>
    </section>
  )
}
