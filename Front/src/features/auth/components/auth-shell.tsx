import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/brand-logo'

function AuthBrandPanel({ className = '' }: { className?: string }) {
  return (
    <aside
      className={[
        'auth-grid relative overflow-hidden bg-brand-950 px-10 py-12 text-white xl:px-16',
        className,
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-28 top-[18%] h-48 w-[560px] -rotate-[24deg] border border-brand-cyan/25 bg-brand-700/25" />
        <div className="absolute -right-16 top-[42%] h-20 w-[460px] -rotate-[24deg] bg-brand-cyan/15" />
        <div className="absolute -left-36 bottom-[9%] h-32 w-[520px] -rotate-[24deg] bg-brand-gold/10" />
        <div className="absolute bottom-0 left-[12%] h-40 w-px bg-gradient-to-t from-brand-gold/70 to-transparent" />
      </div>

      <div className="relative flex h-full flex-col">
        <BrandLogo size="md" />

        <div className="my-auto max-w-[580px] py-16">
          <div aria-hidden="true" className="h-px w-16 bg-brand-gold" />
          <p className="mt-8 max-w-[560px] font-display text-5xl font-medium leading-[1.04] tracking-[-0.045em] text-balance xl:text-6xl">
            Cada propiedad empieza con una buena captación.
          </p>
          <p className="mt-7 max-w-[480px] text-lg leading-8 text-white/68">
            El espacio de trabajo del equipo de HomeKeys Liberty para mantener
            los datos, propietarios y fotografías en orden desde el primer
            contacto.
          </p>

          <div className="mt-10 grid max-w-[500px] gap-3 text-[15px] text-white/72">
            <p className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-brand-cyan"
              />
              Información completa de cada captación
            </p>
            <p className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-brand-gold"
              />
              Fotografías organizadas y protegidas
            </p>
            <p className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-brand-slate"
              />
              Historial claro de cada cambio
            </p>
          </div>
        </div>

        <p className="relative text-sm text-white/45">
          Panel interno de HomeKeys Liberty
        </p>
      </div>
    </aside>
  )
}

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f7fafb] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <AuthBrandPanel className="hidden min-h-dvh lg:flex" />

      <main className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 md:px-12">
        <div className="flex items-center gap-3 lg:hidden">
          <BrandLogo size="sm" />
          <div>
            <p className="font-display text-base font-semibold text-brand-950">
              HomeKeys Liberty
            </p>
            <p className="text-xs text-ink-muted">Panel interno</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="enter-rise enter-rise-late w-full max-w-[440px]">
            {children}
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted/80">
          Gestión de captaciones
        </p>
      </main>
    </div>
  )
}
