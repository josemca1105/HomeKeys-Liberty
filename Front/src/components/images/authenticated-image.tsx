import { useQuery } from '@tanstack/react-query'
import { Building2, ImageOff, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/api/client'
import { resolveApiResourceUrl } from '@/api/resource-url'
import { useNearViewport } from '@/hooks/use-near-viewport'
import { cn } from '@/lib/cn'

interface AuthenticatedImageProps {
  src: string
  alt: string
  className?: string
  eager?: boolean
}

export function AuthenticatedImage({
  src,
  alt,
  className,
  eager = false,
}: AuthenticatedImageProps) {
  const { ref, isNearViewport } = useNearViewport<HTMLDivElement>(eager)
  const resolvedUrl = useMemo(() => resolveApiResourceUrl(src), [src])
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  const imageQuery = useQuery({
    queryKey: ['authenticated-image', resolvedUrl],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<Blob>(resolvedUrl, {
        responseType: 'blob',
        signal,
      })

      return response.data
    },
    enabled: isNearViewport,
    staleTime: 10 * 60_000,
    retry: 1,
  })

  useEffect(() => {
    if (!imageQuery.data) {
      return
    }

    const nextObjectUrl = URL.createObjectURL(imageQuery.data)
    // The browser object URL is external state derived from the fetched Blob.
    // oxlint-disable-next-line react/set-state-in-effect
    setObjectUrl(nextObjectUrl)

    return () => {
      URL.revokeObjectURL(nextObjectUrl)
    }
  }, [imageQuery.data])

  const showImage = isNearViewport && objectUrl && !imageQuery.isError
  const showLoading = isNearViewport && imageQuery.isPending
  const showError = isNearViewport && imageQuery.isError

  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden bg-brand-950/[0.06]',
        className,
      )}
    >
      {showImage ? (
        <img
          src={objectUrl}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid size-full place-items-center text-brand-slate/55"
        >
          {showLoading ? (
            <LoaderCircle className="size-6 animate-spin" />
          ) : showError ? (
            <ImageOff className="size-6" />
          ) : (
            <Building2 className="size-6" />
          )}
        </div>
      )}
    </div>
  )
}
