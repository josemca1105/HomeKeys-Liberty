import { AlertTriangle, CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AuthNotice } from '@/features/auth/auth.types'
import { cn } from '@/lib/cn'

const COUNTDOWN_TICK_MS = 200

const toneClasses = {
  warning: 'border-brand-gold/55 bg-[#fff9e5] text-[#66520a]',
  success: 'border-[#8fcfb4] bg-[#effaf4] text-[#175b3d]',
  error: 'border-[#e7b2ae] bg-[#fff4f3] text-[#842e28]',
} as const

const progressClasses = {
  warning: 'bg-brand-gold',
  success: 'bg-[#238b62]',
  error: 'bg-[#b04840]',
} as const

const toneIcons = {
  warning: AlertTriangle,
  success: CheckCircle2,
  error: CircleAlert,
} as const

interface NoticeProps {
  notice: AuthNotice
  className?: string
  autoDismissMs?: number
  onDismiss?: () => void
}

export function Notice({
  notice,
  className,
  autoDismissMs,
  onDismiss,
}: NoticeProps) {
  const Icon = toneIcons[notice.tone]
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    autoDismissMs ? Math.ceil(autoDismissMs / 1000) : 0,
  )
  const [progress, setProgress] = useState(100)
  const dismissRef = useRef(onDismiss)
  const remainingMsRef = useRef(autoDismissMs ?? 0)
  const lastTickRef = useRef(0)
  const isPausedRef = useRef(false)

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!autoDismissMs) {
      return
    }

    lastTickRef.current = Date.now()

    const countdown = window.setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastTickRef.current
      lastTickRef.current = now

      if (isPausedRef.current) {
        return
      }

      remainingMsRef.current = Math.max(remainingMsRef.current - elapsed, 0)

      const nextProgress = (remainingMsRef.current / autoDismissMs) * 100
      setProgress(nextProgress)
      setRemainingSeconds(Math.ceil(remainingMsRef.current / 1000))

      if (remainingMsRef.current === 0) {
        window.clearInterval(countdown)
        dismissRef.current?.()
      }
    }, COUNTDOWN_TICK_MS)

    return () => {
      window.clearInterval(countdown)
    }
  }, [autoDismissMs])

  const pauseCountdown = () => {
    if (!autoDismissMs) {
      return
    }

    isPausedRef.current = true
    lastTickRef.current = Date.now()
  }

  const resumeCountdown = () => {
    if (!autoDismissMs) {
      return
    }

    lastTickRef.current = Date.now()
    isPausedRef.current = false
  }

  return (
    <div
      role={notice.tone === 'success' ? 'status' : 'alert'}
      className={cn(
        'rounded-xl border px-4 py-3 text-sm leading-6',
        toneClasses[notice.tone],
        className,
      )}
      onPointerDown={pauseCountdown}
      onPointerUp={resumeCountdown}
      onPointerCancel={resumeCountdown}
      onFocus={pauseCountdown}
      onBlur={resumeCountdown}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1">{notice.message}</p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="-my-2 -mr-2 grid size-12 shrink-0 place-items-center rounded-lg opacity-70 transition-opacity hover:bg-black/[0.05] hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {autoDismissMs ? (
        <div className="mt-2 flex items-center gap-3 pl-7">
          <div
            role="progressbar"
            aria-label="Tiempo restante antes de cerrar el aviso"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="h-1 flex-1 overflow-hidden rounded-full bg-black/10"
          >
            <span
              aria-hidden="true"
              className={cn(
                'block h-full rounded-full transition-[width] duration-200 ease-linear',
                progressClasses[notice.tone],
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span
            aria-hidden="true"
            className="min-w-7 text-right text-xs font-semibold tabular-nums"
          >
            {remainingSeconds} s
          </span>
        </div>
      ) : null}
    </div>
  )
}
