import { ArrowLeft, Camera, Images } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { AppShell } from '@/components/layout/app-shell'
import { Notice } from '@/components/ui/notice'
import { useAuth } from '@/features/auth/auth-context'
import type { AuthNotice } from '@/features/auth/auth.types'
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
} from '../../create/create-property.api'
import { PropertyStatusBadge } from '../../components/property-status-badge'
import { usePropertyQuery } from '../../property-queries'
import type { Property, PropertyPhoto } from '../../property.types'
import { PendingPhotoCard } from '../components/pending-photo-card'
import { PhotoTile } from '../components/photo-tile'
import { usePropertyPhotoActions } from '../property-photo-mutations'
import { usePropertyPhotoUpload } from '../use-property-photo-upload'

function PhotosLoading() {
  return (
    <div className="mx-auto max-w-[1100px]" aria-busy="true">
      <div className="h-5 w-36 animate-pulse rounded bg-white" />
      <div className="mt-5 h-10 w-64 animate-pulse rounded-xl bg-white" />
      <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-2xl bg-white"
          />
        ))}
      </div>
    </div>
  )
}

function PhotosMessage({
  title,
  message,
}: {
  title: string
  message: string
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
        to="/captaciones"
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-surface"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a captaciones
      </Link>
    </div>
  )
}

export function PropertyPhotosPage() {
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
      ? `Fotografías de ${property.code} | HomeKeys Liberty`
      : 'Fotografías | HomeKeys Liberty'
  }, [property])

  if (!user) {
    return null
  }

  if (propertyId === null) {
    return (
      <AppShell pageTitle="Fotografías">
        <PhotosMessage
          title="Captación no encontrada"
          message="El identificador de la captación no es válido."
        />
      </AppShell>
    )
  }

  if (propertyQuery.isPending) {
    return (
      <AppShell pageTitle="Fotografías">
        <PhotosLoading />
      </AppShell>
    )
  }

  if (queryError) {
    return (
      <AppShell pageTitle="Fotografías">
        <PhotosMessage
          title={
            queryError.status === 404
              ? 'Captación no encontrada'
              : 'No pudimos cargar las fotografías'
          }
          message={
            queryError.status === 404
              ? 'La captación no existe, fue eliminada o no tienes acceso a ella.'
              : queryError.message
          }
        />
      </AppShell>
    )
  }

  if (!property) {
    return null
  }

  const canManage = isAdmin || property.status !== 'CLOSED'

  return (
    <PropertyPhotosManager
      property={property}
      canManage={canManage}
    />
  )
}

function PropertyPhotosManager({
  property,
  canManage,
}: {
  property: Property
  canManage: boolean
}) {
  const photos = useMemo(
    () => [...property.photos].sort((a, b) => a.sortOrder - b.sortOrder),
    [property.photos],
  )
  const upload = usePropertyPhotoUpload(property.id, photos.length)
  const actions = usePropertyPhotoActions(property.id)
  const [notice, setNotice] = useState<AuthNotice | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const isBusy =
    upload.isProcessing ||
    actions.reorder.isPending ||
    actions.setCover.isPending ||
    actions.removePhoto.isPending
  const totalCount = photos.length + upload.pendingPhotos.length
  const canAdd = canManage && upload.canAddPhotos && !isBusy
  const canDelete = canManage && photos.length > MIN_PHOTOS && !isBusy

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    setNotice(null)
    void upload.addFiles(Array.from(files))
  }

  const handleSetCover = async (photo: PropertyPhoto) => {
    if (photo.isCover || isBusy) {
      return
    }

    setNotice(null)

    try {
      await actions.setCover.mutateAsync(photo.id)
      setNotice({ tone: 'success', message: 'Portada actualizada.' })
    } catch (error) {
      setNotice({
        tone: 'error',
        message: normalizeApiError(error).message,
      })
    }
  }

  const handleMove = async (
    photo: PropertyPhoto,
    direction: -1 | 1,
  ) => {
    const index = photos.findIndex((item) => item.id === photo.id)
    const targetIndex = index + direction

    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= photos.length
    ) {
      return
    }

    const reordered = [...photos]
    const currentPhoto = reordered[index]
    const targetPhoto = reordered[targetIndex]

    if (!currentPhoto || !targetPhoto) {
      return
    }

    reordered[index] = targetPhoto
    reordered[targetIndex] = currentPhoto

    setNotice(null)

    try {
      await actions.reorder.mutateAsync(
        reordered.map((item) => item.id),
      )
      setNotice({ tone: 'success', message: 'Orden actualizado.' })
    } catch (error) {
      setNotice({
        tone: 'error',
        message: normalizeApiError(error).message,
      })
    }
  }

  const handleDelete = async (photo: PropertyPhoto) => {
    if (!canDelete) {
      return
    }

    if (
      !window.confirm(
        `Se eliminará esta fotografía. La captación debe conservar al menos ${MIN_PHOTOS}. ¿Deseas continuar?`,
      )
    ) {
      return
    }

    setNotice(null)

    try {
      await actions.removePhoto.mutateAsync(photo.id)
      setNotice({
        tone: 'success',
        message: 'Fotografía eliminada.',
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        message: normalizeApiError(error).message,
      })
    }
  }

  const confirmLeave = (): boolean => {
    if (!upload.isProcessing) {
      return true
    }

    return window.confirm(
      'Hay fotografías subiéndose. Si sales ahora podrían quedar incompletas. ¿Deseas continuar?',
    )
  }

  return (
    <AppShell
      pageTitle="Fotografías"
      showMobileNavigation={false}
      onNavigateAttempt={confirmLeave}
    >
      <div className="mx-auto max-w-[1100px]">
        <Link
          to={`/captaciones/${property.id}`}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al detalle
        </Link>

        {notice ? (
          <Notice
            notice={notice}
            className="mt-4"
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {upload.globalError ? (
          <Notice
            notice={{ tone: 'error', message: upload.globalError }}
            className="mt-4"
            onDismiss={upload.clearGlobalError}
          />
        ) : null}

        <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-slate">
              Inventario inmobiliario
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-4xl">
              Fotografías
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-brand-slate">
                {property.code}
              </span>
              <PropertyStatusBadge status={property.status} />
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted">
            <Images aria-hidden="true" className="size-4" />
            {totalCount} de {MAX_PHOTOS} fotografías
          </span>
        </header>

        {!canManage ? (
          <Notice
            notice={{
              tone: 'warning',
              message:
                'La captación está cerrada. Solo un administrador puede agregar, ordenar o eliminar fotografías.',
            }}
            className="mt-5"
          />
        ) : null}

        {canManage && property.status === 'CLOSED' ? (
          <Notice
            notice={{
              tone: 'warning',
              message:
                'La captación está cerrada. Como administrador aún puedes gestionar las fotografías.',
            }}
            className="mt-5"
          />
        ) : null}

        {canManage ? (
          <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
                  Agregar fotografías
                </h2>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  Sube entre 5 y {MAX_PHOTOS} fotografías. La portada actual
                  se conserva.
                </p>
              </div>
              <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted">
                {totalCount} de {MAX_PHOTOS}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => galleryInputRef.current?.click()}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#a9c2ca] bg-[#f8fbfc] px-3 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-600 hover:bg-[#f0f9fb] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Images
                  aria-hidden="true"
                  className="size-5 text-brand-slate"
                />
                Elegir fotos
              </button>
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => cameraInputRef.current?.click()}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#a9c2ca] bg-[#f8fbfc] px-3 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-600 hover:bg-[#f0f9fb] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Camera
                  aria-hidden="true"
                  className="size-5 text-brand-slate"
                />
                Tomar foto
              </button>
              <div className="hidden min-h-24 place-items-center rounded-xl border border-dashed border-[#c9d8dd] bg-surface px-3 text-center text-xs leading-5 text-ink-muted sm:flex">
                <p>
                  Las fotos se optimizan a WebP y se les elimina la ubicación
                  EXIF.
                </p>
              </div>
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => {
                handleFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
              onChange={(event) => {
                handleFiles(event.target.files)
                event.target.value = ''
              }}
            />

            {totalCount >= MAX_PHOTOS ? (
              <p className="mt-2 text-xs font-medium text-[#715a09]">
                Alcanzaste el máximo de {MAX_PHOTOS} fotografías.
              </p>
            ) : null}

            {upload.issues.length > 0 ? (
              <div className="mt-4 rounded-xl border border-[#e7b2ae] bg-[#fff7f6] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#842e28]">
                      Algunos archivos no se agregaron
                    </p>
                    <ul className="mt-1 space-y-1 text-sm leading-6 text-[#842e28]">
                      {upload.issues.map((issue) => (
                        <li key={`${issue.fileName}-${issue.message}`}>
                          {issue.fileName}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={upload.clearIssues}
                    className="min-h-12 rounded-lg px-3 text-xs font-semibold text-[#842e28] hover:bg-black/[0.04]"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}

            {upload.pendingPhotos.length > 0 ? (
              <div className="mt-5 border-t border-line/70 pt-5">
                <h3 className="font-display text-base font-semibold text-brand-950">
                  Subiendo fotografías
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {upload.pendingPhotos.map((photo) => (
                    <PendingPhotoCard
                      key={photo.localId}
                      photo={photo}
                      onRetry={() => void upload.retryPhoto(photo.localId)}
                      onRemove={() => upload.removePending(photo.localId)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
              Fotografías de la captación
            </h2>
            <p className="text-sm text-ink-muted">
              {photos.length}{' '}
              {photos.length === 1 ? 'fotografía' : 'fotografías'} · mínimo{' '}
              {MIN_PHOTOS}
            </p>
          </div>

          {photos.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-[#b9cbd2] bg-white/75 px-6 py-10 text-center">
              <Images
                aria-hidden="true"
                className="mx-auto size-8 text-brand-slate"
              />
              <p className="mt-3 font-display text-lg font-semibold text-brand-950">
                Aún no hay fotografías
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-muted">
                Agrega al menos {MIN_PHOTOS} fotografías para completar la
                captación.
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo, index) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  index={index}
                  total={photos.length}
                  canManage={canManage}
                  isBusy={isBusy}
                  canDelete={canDelete}
                  onSetCover={() => void handleSetCover(photo)}
                  onMoveUp={() => void handleMove(photo, -1)}
                  onMoveDown={() => void handleMove(photo, 1)}
                  onDelete={() => void handleDelete(photo)}
                />
              ))}
            </div>
          )}

          {photos.length <= MIN_PHOTOS ? (
            <p className="mt-4 rounded-xl bg-surface px-3 py-2 text-sm text-ink-muted">
              No puedes eliminar más fotografías: la captación debe conservar
              al menos {MIN_PHOTOS}.
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  )
}
