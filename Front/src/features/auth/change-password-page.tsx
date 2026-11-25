import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { changeOwnPasswordRequest } from './auth.api'
import { useAuth } from './auth-context'
import {
  AuthPasswordField,
  PasswordPolicyHints,
} from './components/auth-fields'
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from './change-password.schema'

export function ChangePasswordPage() {
  const { user, endSession } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })
  const newPasswordValue = useWatch({
    control,
    name: 'newPassword',
  })

  useEffect(() => {
    document.title = 'Cambiar contraseña | HomeKeys Liberty'
  }, [])

  if (!user) {
    return null
  }

  const isForced = user.mustChangePassword

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setSubmitError(null)

    try {
      await changeOwnPasswordRequest({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })

      endSession({
        tone: 'success',
        message: 'Tu contraseña se actualizó. Inicia sesión nuevamente.',
      })
      navigate('/login', { replace: true })
    } catch (error) {
      const apiError = normalizeApiError(error)

      for (const fieldError of apiError.fieldErrors) {
        if (
          fieldError.field === 'currentPassword' ||
          fieldError.field === 'newPassword'
        ) {
          setError(fieldError.field, {
            type: 'server',
            message: fieldError.message,
          })
        }
      }

      setSubmitError(apiError.message)
    }
  }

  return (
    <AppShell
      pageTitle={isForced ? 'Cambio obligatorio' : 'Cambiar contraseña'}
      showMobileNavigation={!isForced}
    >
      <div className="mx-auto max-w-[560px]">
        {!isForced ? (
          <Link
            to="/perfil"
            className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver a mi perfil
          </Link>
        ) : null}

        <section className="mt-3 rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff7dc] text-[#725b0a]">
              <KeyRound aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-brand-slate">
                Seguridad de la cuenta
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-brand-950">
                Cambia tu contraseña
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {isForced
                  ? 'Tu cuenta requiere una nueva contraseña antes de continuar usando el panel.'
                  : 'Define una contraseña nueva para tu cuenta. Se cerrarán todas las sesiones activas.'}
              </p>
            </div>
          </div>

          {isForced ? (
            <Notice
              notice={{
                tone: 'warning',
                message:
                  'Debes completar este paso para acceder al resto del panel.',
              }}
              className="mt-5"
            />
          ) : null}

          {submitError ? (
            <Notice
              notice={{ tone: 'error', message: submitError }}
              className="mt-5"
              onDismiss={() => setSubmitError(null)}
            />
          ) : null}

          <form
            className="mt-6 space-y-5"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <AuthPasswordField
              id="change-current-password"
              label="Contraseña actual"
              registration={register('currentPassword')}
              error={errors.currentPassword?.message}
              disabled={isSubmitting}
              autoComplete="current-password"
              placeholder="Tu contraseña actual"
              onInput={() => setSubmitError(null)}
            />

            <div>
              <AuthPasswordField
                id="change-new-password"
                label="Nueva contraseña"
                registration={register('newPassword')}
                error={errors.newPassword?.message}
                disabled={isSubmitting}
                autoComplete="new-password"
                placeholder="Nueva contraseña"
                onInput={() => setSubmitError(null)}
              />
              <PasswordPolicyHints password={newPasswordValue ?? ''} />
            </div>

            <AuthPasswordField
              id="change-confirm-password"
              label="Confirmar contraseña"
              registration={register('confirmPassword')}
              error={errors.confirmPassword?.message}
              disabled={isSubmitting}
              autoComplete="new-password"
              placeholder="Repite la nueva contraseña"
              onInput={() => setSubmitError(null)}
            />

            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              loadingLabel="Guardando…"
            >
              Guardar contraseña
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  )
}
