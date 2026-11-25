import {
  Building2,
  LayoutDashboard,
  LogOut,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import type { UserRole } from '@/features/auth/auth.types'
import { cn } from '@/lib/cn'
import { getUserInitials } from '@/lib/user'

interface AppShellProps {
  children: ReactNode
  pageTitle?: string
  showMobileNavigation?: boolean
  onNavigateAttempt?: (to: string) => boolean
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  PARTNER: 'Partner',
}

const navigationItems = [
  {
    to: '/dashboard',
    label: 'Inicio',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/captaciones',
    label: 'Captaciones',
    icon: Building2,
    end: false,
  },
] as const

const adminNavigationItem = {
  to: '/usuarios',
  label: 'Usuarios',
  icon: UsersRound,
  end: false,
} as const

function UserAvatar({
  firstName,
  lastName,
  className,
}: {
  firstName: string
  lastName: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full bg-brand-900 font-display text-sm font-semibold text-white ring-2 ring-white/15',
        className,
      )}
    >
      {getUserInitials(firstName, lastName)}
    </span>
  )
}

export function AppShell({
  children,
  pageTitle = 'Panel principal',
  showMobileNavigation = true,
  onNavigateAttempt,
}: AppShellProps) {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!user) {
    return null
  }

  const visibleNavigationItems =
    user.role === 'ADMIN'
      ? [...navigationItems, adminNavigationItem]
      : [...navigationItems]

  const handleLogout = async () => {
    if (onNavigateAttempt && !onNavigateAttempt('/login')) {
      return
    }

    setIsLoggingOut(true)

    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <aside className="auth-grid relative hidden min-h-dvh flex-col overflow-hidden bg-brand-950 px-6 py-7 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-52 overflow-hidden"
        >
          <div className="absolute -bottom-24 -left-24 h-32 w-[400px] -rotate-[24deg] bg-brand-cyan/10" />
          <div className="absolute -bottom-12 left-16 h-20 w-[360px] -rotate-[24deg] bg-brand-gold/10" />
        </div>

        <div className="relative">
          <BrandLogo size="sm" />
          <p className="mt-4 font-display text-lg font-semibold tracking-[-0.02em]">
            HomeKeys Liberty
          </p>
          <p className="mt-1 text-sm text-white/50">Panel interno</p>
        </div>

        <nav
          aria-label="Navegación principal"
          className="relative mt-10 space-y-1.5"
        >
          {visibleNavigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={(event) => {
                  if (onNavigateAttempt && !onNavigateAttempt(item.to)) {
                    event.preventDefault()
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-brand-gold)]'
                      : 'text-white/62 hover:bg-white/[0.06] hover:text-white',
                  )
                }
              >
                <Icon aria-hidden="true" className="size-4.5" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="relative mt-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
            <div className="flex items-center gap-3">
              <UserAvatar
                firstName={user.firstName}
                lastName={user.lastName}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-white/52">
                  {roleLabels[user.role]}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-5 px-1 text-xs leading-5 text-white/35">
            Acceso restringido al equipo autorizado.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex min-h-18 items-center justify-between border-b border-line/85 bg-white/92 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-md sm:pl-6 sm:pr-6 lg:pl-9 lg:pr-9">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <BrandLogo size="sm" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-brand-950">
                {pageTitle}
              </p>
              <p className="hidden text-xs text-ink-muted sm:block">
                HomeKeys Liberty
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/perfil"
              aria-label="Mi perfil"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-surface hover:text-brand-900"
            >
              <UserRound aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Mi perfil</span>
            </Link>

            <div className="hidden items-center gap-2.5 sm:flex">
              <UserAvatar
                firstName={user.firstName}
                lastName={user.lastName}
                className="size-9 bg-brand-800 ring-line"
              />
              <div className="hidden max-w-[180px] md:block">
                <p className="truncate text-sm font-semibold text-ink">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-ink-muted">{roleLabels[user.role]}</p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              isLoading={isLoggingOut}
              loadingLabel="Saliendo…"
              aria-label="Cerrar sesión"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        <main
          id="contenido"
          className={cn(
            'app-grid flex-1 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-9 lg:pt-10',
            showMobileNavigation
              ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10'
              : 'pb-6 lg:pb-10',
          )}
        >
          {children}
        </main>
      </div>

      {showMobileNavigation ? (
        <nav
          aria-label="Navegación móvil"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div
            className={cn(
              'grid gap-1 py-1.5',
              visibleNavigationItems.length >= 3
                ? 'grid-cols-3'
                : 'grid-cols-2',
            )}
          >
            {visibleNavigationItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={(event) => {
                    if (onNavigateAttempt && !onNavigateAttempt(item.to)) {
                      event.preventDefault()
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-brand-700/[0.08] text-brand-800'
                        : 'text-ink-muted hover:bg-surface hover:text-brand-900',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
