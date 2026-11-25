import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  UserX,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import type { AuthNotice } from '@/features/auth/auth.types'
import {
  UserSelectField,
  UserTextField,
} from '../components/user-fields'
import {
  UserStatusBadges,
  UserRoleBadge,
} from '../components/user-badges'
import { useUserQuery } from '../user-queries'
import {
  useDeleteUserMutation,
  useResendUserInvitationMutation,
  useSendUserPasswordResetMutation,
  useUpdateUserMutation,
} from '../user-mutations'
import { formatUserDate, USER_ROLE_LABELS } from '../user-labels'
import {
  toUpdateUserFormValues,
  toUpdateUserRequest,
  updateUserSchema,
  type UpdateUserFormValues,
} from '../update-user.schema'
import type { User } from '../user.types'

const USER_EDIT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'photoUrl',
] as const

const ROLE_OPTIONS = [
  { value: 'PARTNER', label: USER_ROLE_LABELS.PARTNER },
  { value: 'ADMIN', label: USER_ROLE_LABELS.ADMIN },
] as const

function UserLoading() {
  return (
    <div className="mx-auto max-w-[880px]" aria-busy="true">
      <div className="h-5 w-36 animate-pulse rounded bg-white" />
      <div className="mt-5 h-10 w-2/3 animate-pulse rounded-xl bg-white" />
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />
      <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white" />
    </div>
  )
}

function UserError({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#e7b2ae] bg-white p-7 text-center shadow-panel">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff2f0] text-[#9a332b]">
        <UsersRound aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.035em] text-brand-950">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
        {message}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          to="/usuarios"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-surface"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a usuarios
        </Link>
        {onRetry ? (
          <Button onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Reintentar
          </Button>
        ) : null}
      </div>
    </div>
  )
}

interface UserEditFormProps {
  user: User
}

function UserEditForm({ user }: UserEditFormProps) {
  const updateMutation = useUpdateUserMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: toUpdateUserFormValues(user),
  })

  const onSubmit = async (values: UpdateUserFormValues) => {
    setSubmitError(null)
    setSuccessMessage(null)

    try {
      await updateMutation.mutateAsync({
        userId: user.id,
        input: toUpdateUserRequest(values),
      })

      setSuccessMessage('Usuario actualizado correctamente.')
    } catch (error) {
      const apiError = normalizeApiError(error)

      for (const fieldError of apiError.fieldErrors) {
        if ((USER_EDIT_FIELDS as readonly string[]).includes(fieldError.field)) {
          setError(fieldError.field as keyof UpdateUserFormValues, {
            type: 'server',
            message: fieldError.message,
          })
        }
      }

      setSubmitError(apiError.message)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)] sm:p-7">
      <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
        Datos del usuario
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink-muted">
        El correo, el rol y los datos de contacto se pueden cambiar aquí. El
        estado de la cuenta se gestiona desde las acciones.
      </p>

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

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <UserTextField
            id="user-first-name"
            label="Nombre"
            registration={register('firstName')}
            error={errors.firstName?.message}
            disabled={isSubmitting}
            autoComplete="given-name"
            maxLength={100}
            onInput={() => setSubmitError(null)}
          />
          <UserTextField
            id="user-last-name"
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
          <UserTextField
            id="user-email"
            label="Correo electrónico"
            type="email"
            inputMode="email"
            registration={register('email')}
            error={errors.email?.message}
            disabled={isSubmitting}
            autoComplete="email"
            maxLength={255}
            onInput={() => setSubmitError(null)}
          />
          <UserTextField
            id="user-phone"
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
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <UserTextField
            id="user-photo-url"
            label="Foto de perfil (URL)"
            type="url"
            inputMode="url"
            registration={register('photoUrl')}
            error={errors.photoUrl?.message}
            hint="Opcional. Debe ser una URL http(s) pública."
            disabled={isSubmitting}
            autoComplete="off"
            placeholder="https://…"
            onInput={() => setSubmitError(null)}
          />
          <UserSelectField
            id="user-role"
            label="Rol"
            registration={register('role')}
            options={ROLE_OPTIONS}
            error={errors.role?.message}
            disabled={isSubmitting}
            hint="Cambia lo que esta persona puede ver y gestionar."
          />
        </div>

        <Button
          type="submit"
          isLoading={isSubmitting}
          loadingLabel="Guardando…"
        >
          Guardar cambios
        </Button>
      </form>
    </section>
  )
}

export function UserDetailPage() {
  const { userId: userIdParam } = useParams()
  const navigate = useNavigate()
  const parsedUserId = Number(userIdParam)
  const userId =
    Number.isInteger(parsedUserId) && parsedUserId > 0
      ? parsedUserId
      : null
  const userQuery = useUserQuery(userId)
  const updateMutation = useUpdateUserMutation()
  const resendMutation = useResendUserInvitationMutation()
  const resetLinkMutation = useSendUserPasswordResetMutation()
  const deleteMutation = useDeleteUserMutation()
  const [actionNotice, setActionNotice] = useState<AuthNotice | null>(null)

  const user = userQuery.data

  useEffect(() => {
    document.title = user
      ? `${user.firstName} ${user.lastName} | HomeKeys Liberty`
      : 'Usuario | HomeKeys Liberty'
  }, [user])

  const queryError = userQuery.isError
    ? normalizeApiError(userQuery.error)
    : null

  if (userId === null) {
    return (
      <AppShell pageTitle="Detalle de usuario">
        <UserError
          title="Usuario no encontrado"
          message="El identificador del usuario no es válido."
        />
      </AppShell>
    )
  }

  if (userQuery.isPending) {
    return (
      <AppShell pageTitle="Detalle de usuario">
        <UserLoading />
      </AppShell>
    )
  }

  if (queryError) {
    const isNotFound = queryError.status === 404

    return (
      <AppShell pageTitle="Detalle de usuario">
        <UserError
          title={
            isNotFound ? 'Usuario no encontrado' : 'No pudimos cargar el usuario'
          }
          message={
            isNotFound
              ? 'El usuario no existe o fue eliminado del panel.'
              : queryError.message
          }
          {...(!isNotFound
            ? { onRetry: () => void userQuery.refetch() }
            : {})}
        />
      </AppShell>
    )
  }

  if (!user) {
    return null
  }

  const handleResendInvitation = async () => {
    setActionNotice(null)

    try {
      await resendMutation.mutateAsync(user.id)
      setActionNotice({
        tone: 'success',
        message: 'Invitación reenviada. El enlace anterior dejó de ser válido.',
      })
    } catch (error) {
      setActionNotice({
        tone: 'error',
        message: normalizeApiError(error).message,
      })
    }
  }

  const handleSendPasswordReset = async () => {
    setActionNotice(null)

    try {
      await resetLinkMutation.mutateAsync(user.id)
      setActionNotice({
        tone: 'success',
        message: 'Enlace de restablecimiento enviado.',
      })
    } catch (error) {
      setActionNotice({
        tone: 'error',
        message: normalizeApiError(error).message,
      })
    }
  }

  const handleToggleStatus = async () => {
    if (user.isActive) {
      const confirmed = window.confirm(
        `${user.firstName} perderá el acceso y se cerrarán sus sesiones activas. ¿Deseas desactivar la cuenta?`,
      )

      if (!confirmed) {
        return
      }
    }

    setActionNotice(null)

    try {
      const updated = await updateMutation.mutateAsync({
        userId: user.id,
        input: { isActive: !user.isActive },
      })

      setActionNotice({
        tone: 'success',
        message: updated.isActive
          ? 'Cuenta reactivada correctamente.'
          : 'Cuenta desactivada correctamente.',
      })
    } catch (error) {
      setActionNotice({
        tone: 'error',
        message: normalizeApiError(error).message,
      })
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Se eliminará permanentemente a ${user.firstName} ${user.lastName}. Esta acción no se puede deshacer. ¿Deseas continuar?`,
    )

    if (!confirmed) {
      return
    }

    setActionNotice(null)

    try {
      await deleteMutation.mutateAsync(user.id)
      navigate('/usuarios', { replace: true })
    } catch (error) {
      setActionNotice({
        tone: 'error',
        message: normalizeApiError(error).message,
      })
    }
  }

  return (
    <AppShell pageTitle="Detalle de usuario">
      <div className="mx-auto max-w-[1180px]">
        <Link
          to="/usuarios"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a usuarios
        </Link>

        {actionNotice ? (
          <Notice
            notice={actionNotice}
            className="mt-4"
            onDismiss={() => setActionNotice(null)}
          />
        ) : null}

        <header className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <UserRoleBadge role={user.role} />
            <UserStatusBadges user={user} />
          </div>

          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-brand-950 sm:text-5xl">
            {user.firstName} {user.lastName}
          </h1>
          <p className="mt-3 flex flex-wrap items-start gap-4 text-base leading-7 text-ink-muted">
            <a
              href={`mailto:${user.email}`}
              className="inline-flex items-center gap-1.5 break-all rounded-lg font-semibold text-brand-700 hover:text-brand-900"
            >
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              {user.email}
            </a>
            <a
              href={`tel:${user.phone.replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-1.5 rounded-lg font-semibold text-brand-700 hover:text-brand-900"
            >
              <Phone aria-hidden="true" className="size-4 shrink-0" />
              {user.phone || 'Sin teléfono'}
            </a>
          </p>
        </header>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <UserEditForm key={user.id} user={user} />

          <aside className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-display text-base font-semibold text-brand-950">
                Acciones
              </h2>

              <div className="mt-4 space-y-2">
                {user.isActive && user.mustChangePassword ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start"
                    isLoading={resendMutation.isPending}
                    loadingLabel="Reenviando…"
                    onClick={() => void handleResendInvitation()}
                  >
                    <Send aria-hidden="true" className="size-4" />
                    Reenviar invitación
                  </Button>
                ) : null}

                {user.isActive && !user.mustChangePassword ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start"
                    isLoading={resetLinkMutation.isPending}
                    loadingLabel="Enviando enlace…"
                    onClick={() => void handleSendPasswordReset()}
                  >
                    <KeyRound aria-hidden="true" className="size-4" />
                    Enviar enlace de restablecimiento
                  </Button>
                ) : null}

                {user.isActive ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start"
                    isLoading={updateMutation.isPending}
                    loadingLabel="Desactivando…"
                    onClick={() => void handleToggleStatus()}
                  >
                    <UserX aria-hidden="true" className="size-4" />
                    Desactivar cuenta
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start"
                    isLoading={updateMutation.isPending}
                    loadingLabel="Reactivando…"
                    onClick={() => void handleToggleStatus()}
                  >
                    <RotateCcw aria-hidden="true" className="size-4" />
                    Reactivar cuenta
                  </Button>
                )}
              </div>

              {!user.isActive ? (
                <p className="mt-3 rounded-xl bg-surface px-3 py-3 text-sm leading-6 text-ink-muted">
                  La cuenta está desactivada: no puede iniciar sesión. Reactívala
                  para enviarle enlaces de acceso.
                </p>
              ) : null}

              <div className="mt-4 border-t border-line/70 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start border-[#e7b2ae] text-[#842e28] hover:bg-[#fff7f6]"
                  isLoading={deleteMutation.isPending}
                  loadingLabel="Eliminando…"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Eliminar usuario
                </Button>
                <p className="mt-2 text-xs leading-5 text-ink-muted">
                  La eliminación es permanente. Si la persona tiene captaciones
                  registradas, primero deberán reasignarse o cerrarse.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-[0_18px_45px_-38px_rgb(8_39_63/0.5)]">
              <h2 className="font-display text-base font-semibold text-brand-950">
                Seguimiento
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Registrado</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {formatUserDate(user.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Última actualización</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {formatUserDate(user.updatedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Cuenta</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {user.mustChangePassword
                      ? 'Esperando activación mediante la invitación.'
                      : user.isActive
                        ? 'Activa con acceso al panel.'
                        : 'Desactivada por un administrador.'}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
