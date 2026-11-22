import { BrandLogo } from '@/components/brand/brand-logo'

interface SessionLoadingProps {
  message?: string
}

export function SessionLoading({
  message = 'Validando tu sesión…',
}: SessionLoadingProps) {
  return (
    <main className="auth-grid grid min-h-dvh place-items-center bg-brand-950 px-6">
      <div
        role="status"
        aria-live="polite"
        className="enter-rise flex flex-col items-center text-center"
      >
        <BrandLogo size="md" />
        <p className="mt-6 font-display text-lg font-medium text-white">
          HomeKeys Liberty
        </p>
        <p className="mt-2 text-sm text-white/65">{message}</p>
        <span
          aria-hidden="true"
          className="mt-5 h-0.5 w-24 overflow-hidden rounded-full bg-white/15"
        >
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-brand-cyan" />
        </span>
      </div>
    </main>
  )
}
