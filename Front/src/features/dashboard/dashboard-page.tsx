import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Image,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { useAuth } from '@/features/auth/auth-context'
import type { AuthUser, UserRole } from '@/features/auth/auth.types'

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  PARTNER: 'Partner',
}

const roleDescriptions: Record<UserRole, string> = {
  ADMIN: 'Acceso completo a captaciones, usuarios y auditoría.',
  PARTNER: 'Acceso a tus captaciones, tu perfil y tu actividad.',
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return new Intl.DateTimeFormat('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function AccountRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line/70 py-4 first:pt-0 last:border-0 last:pb-0">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-brand-slate">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-ink">
          {value}
        </p>
      </div>
    </div>
  )
}

function PendingPasswordChange({ user }: { user: AuthUser }) {
  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <section className="overflow-hidden rounded-3xl border border-brand-gold/50 bg-white shadow-panel">
        <div className="h-1.5 bg-gradient-to-r from-brand-gold via-brand-cyan to-brand-700" />
        <div className="px-6 py-8 sm:px-9 sm:py-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff7dc] text-[#725b0a]">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-6 text-sm font-semibold text-brand-slate">
            Acción requerida
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-brand-950">
            Cambia tu contraseña para continuar
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-muted">
            Hola, {user.firstName}. Por seguridad, tu cuenta requiere una nueva
            contraseña antes de usar el resto del panel. La pantalla de cambio
            se habilitará en el próximo módulo.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
            Mientras tanto, puedes cerrar sesión desde la barra superior. Si
            necesitas ayuda, contacta al administrador de tu equipo.
          </p>
        </div>
      </section>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Inicio | HomeKeys Liberty'
  }, [])

  if (!user) {
    return null
  }

  if (user.mustChangePassword) {
    return (
      <AppShell>
        <PendingPasswordChange user={user} />
      </AppShell>
    )
  }

  const fullName = `${user.firstName} ${user.lastName}`

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px]">
        <section className="enter-rise relative overflow-hidden rounded-3xl bg-brand-950 px-6 py-8 text-white shadow-panel sm:px-9 sm:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute -right-16 -top-20 h-44 w-[420px] rotate-[24deg] border border-brand-cyan/20 bg-brand-700/25" />
            <div className="absolute -right-10 top-24 h-14 w-[320px] rotate-[24deg] bg-brand-gold/10" />
            <div className="absolute bottom-0 left-[8%] h-20 w-px bg-gradient-to-t from-brand-gold/60 to-transparent" />
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/78">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-brand-cyan"
              />
              Sesión activa
            </span>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-medium tracking-[-0.04em] text-balance sm:text-5xl">
              Hola, {user.firstName}.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              Bienvenido a tu espacio de trabajo. Aquí organizaremos la
              información y las fotografías de cada captación.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/55">
              <span>{roleLabels[user.role]}</span>
              <span className="hidden h-3 w-px bg-white/20 sm:block" />
              <span>{roleDescriptions[user.role]}</span>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-slate">
                  Tu cuenta
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-brand-950">
                  Datos de acceso
                </h2>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand-slate">
                <CircleUserRound aria-hidden="true" className="size-5" />
              </span>
            </div>

            <div className="mt-6">
              <AccountRow
                icon={CircleUserRound}
                label="Nombre"
                value={fullName}
              />
              <AccountRow icon={Mail} label="Correo" value={user.email} />
              <AccountRow
                icon={Phone}
                label="Teléfono"
                value={user.phone || 'No registrado'}
              />
              <AccountRow
                icon={CalendarDays}
                label="Miembro desde"
                value={formatDate(user.createdAt)}
              />
            </div>
          </section>

          <div className="grid gap-6">
            <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-[#e9f8fb] text-brand-cyan-ink">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <h2 className="mt-5 font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
                Sesión protegida
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Tu acceso se valida contra la base de datos y se cierra
                automáticamente cuando el token deja de ser válido.
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line/70 pt-5">
                <div>
                  <dt className="text-xs text-ink-muted">Rol actual</dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">
                    {roleLabels[user.role]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Estado</dt>
                  <dd className="mt-1 text-sm font-semibold text-[#176444]">
                    {user.isActive ? 'Activa' : 'Inactiva'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-slate">
                    Próxima etapa
                  </p>
                  <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
                    Captaciones
                  </h2>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-[#fff7dc] text-[#725b0a]">
                  <Image aria-hidden="true" className="size-5" />
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-muted">
                El siguiente módulo reunirá el listado, los filtros, el detalle
                y la creación de captaciones con sus fotografías.
              </p>
              <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                En preparación
                <ChevronRight aria-hidden="true" className="size-4" />
              </p>
            </section>
          </div>
        </div>

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-white/75 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-brand-slate">
              <Users aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-brand-950">
                El panel crecerá por módulos
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Primero captaciones; después usuarios, auditoría y perfil.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-slate">
            Revisión incremental
          </span>
        </section>
      </div>
    </AppShell>
  )
}
