import type {
  ListingType,
  Property,
  PropertyPhoto,
  PropertyStatus,
  PropertyType,
} from './property.types'

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: 'Casa',
  APARTMENT: 'Apartamento',
  TOWNHOUSE: 'Townhouse',
  LAND: 'Terreno',
  COMMERCIAL: 'Local comercial',
  OFFICE: 'Oficina',
  WAREHOUSE: 'Galpón',
  FARM: 'Finca',
}

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  SALE: 'Venta',
  RENT: 'Alquiler',
}

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  CLOSED: 'Cerrada',
}

export const PROPERTY_STATUS_CLASSES: Record<PropertyStatus, string> = {
  ACTIVE: 'border-[#9fd6bd] bg-[#edf9f3] text-[#176444]',
  PAUSED: 'border-[#e5d28a] bg-[#fff8df] text-[#715a09]',
  CLOSED: 'border-[#c8d5da] bg-[#f1f5f6] text-[#4c626d]',
}

export const AMENITIES = [
  { key: 'hasWaterTank', label: 'Tanque de agua' },
  { key: 'hasPowerPlant', label: 'Planta eléctrica' },
  { key: 'isFurnished', label: 'Amueblado' },
  { key: 'allowsPets', label: 'Admite mascotas' },
  { key: 'hasPool', label: 'Piscina' },
  { key: 'hasGym', label: 'Gimnasio' },
  { key: 'hasBalcony', label: 'Balcón' },
  { key: 'hasAirConditioning', label: 'Aire acondicionado' },
  { key: 'hasSecurity', label: 'Seguridad' },
  { key: 'hasElevator', label: 'Ascensor' },
] as const satisfies ReadonlyArray<{
  key: keyof Property
  label: string
}>

const decimalFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatUsd(value: string | null): string {
  if (value === null) {
    return 'No indicado'
  }

  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return value
  }

  return `$${decimalFormatter.format(amount)}`
}

export function formatArea(value: string | null): string {
  if (value === null) {
    return 'No indicada'
  }

  const area = Number(value)

  return Number.isFinite(area)
    ? `${decimalFormatter.format(area)} m²`
    : value
}

export function formatShortDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatLongDate(value: string | null): string {
  if (value === null) {
    return 'No disponible'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return new Intl.DateTimeFormat('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function getPropertyLocation(property: Property): string {
  return [property.neighborhood, property.city, property.state]
    .filter(Boolean)
    .join(', ')
}

export function getCoverPhoto(property: Property): PropertyPhoto | null {
  return (
    property.photos.find((photo) => photo.isCover) ??
    property.photos[0] ??
    null
  )
}

export function getAgentDisplayName(
  agentId: number,
  currentUserId: number,
  currentUserName: string,
  agents: Map<number, { firstName: string; lastName: string }>,
): string {
  if (agentId === currentUserId) {
    return currentUserName
  }

  const agent = agents.get(agentId)

  return agent ? `${agent.firstName} ${agent.lastName}` : `Agente #${agentId}`
}

export function getOpenStreetMapUrl(property: Property): string {
  const { latitude, longitude } = property

  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
}
