import type { User } from '../user.types'
import { USER_ROLE_LABELS } from '../user-labels'
import { cn } from '@/lib/cn'

type UserBadgeUser = Pick<User, 'role' | 'isActive' | 'mustChangePassword'>

export function UserRoleBadge({ role }: { role: User['role'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        role === 'ADMIN'
          ? 'border-brand-cyan/30 bg-[#eaf9fc] text-brand-cyan-ink'
          : 'border-[#bfe5d2] bg-[#effaf4] text-[#176444]',
      )}
    >
      {USER_ROLE_LABELS[role]}
    </span>
  )
}

export function UserStatusBadges({ user }: { user: UserBadgeUser }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
          user.isActive
            ? 'border-[#bfe5d2] bg-[#effaf4] text-[#176444]'
            : 'border-[#e7b2ae] bg-[#fff7f6] text-[#842e28]',
        )}
      >
        {user.isActive ? 'Activa' : 'Inactiva'}
      </span>
      {user.mustChangePassword ? (
        <span className="inline-flex items-center rounded-full border border-[#f2dcae] bg-[#fff7dc] px-2.5 py-1 text-xs font-semibold text-[#725b0a]">
          Invitación pendiente
        </span>
      ) : null}
    </span>
  )
}
