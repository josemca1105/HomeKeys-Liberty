import logoUrl from '@/assets/brand/logo.png'
import { env } from '@/config/env'
import { cn } from '@/lib/cn'

const sizeClasses = {
  sm: 'size-14 rounded-2xl p-1.5',
  md: 'size-20 rounded-[24px] p-1.5',
  lg: 'size-32 rounded-[34px] p-2',
} as const

interface BrandLogoProps {
  size?: keyof typeof sizeClasses
  className?: string
}

export function BrandLogo({ size = 'md', className }: BrandLogoProps) {
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden bg-white shadow-[0_18px_45px_-24px_rgb(0_0_0/0.65)] ring-1 ring-white/20',
        sizeClasses[size],
        className,
      )}
    >
      <img
        src={logoUrl}
        alt={`Logotipo de ${env.appName}`}
        className="size-full object-contain"
      />
    </div>
  )
}
