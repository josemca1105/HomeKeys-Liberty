import { useEffect, useRef, useState } from 'react'

interface UseNearViewportResult<T extends Element> {
  ref: React.RefObject<T | null>
  isNearViewport: boolean
}

export function useNearViewport<T extends Element>(
  eager = false,
  rootMargin = '350px',
): UseNearViewportResult<T> {
  const ref = useRef<T>(null)
  const [isNearViewport, setIsNearViewport] = useState(
    eager || typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    if (isNearViewport || !ref.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [isNearViewport, rootMargin])

  return { ref, isNearViewport }
}
