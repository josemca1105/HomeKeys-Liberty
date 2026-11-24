import { LoaderCircle, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type {
  PendingPropertyPhoto,
  PendingPropertyPhotoStatus,
} from '../use-property-photo-upload'

const statusLabels: Record<PendingPropertyPhotoStatus, string> = {
  queued: 'En cola',
  uploading: 'Subiendo',
  confirming: 'Procesando',
  error: 'Error',
}

interface PendingPhotoCardProps {
  photo: PendingPropertyPhoto
  onRetry: () => void
  onRemove: () => void
}

export function PendingPhotoCard({
  photo,
  onRetry,
  onRemove,
}: PendingPhotoCardProps) {
  const isError = photo.status === 'error'

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-[4/3] bg-surface">
        <img
          src={photo.previewUrl}
          alt={`Vista previa de ${photo.file.name}`}
          className="size-full object-cover"
        />
        <span
          className={cn(
            'absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold shadow-sm',
            isError
              ? 'bg-[#fff1ef] text-[#8c2f28]'
              : 'bg-white/90 text-brand-900',
          )}
        >
          {statusLabels[photo.status]}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <p className="truncate text-xs font-medium text-ink-muted">
          {photo.file.name}
        </p>

        {isError ? (
          <>
            <p role="alert" className="text-xs leading-5 text-[#842e28]">
              {photo.error || 'No se pudo cargar la fotografía.'}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onRetry}
              >
                <RefreshCw aria-hidden="true" className="size-3.5" />
                Reintentar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onRemove}
              >
                <X aria-hidden="true" className="size-3.5" />
                Quitar
              </Button>
            </div>
          </>
        ) : (
          <>
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
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <LoaderCircle
                aria-hidden="true"
                className="size-3 animate-spin"
              />
              {photo.progress}%
            </p>
          </>
        )}
      </div>
    </article>
  )
}
