import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { normalizeApiError } from '@/api/errors'
import { useAuth } from './auth-context'
import type { AuthNotice } from './auth.types'
import { AuthPageShell } from './components/auth-shell'
import { loginSchema, type LoginFormValues } from './login.schema'

interface LoginLocationState {
  notice?: AuthNotice
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
      const loggedUser = await login(values)
      navigate(
        loggedUser.mustChangePassword
          ? '/cambiar-contrasena'
          : '/dashboard',
        { replace: true },
      )
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
    <AuthPageShell>
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
        ¿Olvidaste tu contraseña?{' '}
        <Link
          to="/forgot-password"
          className="font-semibold text-brand-700 hover:text-brand-900"
        >
          Recupera tu acceso
        </Link>
        .
      </p>
    </AuthPageShell>
  )
}
