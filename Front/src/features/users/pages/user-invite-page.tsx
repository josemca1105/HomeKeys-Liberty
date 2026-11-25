import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { UserSelectField, UserTextField } from '../components/user-fields'
import { useCreateUserMutation } from '../user-mutations'
import { USER_ROLE_LABELS } from '../user-labels'
import {
  INVITE_USER_DEFAULT_VALUES,
  inviteUserSchema,
  toCreateUserRequest,
  type InviteUserFormValues,
} from '../invite-user.schema'

const INVITE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
] as const

const ROLE_OPTIONS = [
  { value: 'PARTNER', label: USER_ROLE_LABELS.PARTNER },
  { value: 'ADMIN', label: USER_ROLE_LABELS.ADMIN },
] as const

export function UserInvitePage() {
  const createMutation = useCreateUserMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    email: string
    userId: number
  } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: INVITE_USER_DEFAULT_VALUES,
  })

  useEffect(() => {
    document.title = 'Invitar usuario | HomeKeys Liberty'
  }, [])

  const onSubmit = async (values: InviteUserFormValues) => {
    setSubmitError(null)
    setSuccess(null)

    try {
      const created = await createMutation.mutateAsync(
        toCreateUserRequest(values),
      )

      setSuccess({ email: created.user.email, userId: created.user.id })
      reset(INVITE_USER_DEFAULT_VALUES)
    } catch (error) {
      const apiError = normalizeApiError(error)

      for (const fieldError of apiError.fieldErrors) {
        if ((INVITE_FIELDS as readonly string[]).includes(fieldError.field)) {
          setError(fieldError.field as keyof InviteUserFormValues, {
            type: 'server',
            message: fieldError.message,
          })
        }
      }

      setSubmitError(apiError.message)
    }
  }

  return (
    <AppShell pageTitle="Invitar usuario">
      <div className="mx-auto max-w-[880px]">
        <Link
          to="/usuarios"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a usuarios
        </Link>

        <header className="mt-3">
          <p className="text-sm font-semibold text-brand-slate">
            Gestión del equipo
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-5xl">
            Invitar usuario
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            Registra a un nuevo integrante y envíale una invitación por correo.
            La persona definirá su propia contraseña al activar la cuenta.
          </p>
        </header>

        {success ? (
          <Notice
            notice={{
              tone: 'success',
              message: `Invitación enviada a ${success.email}.`,
            }}
            className="mt-5"
            autoDismissMs={8_000}
            onDismiss={() => setSuccess(null)}
          />
        ) : null}

        {submitError ? (
          <Notice
            notice={{ tone: 'error', message: submitError }}
            className="mt-5"
            onDismiss={() => setSubmitError(null)}
          />
        ) : null}

        <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-7">
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
            Datos del integrante
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            El correo no puede estar registrado previamente. El rol se puede
            cambiar más adelante.
          </p>

          <form
            className="mt-6 space-y-5"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <UserTextField
                id="invite-first-name"
                label="Nombre"
                registration={register('firstName')}
                error={errors.firstName?.message}
                disabled={isSubmitting}
                autoComplete="given-name"
                maxLength={100}
                onInput={() => setSubmitError(null)}
              />
              <UserTextField
                id="invite-last-name"
                label="Apellido"
                registration={register('lastName')}
                error={errors.lastName?.message}
                disabled={isSubmitting}
                autoComplete="family-name"
                maxLength={100}
                onInput={() => setSubmitError(null)}
              />
            </div>

            <UserTextField
              id="invite-email"
              label="Correo electrónico"
              type="email"
              inputMode="email"
              registration={register('email')}
              error={errors.email?.message}
              disabled={isSubmitting}
              autoComplete="email"
              maxLength={255}
              placeholder="nombre@correo.com"
              onInput={() => setSubmitError(null)}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <UserTextField
                id="invite-phone"
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
              <UserSelectField
                id="invite-role"
                label="Rol"
                registration={register('role')}
                options={ROLE_OPTIONS}
                error={errors.role?.message}
                disabled={isSubmitting}
                hint="Un administrador gestiona usuarios y captaciones de todo el equipo."
              />
            </div>

            <Button
              type="submit"
              isLoading={isSubmitting}
              loadingLabel="Enviando invitación…"
            >
              <MailPlus aria-hidden="true" className="size-4" />
              Enviar invitación
            </Button>
          </form>
        </section>

        {success ? (
          <p className="mt-5 text-sm text-ink-muted">
            Puedes revisar el estado de la cuenta en el{' '}
            <Link
              to={`/usuarios/${success.userId}`}
              className="font-semibold text-brand-700 hover:text-brand-900"
            >
              perfil del usuario
            </Link>
            .
          </p>
        ) : null}
      </div>
    </AppShell>
  )
}
