import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  FormProvider,
  useForm,
  type FieldErrors,
} from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { useAuth } from '@/features/auth/auth-context'
import { PropertyStatusBadge } from '../../components/property-status-badge'
import { StepFeatures } from '../../create/components/step-features'
import { StepLocationOwner } from '../../create/components/step-location-owner'
import { StepMainInfo } from '../../create/components/step-main-info'
import { useUpdatePropertyMutation } from '../../property-mutations'
import {
  useAgentDirectoryQuery,
  usePropertyQuery,
} from '../../property-queries'
import type { Property } from '../../property.types'
import { AgentField } from '../components/agent-field'
import {
  editPropertySchema,
  toEditPropertyFormValues,
  toUpdatePropertyRequest,
  type EditPropertyFormValues,
} from '../edit-property.schema'

function EditLoading() {
  return (
    <div className="mx-auto max-w-[900px]" aria-busy="true">
      <div className="h-10 w-52 animate-pulse rounded-xl bg-white" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-white" />
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-white" />
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-white" />
    </div>
  )
}

function EditMessage({
  title,
  message,
  backTo,
  backLabel,
}: {
  title: string
  message: string
  backTo: string
  backLabel: string
}) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-7 text-center shadow-panel">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-brand-950">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
        {message}
      </p>
      <Link
        to={backTo}
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-surface"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </Link>
    </div>
  )
}

export function EditPropertyPage() {
  const { propertyId: propertyIdParam } = useParams()
  const { user } = useAuth()
  const parsedPropertyId = Number(propertyIdParam)
  const propertyId =
    Number.isInteger(parsedPropertyId) && parsedPropertyId > 0
      ? parsedPropertyId
      : null
  const propertyQuery = usePropertyQuery(propertyId)
  const property = propertyQuery.data
  const isAdmin = user?.role === 'ADMIN'
  const queryError = propertyQuery.isError
    ? normalizeApiError(propertyQuery.error)
    : null

  useEffect(() => {
    document.title = property
      ? `Editar ${property.code} | HomeKeys Liberty`
      : 'Editar captación | HomeKeys Liberty'
  }, [property])

  if (!user) {
    return null
  }

  if (propertyId === null) {
    return (
      <AppShell pageTitle="Editar captación">
        <EditMessage
          title="Captación no encontrada"
          message="El identificador de la captación no es válido."
          backTo="/captaciones"
          backLabel="Volver a captaciones"
        />
      </AppShell>
    )
  }

  if (propertyQuery.isPending) {
    return (
      <AppShell pageTitle="Editar captación">
        <EditLoading />
      </AppShell>
    )
  }

  if (queryError) {
    return (
      <AppShell pageTitle="Editar captación">
        <EditMessage
          title={
            queryError.status === 404
              ? 'Captación no encontrada'
              : 'No pudimos cargar la captación'
          }
          message={
            queryError.status === 404
              ? 'La captación no existe, fue eliminada o no tienes acceso a ella.'
              : queryError.message
          }
          backTo="/captaciones"
          backLabel="Volver a captaciones"
        />
      </AppShell>
    )
  }

  if (!property) {
    return null
  }

  if (property.status === 'CLOSED' && !isAdmin) {
    return (
      <AppShell pageTitle="Editar captación">
        <EditMessage
          title="Captación cerrada"
          message="Esta captación está cerrada. Un administrador debe reabrirla antes de que puedas editarla."
          backTo={`/captaciones/${property.id}`}
          backLabel="Volver al detalle"
        />
      </AppShell>
    )
  }

  return <EditPropertyForm property={property} isAdmin={isAdmin} />
}

function EditPropertyForm({
  property,
  isAdmin,
}: {
  property: Property
  isAdmin: boolean
}) {
  const navigate = useNavigate()
  const updateMutation = useUpdatePropertyMutation()
  const agentsQuery = useAgentDirectoryQuery(isAdmin)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<EditPropertyFormValues>({
    resolver: zodResolver(editPropertySchema),
    mode: 'onTouched',
    defaultValues: toEditPropertyFormValues(property),
  })

  const {
    handleSubmit,
    setError,
    formState: { isDirty },
  } = form

  useEffect(() => {
    if (!isDirty) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  const confirmDiscard = (): boolean => {
    if (!isDirty) {
      return true
    }

    return window.confirm(
      'Si sales ahora perderás los cambios sin guardar. ¿Deseas continuar?',
    )
  }

  const goToDetail = () => {
    if (!confirmDiscard()) {
      return
    }

    navigate(`/captaciones/${property.id}`)
  }

  const agentOptions = (agentsQuery.data ?? []).map((agent) => ({
    value: String(agent.id),
    label: `${agent.firstName} ${agent.lastName}`,
  }))

  if (
    !agentOptions.some(
      (option) => option.value === String(property.agentId),
    )
  ) {
    agentOptions.unshift({
      value: String(property.agentId),
      label: `Agente actual (#${property.agentId})`,
    })
  }

  const onInvalid = (formErrors: FieldErrors<EditPropertyFormValues>) => {
    const firstField = Object.keys(formErrors)[0]
    setSubmitError(
      firstField
        ? 'Revisa los campos marcados antes de guardar los cambios.'
        : 'No pudimos guardar los cambios. Intenta nuevamente.',
    )
  }

  const onSave = async (values: EditPropertyFormValues) => {
    setSubmitError(null)

    try {
      await updateMutation.mutateAsync({
        propertyId: property.id,
        input: toUpdatePropertyRequest(values, { isAdmin }),
      })

      navigate(`/captaciones/${property.id}`, {
        replace: true,
        state: { updated: true },
      })
    } catch (error) {
      const apiError = normalizeApiError(error)
      setSubmitError(apiError.message)
      const knownFields = new Set(
        Object.keys(toEditPropertyFormValues(property)),
      )

      for (const fieldError of apiError.fieldErrors) {
        if (knownFields.has(fieldError.field)) {
          setError(fieldError.field as keyof EditPropertyFormValues, {
            type: 'server',
            message: fieldError.message,
          })
        }
      }
    }
  }

  return (
    <AppShell
      pageTitle="Editar captación"
      showMobileNavigation={false}
      onNavigateAttempt={confirmDiscard}
    >
      <FormProvider {...form}>
        <form
          onSubmit={(event) => {
            void handleSubmit(onSave, onInvalid)(event)
          }}
          noValidate
          className="mx-auto max-w-[900px]"
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={goToDetail}
              className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-white text-brand-900 hover:bg-surface"
              aria-label="Volver al detalle"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
            <div>
              <p className="text-sm font-semibold text-brand-slate">
                Inventario inmobiliario
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-4xl">
                Editar captación
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-brand-slate">
                  {property.code}
                </span>
                <PropertyStatusBadge status={property.status} />
              </div>
            </div>
          </div>

          {property.status === 'CLOSED' ? (
            <Notice
              notice={{
                tone: 'warning',
                message:
                  'Esta captación está cerrada. Puedes editarla, pero seguirá cerrada hasta que la reabras desde el detalle.',
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

          <div className="mt-6 space-y-6">
            {isAdmin ? (
              <AgentField
                options={agentOptions}
                isLoading={agentsQuery.isPending}
              />
            ) : null}
            <StepMainInfo />
            <StepLocationOwner />
            <StepFeatures />
          </div>

          <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-9 lg:px-9">
            <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3">
              <Button type="button" variant="secondary" onClick={goToDetail}>
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={updateMutation.isPending}
                loadingLabel="Guardando…"
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </AppShell>
  )
}
