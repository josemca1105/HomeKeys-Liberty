import {
  PROPERTY_STATUS_CLASSES,
  PROPERTY_STATUS_LABELS,
} from '../property-labels'
import type { PropertyStatus } from '../property.types'
import { cn } from '@/lib/cn'

interface PropertyStatusBadgeProps {
  status: PropertyStatus
  className?: string
}

export function PropertyStatusBadge({
  status,
  className,
}: PropertyStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        PROPERTY_STATUS_CLASSES[status],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {PROPERTY_STATUS_LABELS[status]}
    </span>
  )
}
