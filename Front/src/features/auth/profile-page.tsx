import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Notice } from '@/components/ui/notice'
import { cn } from '@/lib/cn'
import { updateOwnProfileRequest } from './auth.api'
import { useAuth } from './auth-context'
import { AuthTextField } from './components/auth-fields'
import {
  profileSchema,
  toUpdateProfileRequest,
  type ProfileFormValues,
} from './profile.schema'

const PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'photoUrl',
] as const

export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      photoUrl: user?.photoUrl ?? '',
    },
  })

  useEffect(() => {
    document.title = 'Mi perfil | HomeKeys Liberty'
  }, [])

  if (!user) {
    return null
  }

  const onSubmit = async (values: ProfileFormValues) => {
    setSubmitError(null)
    setSuccessMessage(null)

    try {
      const updated = await updateOwnProfileRequest(
        toUpdateProfileRequest(values),
      )
      updateUser(updated)
      setSuccessMessage('Perfil actualizado correctamente.')
    } catch (error) {
      const apiError = normalizeApiError(error)

      for (const fieldError of apiError.fieldErrors) {
        if (
          (PROFILE_FIELDS as readonly string[]).includes(fieldError.field)
        ) {
          setError(fieldError.field as keyof ProfileFormValues, {
            type: 'server',
            message: fieldError.message,
          })
        }
      }

      setSubmitError(apiError.message)
    }
  }

  return (
    <AppShell pageTitle="Mi perfil">
      <div className="mx-auto max-w-[880px]">
        <Link
          to="/dashboard"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al inicio
        </Link>

        <header className="mt-3">
          <p className="text-sm font-semibold text-brand-slate">Tu cuenta</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-5xl">
            Mi perfil
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            Actualiza tus datos de contacto. El correo electrónico lo gestiona
            un administrador del equipo.
          </p>
        </header>

        {successMessage ? (
          <Notice
            notice={{ tone: 'success', message: successMessage }}
            className="mt-5"
            autoDismissMs={5_000}
            onDismiss={() => setSuccessMessage(null)}
          />
        ) : null}

        {submitError ? (
          <Notice
            notice={{ tone: 'error', message: submitError }}
            className="mt-5"
            onDismiss={() => setSubmitError(null)}
          />
        ) : null}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-7">
            <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
              Datos personales
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Esta información aparece en tu perfil y en la bitácora del
              equipo.
            </p>

            <form
              className="mt-6 space-y-5"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <AuthTextField
                  id="profile-first-name"
                  label="Nombre"
                  registration={register('firstName')}
                  error={errors.firstName?.message}
                  disabled={isSubmitting}
                  autoComplete="given-name"
                  maxLength={100}
                  onInput={() => setSubmitError(null)}
                />
                <AuthTextField
                  id="profile-last-name"
                  label="Apellido"
                  registration={register('lastName')}
                  error={errors.lastName?.message}
                  disabled={isSubmitting}
                  autoComplete="family-name"
                  maxLength={100}
                  onInput={() => setSubmitError(null)}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <AuthTextField
                  id="profile-phone"
                  label="Teléfono"
                  type="tel"
                  inputMode="tel"
                  registration={register('phone')}
                  error={errors.phone?.message}
                  disabled={isSubmitting}
                  autoComplete="tel"
                  maxLength={20}
                  placeholder="0414-1234567"
                  onInput={() => setSubmitError(null)}
                />
                <div>
                  <label
                    htmlFor="profile-email"
                    className="text-sm font-semibold text-ink"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={user.email}
                    readOnly
                    disabled
                    className="mt-2 h-12 w-full cursor-not-allowed rounded-xl border border-line bg-surface px-4 text-base text-ink-muted"
                  />
                  <p className="mt-2 text-xs leading-5 text-ink-muted">
                    El correo lo gestiona un administrador.
                  </p>
                </div>
              </div>

              <AuthTextField
                id="profile-photo-url"
                label="Foto de perfil (URL)"
                type="url"
                inputMode="url"
                registration={register('photoUrl')}
                error={errors.photoUrl?.message}
                hint="Opcional. Debe ser una URL http(s) pública."
                disabled={isSubmitting}
                autoComplete="off"
                placeholder="https://..."
                onInput={() => setSubmitError(null)}
              />

              <Button
                type="submit"
                isLoading={isSubmitting}
                loadingLabel="Guardando…"
              >
                Guardar cambios
              </Button>
            </form>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-7">
            <span className="grid size-10 place-items-center rounded-xl bg-[#fff7dc] text-[#725b0a]">
              <KeyRound aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
              Contraseña
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Cambia tu contraseña cuando lo necesites. Por seguridad, se
              cerrarán todas las sesiones activas y deberás iniciar sesión
              nuevamente.
            </p>
            <Link
              to="/cambiar-contrasena"
              className={cn(buttonVariants(), 'mt-5 w-full')}
            >
              <KeyRound aria-hidden="true" className="size-4" />
              Cambiar contraseña
            </Link>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
