import {
  FilterX,
  RefreshCw,
  SearchX,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/cn'
import {
  getUserSortValue,
  hasUserFilters,
  parseUserFilters,
  parseUserSortValue,
  serializeUserFilters,
  SORT_OPTIONS,
  USER_ROLES,
} from '../user-filters'
import { formatUserDate, USER_ROLE_LABELS } from '../user-labels'
import { useUsersQuery } from '../user-queries'
import type { UserFilters } from '../user.types'
import { UserPagination } from '../components/user-pagination'
import { UserRoleBadge, UserStatusBadges } from '../components/user-badges'
import { UserSearch } from '../components/user-search'

function UsersTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="border-b border-line/70 p-4 last:border-0">
          <div className="h-4 w-40 animate-pulse rounded bg-surface" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-surface" />
        </div>
      ))}
    </div>
  )
}

const tableHeaderClassName =
  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-brand-slate'

export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterKey = searchParams.toString()
  const filters = useMemo(
    () => parseUserFilters(new URLSearchParams(filterKey)),
    [filterKey],
  )
  const usersQuery = useUsersQuery(filters)

  useEffect(() => {
    document.title = 'Usuarios | HomeKeys Liberty'
  }, [])

  const updateFilters = (
    patch: Partial<UserFilters>,
    options: { resetPage?: boolean } = {},
  ) => {
    const nextFilters: UserFilters = {
      ...filters,
      ...patch,
      ...(options.resetPage === false ? {} : { page: 1 }),
    }

    setSearchParams(serializeUserFilters(nextFilters), { replace: true })
  }

  const handleSortChange = (value: string) => {
    const parsedSort = parseUserSortValue(value)

    if (parsedSort) {
      updateFilters(parsedSort)
    }
  }

  const handlePageChange = (page: number) => {
    updateFilters({ page }, { resetPage: false })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const data = usersQuery.data
  const pagination = data?.pagination
  const filtersActive = hasUserFilters(filters)
  const queryError = usersQuery.isError
    ? normalizeApiError(usersQuery.error)
    : null
  const hasResults = Boolean(
    !usersQuery.isError && data && data.users.length > 0,
  )
  const showInitialLoading = usersQuery.isPending && !usersQuery.isError

  return (
    <AppShell pageTitle="Usuarios">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-slate">
              Gestión del equipo
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-5xl">
              Usuarios
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
              Invita integrantes, asigna roles y controla el acceso de cada
              cuenta del panel.
            </p>
          </div>

          <Link
            to="/usuarios/nuevo"
            className={cn(buttonVariants(), 'w-full shrink-0 sm:w-auto')}
          >
            <UserPlus aria-hidden="true" className="size-4" />
            Invitar usuario
          </Link>
        </header>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <UserSearch
            key={filters.search ?? 'all-users'}
            initialValue={filters.search ?? ''}
            onSearch={(search) =>
              updateFilters({ search: search || undefined })
            }
          />

          <div className="flex min-w-0 gap-2 lg:w-auto">
            <div className="min-w-0 flex-1 lg:w-40">
              <label htmlFor="user-role-filter" className="sr-only">
                Rol
              </label>
              <select
                id="user-role-filter"
                value={filters.role ?? ''}
                onChange={(event) =>
                  updateFilters({
                    role: event.target.value
                      ? (event.target.value as UserFilters['role'])
                      : undefined,
                  })
                }
                className="h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-brand-900 hover:border-[#b8cbd2] focus:border-brand-600"
              >
                <option value="">Todos los roles</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 flex-1 lg:w-40">
              <label htmlFor="user-status-filter" className="sr-only">
                Estado
              </label>
              <select
                id="user-status-filter"
                value={
                  filters.isActive === undefined
                    ? ''
                    : filters.isActive
                      ? 'true'
                      : 'false'
                }
                onChange={(event) => {
                  const value = event.target.value

                  updateFilters({
                    isActive:
                      value === 'true'
                        ? true
                        : value === 'false'
                          ? false
                          : undefined,
                  })
                }}
                className="h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-brand-900 hover:border-[#b8cbd2] focus:border-brand-600"
              >
                <option value="">Todos los estados</option>
                <option value="true">Activas</option>
                <option value="false">Inactivas</option>
              </select>
            </div>

            <div className="min-w-0 flex-1 lg:w-48">
              <label htmlFor="user-sort" className="sr-only">
                Ordenar usuarios
              </label>
              <select
                id="user-sort"
                value={getUserSortValue(filters)}
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
          </div>
        </div>

        <section
          className="mt-7"
          aria-label="Resultados de usuarios"
          aria-busy={usersQuery.isFetching}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted" aria-live="polite">
              {pagination
                ? `${pagination.total} ${pagination.total === 1 ? 'usuario encontrado' : 'usuarios encontrados'}`
                : 'Cargando usuarios…'}
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
            {showInitialLoading ? <UsersTableSkeleton /> : null}

            {queryError ? (
              <div className="rounded-2xl border border-[#e7b2ae] bg-[#fff7f6] p-6 text-center">
                <SearchX
                  aria-hidden="true"
                  className="mx-auto size-8 text-[#9a332b]"
                />
                <h2 className="mt-3 font-display text-xl font-semibold text-brand-950">
                  No pudimos cargar los usuarios
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
                  {queryError.message}
                </p>
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={() => void usersQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  Reintentar
                </Button>
              </div>
            ) : null}

            {!showInitialLoading && !queryError && !hasResults ? (
              <div className="rounded-2xl border border-dashed border-[#b9cbd2] bg-white/75 px-6 py-14 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-brand-slate">
                  <UsersRound aria-hidden="true" className="size-6" />
                </span>
                <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-brand-950">
                  {filtersActive
                    ? 'No encontramos usuarios'
                    : 'Aún no hay usuarios invitados'}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
                  {filtersActive
                    ? 'Prueba con otros filtros o limpia la búsqueda para ver más resultados.'
                    : 'Invita al primer integrante del equipo para comenzar a colaborar.'}
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
                    to="/usuarios/nuevo"
                    className={cn(buttonVariants(), 'mt-5')}
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    Invitar usuario
                  </Link>
                )}
              </div>
            ) : null}

            {hasResults && data ? (
              <>
                <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface/60">
                        <th scope="col" className={tableHeaderClassName}>
                          Usuario
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Rol
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Estado
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Teléfono
                        </th>
                        <th scope="col" className={tableHeaderClassName}>
                          Registrado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-line/60 last:border-0 hover:bg-surface/40"
                        >
                          <td className="px-4 py-3.5">
                            <Link
                              to={`/usuarios/${user.id}`}
                              className="font-semibold text-brand-900 hover:text-brand-700"
                            >
                              {user.firstName} {user.lastName}
                            </Link>
                            <p className="mt-0.5 break-all text-xs text-ink-muted">
                              {user.email}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <UserRoleBadge role={user.role} />
                          </td>
                          <td className="px-4 py-3.5">
                            <UserStatusBadges user={user} />
                          </td>
                          <td className="px-4 py-3.5 text-ink-muted">
                            {user.phone || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-ink-muted">
                            {formatUserDate(user.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <UserPagination
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
