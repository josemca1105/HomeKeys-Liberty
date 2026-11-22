import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { BrandLogo } from '@/components/brand/brand-logo'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { normalizeApiError } from '@/api/errors'
import { useAuth } from './auth-context'
import type { AuthNotice } from './auth.types'
import { loginSchema, type LoginFormValues } from './login.schema'

interface LoginLocationState {
  notice?: AuthNotice
}

interface BrandPanelProps {
  className?: string
}

function BrandPanel({ className }: BrandPanelProps) {
  return (
    <aside
      className={[
        'auth-grid relative overflow-hidden bg-brand-950 px-10 py-12 text-white xl:px-16',
        className ?? '',
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

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, notice: contextNotice } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | null>(
    null,
  )

  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const locationNotice =
    (location.state as LoginLocationState | null | undefined)?.notice ?? null
  const candidateNotice = locationNotice ?? contextNotice
  const noticeKey = candidateNotice
    ? `${candidateNotice.tone}:${candidateNotice.message}`
    : null
  const displayedNotice =
    candidateNotice && noticeKey !== dismissedNoticeKey
      ? candidateNotice
      : null

  const dismissDisplayedNotice = () => {
    if (noticeKey) {
      setDismissedNoticeKey(noticeKey)
    }
  }

  useEffect(() => {
    document.title = 'Iniciar sesión | HomeKeys Liberty'
  }, [])

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null)

    try {
      await login(values)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const apiError = normalizeApiError(error)

      for (const fieldError of apiError.fieldErrors) {
        if (fieldError.field === 'email' || fieldError.field === 'password') {
          setError(fieldError.field, {
            type: 'server',
            message: fieldError.message,
          })
        }
      }

      setSubmitError(apiError.message)
    }
  }

  const emailErrorId = errors.email ? 'login-email-error' : undefined
  const passwordErrorId = errors.password
    ? 'login-password-error'
    : undefined

  return (
    <div className="min-h-dvh bg-[#f7fafb] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <BrandPanel className="hidden min-h-dvh lg:flex" />

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
            <div aria-hidden="true" className="flex items-center gap-2">
              <span className="h-1 w-12 rounded-full bg-brand-700" />
              <span className="h-1 w-5 rounded-full bg-brand-cyan" />
              <span className="h-1 w-2.5 rounded-full bg-brand-gold" />
            </div>

            <p className="mt-7 text-sm font-semibold text-brand-slate">
              Acceso privado
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-[2.75rem]">
              Inicia sesión
            </h1>
            <p className="mt-3 text-base leading-7 text-ink-muted">
              Usa las credenciales asignadas a tu cuenta para entrar al panel.
            </p>

            {displayedNotice ? (
              <Notice
                notice={displayedNotice}
                className="mt-6"
                autoDismissMs={
                  displayedNotice.tone === 'success' ? 5_000 : undefined
                }
                onDismiss={dismissDisplayedNotice}
              />
            ) : null}

            {submitError ? (
              <Notice
                notice={{ tone: 'error', message: submitError }}
                className="mt-6"
                onDismiss={() => setSubmitError(null)}
              />
            ) : null}

            <form
              className="mt-7 space-y-5"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              aria-busy={isSubmitting}
            >
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-ink"
                >
                  Correo electrónico
                </label>
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="nombre@correo.com"
                  disabled={isSubmitting}
                  aria-invalid={errors.email ? 'true' : undefined}
                  aria-describedby={emailErrorId}
                  onInput={() => {
                    setSubmitError(null)
                    clearErrors('email')
                  }}
                  className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink shadow-[0_1px_0_rgb(8_39_63/0.03)] placeholder:text-[#91a3ac] transition-colors hover:border-[#b8cbd2] focus:border-brand-600 disabled:bg-surface disabled:text-ink-muted"
                />
                {errors.email ? (
                  <p
                    id={emailErrorId}
                    className="mt-2 text-sm text-[#9a332b]"
                  >
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-ink"
                >
                  Contraseña
                </label>
                <div className="relative mt-2">
                  <input
                    {...register('password')}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    placeholder="Tu contraseña"
                    disabled={isSubmitting}
                    aria-invalid={errors.password ? 'true' : undefined}
                    aria-describedby={passwordErrorId}
                    onInput={() => {
                      setSubmitError(null)
                      clearErrors('password')
                    }}
                    className="h-12 w-full rounded-xl border border-line bg-white py-0 pl-4 pr-14 text-base text-ink shadow-[0_1px_0_rgb(8_39_63/0.03)] placeholder:text-[#91a3ac] transition-colors hover:border-[#b8cbd2] focus:border-brand-600 disabled:bg-surface disabled:text-ink-muted"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-0 top-0 grid size-12 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-brand-800"
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    aria-pressed={showPassword}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                  </button>
                </div>
                {errors.password ? (
                  <p
                    id={passwordErrorId}
                    className="mt-2 text-sm text-[#9a332b]"
                  >
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                size="lg"
                fullWidth
                isLoading={isSubmitting}
                loadingLabel="Validando credenciales…"
                className="group mt-1"
              >
                Entrar al panel
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Button>
            </form>

            <p className="mt-7 border-t border-line pt-5 text-sm leading-6 text-ink-muted">
              ¿No puedes acceder? Contacta al administrador de tu equipo para
              solicitar ayuda con tu cuenta.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted/80">
          Gestión de captaciones
        </p>
      </main>
    </div>
  )
}
