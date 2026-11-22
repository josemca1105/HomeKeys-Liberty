import * as Dialog from '@radix-ui/react-dialog'
import { Filter, X } from 'lucide-react'
import { useState } from 'react'
import type {
  AgentDirectoryEntry,
  PropertyFilters,
} from '../property.types'
import { PropertyFiltersForm } from './property-filters-form'

interface PropertyFiltersDialogProps {
  filters: PropertyFilters
  agents: AgentDirectoryEntry[]
  showAgentFilter: boolean
  isLoadingAgents: boolean
  activeFilterCount: number
  onApply: (patch: Partial<PropertyFilters>) => void
  onClear: () => void
}

export function PropertyFiltersDialog({
  filters,
  agents,
  showAgentFilter,
  isLoadingAgents,
  activeFilterCount,
  onApply,
  onClear,
}: PropertyFiltersDialogProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-600/40 hover:bg-surface"
        >
          <Filter aria-hidden="true" className="size-4" />
          Filtros
          {activeFilterCount > 0 ? (
            <span className="grid size-5 place-items-center rounded-full bg-brand-700 text-[11px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-25px_70px_-35px_rgb(8_39_63/0.5)] focus:outline-none">
          <div className="sticky top-0 z-10 -mx-5 flex items-start justify-between gap-4 bg-white px-5 pb-3">
            <div>
              <Dialog.Title className="font-display text-2xl font-semibold tracking-[-0.03em] text-brand-950">
                Filtrar captaciones
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-6 text-ink-muted">
                Ajusta la búsqueda y aplica los cambios.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar filtros"
                className="-mr-2 -mt-1 grid size-12 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-surface hover:text-brand-900"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6">
            <PropertyFiltersForm
              filters={filters}
              agents={agents}
              showAgentFilter={showAgentFilter}
              isLoadingAgents={isLoadingAgents}
              idPrefix="mobile-filters"
              onApply={(patch) => {
                onApply(patch)
                setIsOpen(false)
              }}
              onClear={() => {
                onClear()
                setIsOpen(false)
              }}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
