import { ArrowDown, ArrowUp, Star, Trash2 } from 'lucide-react'
import { AuthenticatedImage } from '@/components/images/authenticated-image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { PropertyPhoto } from '../../property.types'

interface PhotoTileProps {
  photo: PropertyPhoto
  index: number
  total: number
  canManage: boolean
  isBusy: boolean
  canDelete: boolean
  onSetCover: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

export function PhotoTile({
  photo,
  index,
  total,
  canManage,
  isBusy,
  canDelete,
  onSetCover,
  onMoveUp,
  onMoveDown,
  onDelete,
}: PhotoTileProps) {
  const isCover = photo.isCover

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-[4/3] bg-surface">
        <AuthenticatedImage
          src={photo.url}
          alt={photo.altText || `Fotografía ${index + 1}`}
          className="size-full"
        />
        {isCover ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#fff8df] px-2 py-1 text-[11px] font-bold text-[#715a09] shadow-sm">
            <Star
              aria-hidden="true"
              className="size-3 fill-brand-gold text-brand-gold"
            />
            Portada
          </span>
        ) : null}
        <span className="absolute bottom-2 right-2 rounded-lg bg-brand-950/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {index + 1} / {total}
        </span>
      </div>

      <div className="space-y-3 p-3">
        <p className="truncate text-xs font-medium text-ink-muted">
          {photo.altText || `Fotografía ${index + 1}`}
        </p>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isCover ? 'secondary' : 'primary'}
              disabled={isCover || isBusy}
              onClick={onSetCover}
              aria-label={
                isCover
                  ? 'Portada actual'
                  : `Elegir fotografía ${index + 1} como portada`
              }
            >
              <Star
                aria-hidden="true"
                className={cn(
                  'size-3.5',
                  isCover && 'fill-brand-gold text-brand-gold',
                )}
              />
              {isCover ? 'Portada' : 'Elegir portada'}
            </Button>

            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={index === 0 || isBusy}
              onClick={onMoveUp}
              aria-label={`Mover fotografía ${index + 1} hacia arriba`}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={index === total - 1 || isBusy}
              onClick={onMoveDown}
              aria-label={`Mover fotografía ${index + 1} hacia abajo`}
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={!canDelete || isBusy}
              onClick={onDelete}
              aria-label={`Eliminar fotografía ${index + 1}`}
              className="border-[#e7b2ae] text-[#842e28] hover:bg-[#fff7f6]"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
