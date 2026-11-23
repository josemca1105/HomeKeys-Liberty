import {
  Building2,
  FilterX,
  Plus,
  RefreshCw,
  SearchX,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import { PropertyCard } from '../components/property-card'
import { PropertyCardSkeleton } from '../components/property-card-skeleton'
import { PropertyFiltersDialog } from '../components/property-filters-dialog'
import { PropertyFiltersForm } from '../components/property-filters-form'
import { PropertyPagination } from '../components/property-pagination'
import { PropertySearch } from '../components/property-search'
import {
  countAdvancedPropertyFilters,
  getSortValue,
  hasPropertyFilters,
  parsePropertyFilters,
  parseSortValue,
  serializePropertyFilters,
  SORT_OPTIONS,
} from '../property-filters'
import { getAgentDisplayName } from '../property-labels'
import {
  toAgentDirectory,
  useAgentDirectoryQuery,
  usePropertiesQuery,
} from '../property-queries'
import type { PropertyFilters } from '../property.types'

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <PropertyCardSkeleton key={index} />
      ))}
    </div>
  )
}

function filterFormKey(filters: PropertyFilters): string {
  return JSON.stringify({
    code: filters.code,
    status: filters.status,
    propertyType: filters.propertyType,
    listingType: filters.listingType,
    state: filters.state,
    city: filters.city,
    neighborhood: filters.neighborhood,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    bedroomsMin: filters.bedroomsMin,
    bathroomsMin: filters.bathroomsMin,
    parkingSpacesMin: filters.parkingSpacesMin,
    agentId: filters.agentId,
  })
}

export function PropertiesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterKey = searchParams.toString()
  const filters = useMemo(
    () => parsePropertyFilters(new URLSearchParams(filterKey)),
    [filterKey],
  )
  const isAdmin = user?.role === 'ADMIN'
  const effectiveFilters = useMemo<PropertyFilters>(() => {
    if (isAdmin) {
      return filters
    }

    const { agentId: _agentId, ...partnerFilters } = filters

    return partnerFilters
  }, [filters, isAdmin])

  const propertiesQuery = usePropertiesQuery(effectiveFilters)
  const agentsQuery = useAgentDirectoryQuery(isAdmin)
  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data])
  const agentDirectory = useMemo(
    () => toAgentDirectory(agents),
    [agents],
  )
  const currentUserName = user ? `${user.firstName} ${user.lastName}` : ''

  useEffect(() => {
    document.title = 'Captaciones | HomeKeys Liberty'
  }, [])

  const updateFilters = (
    patch: Partial<PropertyFilters>,
    options: { resetPage?: boolean } = {},
  ) => {
    const nextFilters: PropertyFilters = {
      ...filters,
      ...patch,
      ...(options.resetPage === false ? {} : { page: 1 }),
    }

    if (!isAdmin) {
      delete nextFilters.agentId
    }

    setSearchParams(serializePropertyFilters(nextFilters), {
      replace: true,
    })
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const applyFilterPatch = (patch: Partial<PropertyFilters>) => {
    updateFilters(patch)
  }

  const handleSortChange = (value: string) => {
    const parsedSort = parseSortValue(value)

    if (parsedSort) {
      updateFilters(parsedSort)
    }
  }

  const handlePageChange = (page: number) => {
    updateFilters({ page }, { resetPage: false })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  if (!user) {
    return null
  }

  const data = propertiesQuery.data
  const pagination = data?.pagination
  const filtersActive = hasPropertyFilters(filters)
  const advancedFilterCount = countAdvancedPropertyFilters(effectiveFilters)
  const queryError = propertiesQuery.isError
    ? normalizeApiError(propertiesQuery.error)
    : null
  const hasResults = Boolean(
    !propertiesQuery.isError && data && data.properties.length > 0,
  )
  const showInitialLoading =
    propertiesQuery.isPending && !propertiesQuery.isError

  return (
    <AppShell pageTitle="Captaciones">
      <div className="mx-auto max-w-[1320px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-slate">
              Inventario inmobiliario
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-5xl">
              Captaciones
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
              {isAdmin
                ? 'Consulta todas las captaciones del equipo y filtra por agente, ubicación o estado.'
                : 'Consulta las captaciones que tienes asignadas y encuentra cada propiedad rápidamente.'}
            </p>
          </div>

          <Link
            to="/captaciones/nueva"
            className={cn(buttonVariants(), 'w-full shrink-0 sm:w-auto')}
          >
            <Plus aria-hidden="true" className="size-4" />
            Nueva captación
          </Link>
        </header>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <PropertySearch
            key={filters.search ?? 'all-properties'}
            initialValue={filters.search ?? ''}
            onSearch={(search) =>
              updateFilters({ search: search || undefined })
            }
          />

          <div className="flex min-w-0 gap-2 sm:flex-1 lg:flex-none">
            <div className="min-w-0 flex-1">
              <label htmlFor="property-sort" className="sr-only">
                Ordenar captaciones
              </label>
              <select
                id="property-sort"
                value={getSortValue(filters)}
                onChange={(event) => handleSortChange(event.target.value)}
                className="h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-brand-900 hover:border-[#b8cbd2] focus:border-brand-600"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:hidden">
              <PropertyFiltersDialog
                filters={filters}
                agents={agents}
                showAgentFilter={isAdmin}
                isLoadingAgents={isAdmin && agentsQuery.isPending}
                activeFilterCount={advancedFilterCount}
                onApply={applyFilterPatch}
                onClear={clearAllFilters}
              />
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-line bg-white p-5 shadow-[0_18px_45px_-42px_rgb(8_39_63/0.45)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-brand-950">
                  Filtros
                </h2>
                {advancedFilterCount > 0 ? (
                  <span className="grid min-w-6 place-items-center rounded-full bg-brand-700 px-1.5 py-0.5 text-xs font-bold text-white">
                    {advancedFilterCount}
                  </span>
                ) : null}
              </div>

              <div className="mt-5">
                <PropertyFiltersForm
                  key={filterFormKey(filters)}
                  filters={filters}
                  agents={agents}
                  showAgentFilter={isAdmin}
                  isLoadingAgents={isAdmin && agentsQuery.isPending}
                  idPrefix="desktop-filters"
                  onApply={applyFilterPatch}
                  onClear={clearAllFilters}
                />
              </div>
            </div>
          </aside>

          <section
            aria-label="Resultados de captaciones"
            aria-busy={propertiesQuery.isFetching}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted" aria-live="polite">
                {pagination ? (
                  <>
                    <span className="font-semibold text-ink">
                      {pagination.total}
                    </span>{' '}
                    {pagination.total === 1
                      ? 'captación encontrada'
                      : 'captaciones encontradas'}
                  </>
                ) : (
                  'Cargando captaciones…'
                )}
              </p>

              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-white"
                >
                  <FilterX aria-hidden="true" className="size-4" />
                  Limpiar filtros
                </button>
              ) : null}
            </div>

            <div className="mt-4">
              {showInitialLoading ? <ResultsSkeleton /> : null}

              {queryError ? (
                <div className="rounded-2xl border border-[#e7b2ae] bg-[#fff7f6] p-6 text-center">
                  <SearchX
                    aria-hidden="true"
                    className="mx-auto size-8 text-[#9a332b]"
                  />
                  <h2 className="mt-3 font-display text-xl font-semibold text-brand-950">
                    No pudimos cargar las captaciones
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
                    {queryError.message}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-5"
                    onClick={() => void propertiesQuery.refetch()}
                  >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Reintentar
                  </Button>
                </div>
              ) : null}

              {!showInitialLoading && !queryError && !hasResults ? (
                <div className="rounded-2xl border border-dashed border-[#b9cbd2] bg-white/75 px-6 py-14 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-brand-slate">
                    <Building2 aria-hidden="true" className="size-6" />
                  </span>
                  <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-brand-950">
                    {filtersActive
                      ? 'No encontramos captaciones'
                      : 'Aún no hay captaciones registradas'}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
                    {filtersActive
                      ? 'Prueba con otros filtros o limpia la búsqueda para ver más resultados.'
                      : 'Las captaciones aparecerán aquí cuando el equipo comience a registrarlas.'}
                  </p>
                  {filtersActive ? (
                    <Button
                      variant="secondary"
                      className="mt-5"
                      onClick={clearAllFilters}
                    >
                      Limpiar filtros
                    </Button>
                  ) : (
                    <Link
                      to="/captaciones/nueva"
                      className={cn(buttonVariants(), 'mt-5')}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      Nueva captación
                    </Link>
                  )}
                </div>
              ) : null}

              {hasResults && data ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {data.properties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        agentName={getAgentDisplayName(
                          property.agentId,
                          user.id,
                          currentUserName,
                          agentDirectory,
                        )}
                      />
                    ))}
                  </div>

                  <PropertyPagination
                    page={pagination?.page ?? 1}
                    totalPages={pagination?.totalPages ?? 0}
                    onPageChange={handlePageChange}
                  />
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
