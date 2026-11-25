import type { AuditLog, AuditScope } from './audit.types'
import { USER_ROLE_LABELS } from '@/features/users/user-labels'

export { USER_ROLE_LABELS }

export const AUDIT_SCOPE_LABELS: Record<AuditScope, string> = {
  SECURITY: 'Seguridad',
  BUSINESS: 'Negocio',
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  USER: 'Usuario',
  PROPERTY: 'Captación',
}

export const AUDIT_ENTITY_TYPE_OPTIONS: readonly string[] = [
  'USER',
  'PROPERTY',
]

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Inicio de sesión',
  LOGIN_FAILED: 'Intento de acceso fallido',
  ACCOUNT_LOCKED: 'Cuenta bloqueada por intentos fallidos',
  LOGOUT: 'Cierre de sesión',
  PASSWORD_CHANGED: 'Contraseña cambiada',
  PASSWORD_RESET: 'Contraseña restablecida con enlace',
  PASSWORD_RESET_REQUESTED: 'Recuperación de contraseña solicitada',
  // Part of the backend union though no flow emits it yet; keep a label so a
  // future event renders in Spanish instead of its raw code.
  USER_PASSWORD_RESET: 'Contraseña restablecida (administración)',
  PASSWORD_RESET_LINK_SENT: 'Enlace de restablecimiento enviado',
  INVITATION_RESENT: 'Invitación reenviada',
  USER_CREATED: 'Usuario invitado',
  USER_UPDATED: 'Usuario actualizado',
  USER_DEACTIVATED: 'Cuenta desactivada',
  USER_REACTIVATED: 'Cuenta reactivada',
  USER_DELETED: 'Usuario eliminado',
  PROPERTY_CREATED: 'Captación creada',
  PROPERTY_UPDATED: 'Captación actualizada',
  PROPERTY_STATUS_CHANGED: 'Estado de captación cambiado',
  PROPERTY_REASSIGNED: 'Captación reasignada',
  PROPERTY_DELETED: 'Captación eliminada',
  PROPERTY_PHOTOS_ATTACHED: 'Fotografías adjuntadas',
  PROPERTY_PHOTO_ADDED: 'Fotografía agregada',
  PROPERTY_PHOTO_DELETED: 'Fotografía eliminada',
  PROPERTY_PHOTOS_REORDERED: 'Fotografías reordenadas',
  PROPERTY_PHOTO_COVER_CHANGED: 'Portada actualizada',
}

export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

export interface AuditActionGroup {
  label: string
  actions: string[]
}

export const AUDIT_ACTION_GROUPS: readonly AuditActionGroup[] = [
  {
    label: 'Sesión y contraseñas',
    actions: [
      'LOGIN_SUCCEEDED',
      'LOGIN_FAILED',
      'ACCOUNT_LOCKED',
      'LOGOUT',
      'PASSWORD_CHANGED',
      'PASSWORD_RESET',
      'PASSWORD_RESET_REQUESTED',
      'USER_PASSWORD_RESET',
      'PASSWORD_RESET_LINK_SENT',
      'INVITATION_RESENT',
    ],
  },
  {
    label: 'Usuarios',
    actions: [
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DEACTIVATED',
      'USER_REACTIVATED',
      'USER_DELETED',
    ],
  },
  {
    label: 'Captaciones y fotografías',
    actions: [
      'PROPERTY_CREATED',
      'PROPERTY_UPDATED',
      'PROPERTY_STATUS_CHANGED',
      'PROPERTY_REASSIGNED',
      'PROPERTY_DELETED',
      'PROPERTY_PHOTOS_ATTACHED',
      'PROPERTY_PHOTO_ADDED',
      'PROPERTY_PHOTO_DELETED',
      'PROPERTY_PHOTOS_REORDERED',
      'PROPERTY_PHOTO_COVER_CHANGED',
    ],
  },
]

export function formatAuditTimestamp(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatAuditChangeValue(value: unknown): string {
  if (value === null) {
    return '—'
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value)
}

export function getAuditEntityRoute(
  log: Pick<AuditLog, 'entityType' | 'entityId'>,
): string | null {
  if (!log.entityType || log.entityId === null || log.entityId === undefined) {
    return null
  }

  if (log.entityType === 'PROPERTY') {
    return `/captaciones/${log.entityId}`
  }

  if (log.entityType === 'USER') {
    return `/usuarios/${log.entityId}`
  }

  return null
}
