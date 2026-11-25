import { ChevronLeft, ChevronRight } from 'lucide-react'

interface UserPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function UserPagination({
  page,
  totalPages,
  onPageChange,
}: UserPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Paginación de usuarios"
      className="mt-8 flex items-center justify-between gap-3"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-brand-900 disabled:cursor-not-allowed disabled:opacity-45 sm:px-4"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Anterior
      </button>

      <p className="text-sm text-ink-muted" aria-live="polite">
        Página <span className="font-semibold text-ink">{page}</span> de{' '}
        {totalPages}
      </p>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-brand-900 disabled:cursor-not-allowed disabled:opacity-45 sm:px-4"
      >
        Siguiente
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  )
}
