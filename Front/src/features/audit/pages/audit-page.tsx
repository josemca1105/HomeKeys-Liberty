import {
  ChevronDown,
  ChevronRight,
  FilterX,
  RefreshCw,
  ScrollText,
  SearchX,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { USER_ROLE_LABELS } from '@/features/users/user-labels'
import { cn } from '@/lib/cn'
import {
  AUDIT_SCOPES,
  hasAuditFilters,
  parseAuditFilters,
  serializeAuditFilters,
} from '../audit-filters'
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_TYPE_OPTIONS,
  AUDIT_SCOPE_LABELS,
  formatAuditChangeValue,
  formatAuditTimestamp,
  getAuditActionLabel,
  getAuditEntityRoute,
} from '../audit-labels'
import { useAuditLogsQuery } from '../audit-queries'
import type { AuditLog, AuditLogFilters } from '../audit.types'
import { AuditPagination } from '../components/audit-pagination'

const selectClassName =
  'h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-brand-900 hover:border-[#b8cbd2] focus:border-brand-600'

const tableHeaderClassName =
  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-brand-slate'

function AuditTableSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-line bg-white"
      aria-busy="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="border-b border-line/70 p-4 last:border-0">
          <div className="h-4 w-56 animate-pulse rounded bg-surface" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-surface" />
        </div>
      ))}
    </div>
  )
}

function ScopeBadge({ scope }: { scope: AuditLog['scope'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        scope === 'SECURITY'
          ? 'border-[#f2dcae] bg-[#fff7dc] text-[#725b0a]'
          : 'border-brand-cyan/30 bg-[#eaf9fc] text-brand-cyan-ink',
      )}
    >
      {AUDIT_SCOPE_LABELS[scope]}
    </span>
  )
}

function AuditChanges({
  changes,
}: {
  changes: NonNullable<AuditLog['changes']>
}) {
  const entries = Object.entries(changes)

  if (entries.length === 0) {
    return (
      <p className="text-sm leading-6 text-ink-muted">
        El evento no registró cambios detallados.
      </p>
    )
  }

  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs text-ink-muted">{key}</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold text-ink">
            {formatAuditChangeValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function AuditDetailsRow({ log }: { log: AuditLog }) {
  const contextRows: Array<{ label: string; value: string }> = [
    {
      label: 'Actor',
      value: log.actorEmail ?? 'Sistema',
    },
    {
      label: 'Rol del actor',
      value: log.actorRole ? USER_ROLE_LABELS[log.actorRole] : '—',
    },
    { label: 'IP', value: log.ip ?? '—' },
    { label: 'Navegador', value: log.userAgent ?? '—' },
    { label: 'ID de solicitud', value: log.requestId ?? '—' },
  ]

  return (
    <tr className="border-b border-line/60 bg-surface/50 last:border-0">
      <td colSpan={5} className="px-4 py-4">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate">
              Cambios
            </p>
            <div className="mt-3">
              {log.changes ? (
                <AuditChanges changes={log.changes} />
              ) : (
                <p className="text-sm leading-6 text-ink-muted">
                  El evento no registró cambios detallados.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate">
              Contexto
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {contextRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <dt className="w-32 shrink-0 text-ink-muted">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 break-words font-semibold text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </td>
    </tr>
  )
}

export function AuditPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterKey = searchParams.toString()
  const filters = useMemo(
    () => parseAuditFilters(new URLSearchParams(filterKey)),
    [filterKey],
  )
  const logsQuery = useAuditLogsQuery(filters)
  const [expandedIds, setExpandedIds] = useState<number[]>([])
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    document.title = 'Auditoría | HomeKeys Liberty'
  }, [])

  const updateFilters = (
    patch: Partial<AuditLogFilters>,
    options: { resetPage?: boolean } = {},
  ) => {
    const nextFilters: AuditLogFilters = {
      ...filters,
      ...patch,
      ...(options.resetPage === false ? {} : { page: 1 }),
    }

    setSearchParams(serializeAuditFilters(nextFilters), { replace: true })
  }

  const handlePageChange = (page: number) => {
    updateFilters({ page }, { resetPage: false })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const toggleExpanded = (logId: number) => {
    setExpandedIds((previous) =>
      previous.includes(logId)
        ? previous.filter((id) => id !== logId)
        : [...previous, logId],
    )
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const data = logsQuery.data
  const pagination = data?.pagination
  const filtersActive = hasAuditFilters(filters)
  const queryError = logsQuery.isError
    ? normalizeApiError(logsQuery.error)
    : null
  const hasResults = Boolean(
    !logsQuery.isError && data && data.logs.length > 0,
  )
  const showInitialLoading = logsQuery.isPending && !logsQuery.isError

  return (
    <AppShell pageTitle="Auditoría">
      <div className="mx-auto max-w-[1180px]">
        <header>
          <p className="text-sm font-semibold text-brand-slate">
            Historial del sistema
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-5xl">
            Auditoría
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            {isAdmin
              ? 'Cada acción del equipo queda registrada aquí: accesos, cambios de usuarios y movimientos de captaciones.'
              : 'Tu actividad queda registrada aquí: accesos y cambios en tus captaciones.'}
          </p>
        </header>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-36">
            <label htmlFor="audit-scope-filter" className="sr-only">
              Alcance
            </label>
            <select
              id="audit-scope-filter"
              value={filters.scope ?? ''}
              onChange={(event) =>
                updateFilters({
                  scope: event.target.value
                    ? (event.target.value as AuditLogFilters['scope'])
                    : undefined,
                })
              }
              className={selectClassName}
            >
              <option value="">Todos los alcances</option>
              {AUDIT_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {AUDIT_SCOPE_LABELS[scope]}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-44 flex-1 sm:max-w-56">
            <label htmlFor="audit-action-filter" className="sr-only">
              Acción
            </label>
            <select
              id="audit-action-filter"
              value={filters.action ?? ''}
              onChange={(event) =>
                updateFilters({
                  action: event.target.value || undefined,
                })
              }
              className={selectClassName}
            >
              <option value="">Todas las acciones</option>
              {AUDIT_ACTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.actions.map((action) => (
                    <option key={action} value={action}>
                      {getAuditActionLabel(action)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label htmlFor="audit-entity-type-filter" className="sr-only">
              Tipo de entidad
            </label>
            <select
              id="audit-entity-type-filter"
              value={filters.entityType ?? ''}
              onChange={(event) =>
                updateFilters({
                  entityType: event.target.value
                    ? (event.target.value as AuditLogFilters['entityType'])
                    : undefined,
                })
              }
              className={selectClassName}
            >
              <option value="">Todas las entidades</option>
              {AUDIT_ENTITY_TYPE_OPTIONS.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {AUDIT_ENTITY_LABELS[entityType]}
                </option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label htmlFor="audit-entity-id-filter" className="sr-only">
              ID de entidad
            </label>
            <input
              key={filters.entityId ?? 'no-entity-id'}
              id="audit-entity-id-filter"
              type="number"
              min={1}
              defaultValue={filters.entityId ?? ''}
              placeholder="ID"
              onChange={(event) => {
                const rawValue = event.target.value.trim()

                if (rawValue === '') {
                  updateFilters({ entityId: undefined })
                  return
                }

                const value = Number(rawValue)

                updateFilters({
                  entityId: Number.isInteger(value) && value > 0
                    ? value
                    : undefined,
                })
              }}
              className={selectClassName}
            />
          </div>

          <div className="w-40">
            <label htmlFor="audit-from-filter" className="sr-only">
              Desde
            </label>
            <input
              id="audit-from-filter"
              type="date"
              value={filters.from ?? ''}
              onChange={(event) =>
                updateFilters({
                  from: event.target.value || undefined,
                })
              }
              className={selectClassName}
            />
          </div>

          <div className="w-40">
            <label htmlFor="audit-to-filter" className="sr-only">
              Hasta
            </label>
            <input
              id="audit-to-filter"
              type="date"
              value={filters.to ?? ''}
              onChange={(event) =>
                updateFilters({
                  to: event.target.value || undefined,
                })
              }
              className={selectClassName}
            />
          </div>
        </div>

        <section
          className="mt-7"
          aria-label="Eventos de auditoría"
          aria-busy={logsQuery.isFetching}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted" aria-live="polite">
              {pagination
                ? `${pagination.total} ${pagination.total === 1 ? 'evento encontrado' : 'eventos encontrados'}`
                : 'Cargando eventos…'}
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
            {showInitialLoading ? <AuditTableSkeleton /> : null}

            {queryError ? (
              <div className="rounded-2xl border border-[#e7b2ae] bg-[#fff7f6] p-6 text-center">
                <SearchX
                  aria-hidden="true"
                  className="mx-auto size-8 text-[#9a332b]"
                />
                <h2 className="mt-3 font-display text-xl font-semibold text-brand-950">
                  No pudimos cargar los eventos
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
                  {queryError.message}
                </p>
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={() => void logsQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  Reintentar
                </Button>
              </div>
            ) : null}

            {!showInitialLoading && !queryError && !hasResults ? (
              <div className="rounded-2xl border border-dashed border-[#b9cbd2] bg-white/75 px-6 py-14 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-brand-slate">
                  <ScrollText aria-hidden="true" className="size-6" />
                </span>
                <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-brand-950">
                  {filtersActive
                    ? 'No hay eventos para estos filtros'
                    : 'Aún no hay eventos registrados'}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
                  {filtersActive
                    ? 'Prueba con otros filtros o límpialos para ver el historial completo.'
                    : 'La bitácora se llenará a medida que el equipo use el panel.'}
                </p>
                {filtersActive ? (
                  <Button
                    variant="secondary"
                    className="mt-5"
                    onClick={clearAllFilters}
                  >
                    Limpiar filtros
                  </Button>
                ) : null}
              </div>
            ) : null}

            {hasResults && data ? (
              <>
                <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                  <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface/60">
                        <th scope="col" className="w-14 px-2 py-3">
                          <span className="sr-only">Detalles</span>
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Fecha
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Acción
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Actor
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Entidad
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.logs.map((log) => {
                        const isExpanded = expandedIds.includes(log.id)
                        const entityRoute = getAuditEntityRoute(log)

                        return (
                          <Fragment key={log.id}>
                            <tr className="border-b border-line/60 last:border-0 hover:bg-surface/40">
                              <td className="px-2 py-3">
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(log.id)}
                                  aria-expanded={isExpanded}
                                  aria-controls={`audit-details-${log.id}`}
                                  aria-label={
                                    isExpanded
                                      ? `Ocultar detalles del evento ${log.id}`
                                      : `Ver detalles del evento ${log.id}`
                                  }
                                  className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-brand-800"
                                >
                                  {isExpanded ? (
                                    <ChevronDown
                                      aria-hidden="true"
                                      className="size-4"
                                    />
                                  ) : (
                                    <ChevronRight
                                      aria-hidden="true"
                                      className="size-4"
                                    />
                                  )}
                                </button>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                                {formatAuditTimestamp(log.createdAt)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-brand-900">
                                  {getAuditActionLabel(log.action)}
                                </span>
                                <span className="ml-2 inline-flex">
                                  <ScopeBadge scope={log.scope} />
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {log.actorEmail ? (
                                  <span className="break-all text-ink-muted">
                                    {log.actorEmail}
                                  </span>
                                ) : (
                                  <span className="text-ink-muted">Sistema</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {entityRoute && log.entityType ? (
                                  <Link
                                    to={entityRoute}
                                    className="font-semibold text-brand-700 hover:text-brand-900"
                                  >
                                    {AUDIT_ENTITY_LABELS[log.entityType] ??
                                      log.entityType}{' '}
                                    #{log.entityId}
                                  </Link>
                                ) : (
                                  <span className="text-ink-muted">—</span>
                                )}
                              </td>
                            </tr>
                            {isExpanded ? (
                              <AuditDetailsRow
                                key={`audit-details-${log.id}`}
                                log={log}
                              />
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <AuditPagination
                  page={pagination?.page ?? 1}
                  totalPages={pagination?.totalPages ?? 0}
                  onPageChange={handlePageChange}
                />
              </>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
