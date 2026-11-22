import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-700 text-white shadow-[0_14px_30px_-18px_rgb(7_91_158/0.8)] hover:bg-brand-800',
        secondary:
          'border border-line bg-white text-brand-900 hover:border-brand-600/40 hover:bg-surface',
        quiet:
          'text-ink-muted hover:bg-white/10 hover:text-white focus-visible:outline-white',
      },
      size: {
        default: 'h-12 px-5 sm:h-11',
        sm: 'h-12 px-3.5 text-sm sm:h-9',
        lg: 'h-12 px-6 text-base',
        icon: 'size-12 p-0 sm:size-10',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  loadingLabel?: ReactNode
}

export function Button({
  children,
  className,
  disabled,
  fullWidth,
  isLoading = false,
  loadingLabel = 'Procesando…',
  size,
  type = 'button',
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
