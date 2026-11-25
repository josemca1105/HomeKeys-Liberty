import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  CheckCircle2,
  Link2Off,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { resetPasswordRequest } from './auth.api'
import {
  AuthPasswordField,
  PasswordPolicyHints,
} from './components/auth-fields'
import { AuthPageShell } from './components/auth-shell'
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from './reset-password.schema'

export function ResetPasswordPage() {
  const location = useLocation()
  const [token] = useState<string | null>(() =>
    new URLSearchParams(location.hash.replace(/^#/, '')).get('token'),
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })
  const newPasswordValue = useWatch({
    control,
    name: 'newPassword',
  })

  useEffect(() => {
    if (!token) {
      return
    }

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }, [token])

  useEffect(() => {
    document.title = 'Nueva contraseña | HomeKeys Liberty'
  }, [])

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      return
    }

    setSubmitError(null)

    try {
      await resetPasswordRequest({
        token,
        newPassword: values.newPassword,
      })
      setIsSuccess(true)
    } catch (error) {
      const apiError = normalizeApiError(error)

      for (const fieldError of apiError.fieldErrors) {
        if (fieldError.field === 'newPassword') {
          setError('newPassword', {
            type: 'server',
            message: fieldError.message,
          })
        }
      }

      setSubmitError(apiError.message)
    }
  }

  if (!token) {
    return (
      <AuthPageShell>
        <span className="grid size-12 place-items-center rounded-2xl bg-[#fff7dc] text-[#725b0a]">
          <Link2Off aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950">
          Enlace inválido
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-muted">
          El enlace no contiene un token válido. Solicita uno nuevo para
          continuar.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex min-h-12 items-center gap-1.5 rounded-lg text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Solicitar un nuevo enlace
        </Link>
      </AuthPageShell>
    )
  }

  if (isSuccess) {
    return (
      <AuthPageShell>
        <span className="grid size-12 place-items-center rounded-2xl bg-[#edf9f3] text-[#176444]">
          <CheckCircle2 aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950">
          Contraseña actualizada
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-muted">
          Ya puedes iniciar sesión con tu nueva contraseña. Por seguridad,
          todas las sesiones anteriores fueron cerradas.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Iniciar sesión
        </Link>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-1 w-12 rounded-full bg-brand-700" />
        <span className="h-1 w-5 rounded-full bg-brand-cyan" />
        <span className="h-1 w-2.5 rounded-full bg-brand-gold" />
      </div>

      <p className="mt-7 text-sm font-semibold text-brand-slate">
        Acceso seguro
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-[2.75rem]">
        Crea tu nueva contraseña
      </h1>
      <p className="mt-3 text-base leading-7 text-ink-muted">
        Este enlace es de un solo uso. Define una contraseña segura para
        activar tu cuenta o recuperar el acceso.
      </p>

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
      >
        <div>
          <AuthPasswordField
            id="reset-new-password"
            label="Nueva contraseña"
            registration={register('newPassword')}
            error={errors.newPassword?.message}
            disabled={isSubmitting}
            autoComplete="new-password"
            onInput={() => setSubmitError(null)}
          />
          <PasswordPolicyHints password={newPasswordValue ?? ''} />
        </div>

        <AuthPasswordField
          id="reset-confirm-password"
          label="Confirmar contraseña"
          registration={register('confirmPassword')}
          error={errors.confirmPassword?.message}
          disabled={isSubmitting}
          autoComplete="new-password"
          onInput={() => setSubmitError(null)}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          loadingLabel="Guardando contraseña…"
        >
          Guardar contraseña
        </Button>
      </form>

      <p className="mt-7 border-t border-line pt-5 text-sm leading-6 text-ink-muted">
        ¿El enlace expiró?{' '}
        <Link
          to="/forgot-password"
          className="font-semibold text-brand-700 hover:text-brand-900"
        >
          Solicita uno nuevo
        </Link>
        .
      </p>
    </AuthPageShell>
  )
}
