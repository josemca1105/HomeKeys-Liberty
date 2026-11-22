export function PropertyCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-line bg-white"
      aria-hidden="true"
    >
      <div className="aspect-[16/10] animate-pulse bg-brand-950/[0.06]" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-surface" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-surface" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-surface" />
        <div className="h-7 w-32 animate-pulse rounded bg-surface" />
        <div className="h-9 animate-pulse rounded bg-surface" />
      </div>
    </div>
  )
}
