import {
  Camera,
  CircleAlert,
  Images,
  RefreshCw,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useRef, type DragEvent } from 'react'
import { Notice } from '@/components/ui/notice'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type {
  PendingPhoto,
  PhotoUploadController,
} from '../use-photo-upload'

interface StepPhotosProps {
  controller: PhotoUploadController
}

const statusLabels: Record<PendingPhoto['status'], string> = {
  queued: 'En cola',
  uploading: 'Subiendo',
  confirming: 'Procesando',
  ready: 'Lista',
  error: 'Error',
}

function formatBatchExpiration(expiresAt: string): string {
  const date = new Date(expiresAt)

  if (Number.isNaN(date.getTime())) {
    return 'hora no disponible'
  }

  return new Intl.DateTimeFormat('es-VE', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function StepPhotos({ controller }: StepPhotosProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const busy = controller.isProcessing
  const canAdd = controller.canAddPhotos && !busy

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    void controller.addFiles(Array.from(files))
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (!canAdd) {
      return
    }

    handleFiles(event.dataTransfer.files)
  }

  const handleReset = () => {
    if (
      window.confirm(
        'Se eliminarán las fotos cargadas de este borrador. ¿Deseas continuar?',
      )
    ) {
      controller.reset()
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-brand-950">
              Fotografías
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Sube entre 5 y 20 fotos. La primera foto lista se usará como
              portada hasta que elijas otra.
            </p>
          </div>
          <span
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted"
            aria-live="polite"
          >
            {controller.photos.length} de 20
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => galleryInputRef.current?.click()}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#a9c2ca] bg-[#f8fbfc] px-3 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-600 hover:bg-[#f0f9fb] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Images aria-hidden="true" className="size-5 text-brand-slate" />
            Elegir fotos
          </button>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => cameraInputRef.current?.click()}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#a9c2ca] bg-[#f8fbfc] px-3 text-sm font-semibold text-brand-900 transition-colors hover:border-brand-600 hover:bg-[#f0f9fb] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera aria-hidden="true" className="size-5 text-brand-slate" />
            Tomar foto
          </button>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="hidden min-h-24 place-items-center rounded-xl border border-dashed border-[#c9d8dd] bg-surface px-3 text-center text-xs leading-5 text-ink-muted sm:flex"
          >
            <div>
              <UploadCloud
                aria-hidden="true"
                className="mx-auto size-5 text-brand-slate"
              />
              <p className="mt-1">También puedes arrastrar archivos aquí</p>
            </div>
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
          <p>
            {controller.readyPhotos.length} listas · mínimo requerido:{' '}
            <strong className="text-ink">5</strong>
          </p>
          {controller.batch ? (
            <p>
              Lote válido hasta las{' '}
              {formatBatchExpiration(controller.batch.expiresAt)}
            </p>
          ) : null}
        </div>

        {!controller.canAddPhotos ? (
          <p className="mt-2 text-xs font-medium text-[#715a09]">
            Alcanzaste el máximo de 20 fotografías.
          </p>
        ) : null}
      </section>

      {controller.globalError ? (
        <Notice
          notice={{ tone: 'error', message: controller.globalError }}
          onDismiss={controller.clearGlobalError}
        />
      ) : null}

      {controller.issues.length > 0 ? (
        <div className="rounded-xl border border-[#e7b2ae] bg-[#fff7f6] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#842e28]">
                Algunos archivos no se agregaron
              </p>
              <ul className="mt-1 space-y-1 text-sm leading-6 text-[#842e28]">
                {controller.issues.map((issue) => (
                  <li key={`${issue.fileName}-${issue.message}`}>
                    {issue.fileName}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={controller.clearIssues}
              className="min-h-12 rounded-lg px-3 text-xs font-semibold text-[#842e28] hover:bg-black/[0.04]"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {controller.photos.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-brand-950">
              Fotos de la captación
            </h2>
            {!busy ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleReset}
              >
                Reiniciar fotos
              </Button>
            ) : null}
          </div>

          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {controller.photos.map((photo) => {
              const isCover = photo.uploadId === controller.coverUploadId
              const isReady = photo.status === 'ready'

              return (
                <li
                  key={photo.localId}
                  className="overflow-hidden rounded-xl border border-line bg-white"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                    <img
                      src={photo.previewUrl}
                      alt={`Vista previa de ${photo.file.name}`}
                      className="size-full object-cover"
                    />
                    <span
                      className={cn(
                        'absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold shadow-sm',
                        photo.status === 'ready'
                          ? 'bg-[#edf9f3] text-[#176444]'
                          : photo.status === 'error'
                            ? 'bg-[#fff1ef] text-[#8c2f28]'
                            : 'bg-white/90 text-brand-900',
                      )}
                    >
                      {photo.status === 'uploading'
                        ? `${photo.progress}%`
                        : statusLabels[photo.status]}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void controller.removePhoto(photo.localId)
                      }
                      disabled={
                        busy ||
                        controller.removingLocalId === photo.localId
                      }
                      aria-label={`Eliminar ${photo.file.name}`}
                      className="absolute right-1 top-1 grid size-11 place-items-center rounded-lg bg-brand-950/70 text-white backdrop-blur transition-colors hover:bg-brand-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-2 p-3">
                    <p className="truncate text-xs font-medium text-ink-muted">
                      {photo.file.name}
                    </p>

                    {photo.status === 'uploading' ||
                    photo.status === 'confirming' ? (
                      <div
                        role="progressbar"
                        aria-label={`Carga de ${photo.file.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={photo.progress}
                        className="h-1 overflow-hidden rounded-full bg-surface"
                      >
                        <span
                          className="block h-full rounded-full bg-brand-cyan"
                          style={{ width: `${photo.progress}%` }}
                        />
                      </div>
                    ) : null}

                    {photo.status === 'error' ? (
                      <div>
                        <p className="flex items-start gap-1.5 text-xs leading-5 text-[#9a332b]">
                          <CircleAlert
                            aria-hidden="true"
                            className="mt-0.5 size-3.5 shrink-0"
                          />
                          {photo.error || 'No se pudo cargar la foto.'}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void controller.retryPhoto(photo.localId)
                          }
                          disabled={busy}
                          className="mt-2 inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-brand-700 hover:text-brand-900 disabled:opacity-50"
                        >
                          <RefreshCw
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          Reintentar
                        </button>
                      </div>
                    ) : null}

                    {isReady && photo.uploadId ? (
                      <button
                        type="button"
                        onClick={() =>
                          controller.selectCover(photo.uploadId as string)
                        }
                        aria-pressed={isCover}
                        className={cn(
                          'inline-flex min-h-12 items-center gap-1.5 rounded-lg px-1 text-xs font-semibold',
                          isCover
                            ? 'text-[#715a09]'
                            : 'text-brand-700 hover:text-brand-900',
                        )}
                      >
                        <Star
                          aria-hidden="true"
                          className={cn(
                            'size-3.5',
                            isCover && 'fill-brand-gold text-brand-gold',
                          )}
                        />
                        {isCover ? 'Portada' : 'Elegir portada'}
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#b9cbd2] bg-white/75 px-6 py-10 text-center">
          <Images
            aria-hidden="true"
            className="mx-auto size-8 text-brand-slate"
          />
          <p className="mt-3 font-display text-lg font-semibold text-brand-950">
            Aún no hay fotografías
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-muted">
            Agrega al menos 5 fotografías para poder crear la captación.
          </p>
        </div>
      )}
    </div>
  )
}
