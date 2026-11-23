import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  FormProvider,
  useForm,
  type FieldErrors,
} from 'react-hook-form'
import { useNavigate } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { useAuth } from '@/features/auth/auth-context'
import { propertyQueryKeys } from '../../property-queries'
import { StepFeatures } from '../components/step-features'
import { StepLocationOwner } from '../components/step-location-owner'
import { StepMainInfo } from '../components/step-main-info'
import { StepPhotos } from '../components/step-photos'
import { StepProgress } from '../components/step-progress'
import { StepReview } from '../components/step-review'
import { createProperty } from '../create-property.api'
import {
  CREATE_PROPERTY_DEFAULT_VALUES,
  CREATE_PROPERTY_STEP_FIELDS,
  createPropertySchema,
  toCreatePropertyRequest,
  type CreatePropertyFormValues,
} from '../create-property.schema'
import { usePhotoUpload } from '../use-photo-upload'

const STEP_COUNT = 5

function getFieldStep(field: string): number {
  const stepIndex = CREATE_PROPERTY_STEP_FIELDS.findIndex((fields) =>
    fields.includes(field as keyof CreatePropertyFormValues),
  )

  return stepIndex >= 0 ? stepIndex + 1 : STEP_COUNT
}

export function CreatePropertyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const agentName = user
    ? `${user.firstName} ${user.lastName}`
    : 'Agente no disponible'
  const photoUpload = usePhotoUpload()
  const [step, setStep] = useState(1)
  const [photoStepError, setPhotoStepError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<CreatePropertyFormValues>({
    resolver: zodResolver(createPropertySchema),
    mode: 'onTouched',
    defaultValues: { ...CREATE_PROPERTY_DEFAULT_VALUES },
  })

  const {
    handleSubmit,
    trigger,
    setError,
    formState: { isDirty },
  } = form

  const createMutation = useMutation({
    mutationFn: async (values: CreatePropertyFormValues) => {
      if (!photoUpload.batch) {
        throw new Error('No hay un lote de fotografías activo.')
      }

      return createProperty(
        toCreatePropertyRequest(values, {
          photoBatchId: photoUpload.batch.id,
          ...(photoUpload.coverUploadId
            ? { coverUploadId: photoUpload.coverUploadId }
            : {}),
        }),
      )
    },
    onSuccess: (property) => {
      void queryClient.invalidateQueries({
        queryKey: propertyQueryKeys.lists(),
      })
      void queryClient.invalidateQueries({
        queryKey: propertyQueryKeys.details(),
      })
      photoUpload.reset()
      navigate(`/captaciones/${property.id}`, {
        replace: true,
        state: { created: true },
      })
    },
  })

  useEffect(() => {
    document.title = 'Nueva captación | HomeKeys Liberty'
  }, [])

  const hasDraft = isDirty || photoUpload.photos.length > 0

  const confirmDiscard = (): boolean => {
    if (!hasDraft) {
      return true
    }

    if (
      !window.confirm(
        'Si sales ahora perderás los datos y las fotos cargadas de esta captación. ¿Deseas continuar?',
      )
    ) {
      return false
    }

    photoUpload.reset()
    return true
  }

  useEffect(() => {
    if (!hasDraft) {
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
  }, [hasDraft])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const goToStep = (nextStep: number) => {
    setSubmitError(null)
    setStep(nextStep)
    scrollToTop()
  }

  const cancel = () => {
    if (!confirmDiscard()) {
      return
    }

    navigate('/captaciones')
  }

  const goBack = () => {
    if (step === 1) {
      cancel()
      return
    }

    goToStep(step - 1)
  }

  const next = async () => {
    setSubmitError(null)
    setPhotoStepError(null)

    if (step === 4) {
      if (photoUpload.isProcessing) {
        setPhotoStepError('Espera a que terminen las subidas en curso.')
        return
      }

      if (!photoUpload.hasMinimumPhotos) {
        setPhotoStepError(
          'Agrega al menos 5 fotografías listas para continuar.',
        )
        return
      }

      goToStep(5)
      return
    }

    if (step < 4) {
      const fields = CREATE_PROPERTY_STEP_FIELDS[step - 1] ?? []
      const isValid = await trigger([...fields], { shouldFocus: true })

      if (!isValid) {
        return
      }

      goToStep(step + 1)
    }
  }

  const onInvalid = (formErrors: FieldErrors<CreatePropertyFormValues>) => {
    const firstField = Object.keys(formErrors)[0]

    if (firstField) {
      setStep(getFieldStep(firstField))
    }

    setSubmitError('Revisa los campos marcados antes de crear la captación.')
  }

  const onCreate = async (values: CreatePropertyFormValues) => {
    setSubmitError(null)
    setPhotoStepError(null)

    if (!photoUpload.hasMinimumPhotos || !photoUpload.batch) {
      setPhotoStepError(
        'Agrega al menos 5 fotografías listas antes de crear la captación.',
      )
      setStep(4)
      return
    }

    try {
      await createMutation.mutateAsync(values)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'No hay un lote de fotografías activo.'
      ) {
        setPhotoStepError(error.message)
        setStep(4)
        return
      }

      const apiError = normalizeApiError(error)
      setSubmitError(apiError.message)
      const knownFields = new Set(Object.keys(CREATE_PROPERTY_DEFAULT_VALUES))

      for (const fieldError of apiError.fieldErrors) {
        if (knownFields.has(fieldError.field)) {
          setError(fieldError.field as keyof CreatePropertyFormValues, {
            type: 'server',
            message: fieldError.message,
          })
          setStep(getFieldStep(fieldError.field))
        }
      }
    }
  }

  const submitForm = handleSubmit(onCreate, onInvalid)

  if (!user) {
    return null
  }

  return (
    <AppShell
      pageTitle="Nueva captación"
      showMobileNavigation={false}
      onNavigateAttempt={confirmDiscard}
    >
      <FormProvider {...form}>
        <form
          onSubmit={(event) => {
            void submitForm(event)
          }}
          noValidate
          className="mx-auto max-w-[900px]"
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={goBack}
              className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-white text-brand-900 hover:bg-surface"
              aria-label={step === 1 ? 'Cancelar captación' : 'Paso anterior'}
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
            <div>
              <p className="text-sm font-semibold text-brand-slate">
                Inventario inmobiliario
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-4xl">
                Nueva captación
              </h1>
            </div>
          </div>

          <div className="mt-5">
            <StepProgress currentStep={step} />
          </div>

          {submitError ? (
            <Notice
              notice={{ tone: 'error', message: submitError }}
              className="mt-5"
              onDismiss={() => setSubmitError(null)}
            />
          ) : null}

          <div className="mt-6">
            {step === 1 ? <StepMainInfo /> : null}
            {step === 2 ? <StepLocationOwner /> : null}
            {step === 3 ? <StepFeatures /> : null}
            {step === 4 ? (
              <>
                <StepPhotos controller={photoUpload} />
                {photoStepError ? (
                  <Notice
                    notice={{ tone: 'error', message: photoStepError }}
                    className="mt-5"
                    onDismiss={() => setPhotoStepError(null)}
                  />
                ) : null}
              </>
            ) : null}
            {step === 5 ? (
              <StepReview
                photoUpload={photoUpload}
                agentName={agentName}
                onEditStep={goToStep}
              />
            ) : null}
          </div>

          <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-9 lg:px-9">
            <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={goBack}
              >
                {step === 1 ? 'Cancelar' : 'Atrás'}
              </Button>

              {step < STEP_COUNT ? (
                <Button
                  type="button"
                  onClick={() => void next()}
                  disabled={
                    step === 4 &&
                    (!photoUpload.hasMinimumPhotos ||
                      photoUpload.isProcessing)
                  }
                >
                  Continuar
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  isLoading={createMutation.isPending}
                  loadingLabel="Creando captación…"
                >
                  Crear captación
                </Button>
              )}
            </div>
          </div>
        </form>
      </FormProvider>
    </AppShell>
  )
}
