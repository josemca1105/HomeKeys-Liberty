import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query'
import { normalizeApiError } from '@/api/errors'
import {
  fetchAgentDirectory,
  fetchProperties,
  fetchProperty,
} from './property.api'
import type {
  AgentDirectoryEntry,
  PropertyFilters,
} from './property.types'

export const propertyQueryKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyQueryKeys.all, 'list'] as const,
  list: (filters: PropertyFilters) =>
    [...propertyQueryKeys.lists(), filters] as const,
  details: () => [...propertyQueryKeys.all, 'detail'] as const,
  detail: (propertyId: number) =>
    [...propertyQueryKeys.details(), propertyId] as const,
}

const agentDirectoryQueryKey = ['users', 'agent-directory'] as const

function shouldRetry(failureCount: number, error: unknown): boolean {
  const apiError = normalizeApiError(error)

  if (
    apiError.status === 400 ||
    apiError.status === 401 ||
    apiError.status === 403 ||
    apiError.status === 404
  ) {
    return false
  }

  return failureCount < 1
}

export function usePropertiesQuery(filters: PropertyFilters) {
  return useQuery({
    queryKey: propertyQueryKeys.list(filters),
    queryFn: ({ signal }) => fetchProperties(filters, signal),
    placeholderData: keepPreviousData,
    retry: shouldRetry,
    staleTime: 20_000,
  })
}

export function usePropertyQuery(propertyId: number | null) {
  return useQuery({
    queryKey: propertyQueryKeys.detail(propertyId ?? 0),
    queryFn: ({ signal }) => fetchProperty(propertyId as number, signal),
    enabled: propertyId !== null,
    retry: shouldRetry,
    staleTime: 20_000,
  })
}

export function useAgentDirectoryQuery(enabled: boolean) {
  return useQuery({
    queryKey: agentDirectoryQueryKey,
    queryFn: ({ signal }) => fetchAgentDirectory(signal),
    enabled,
    retry: shouldRetry,
    staleTime: 5 * 60_000,
  })
}

export function toAgentDirectory(
  agents: AgentDirectoryEntry[] | undefined,
): Map<number, AgentDirectoryEntry> {
  if (!agents) {
    return new Map()
  }

  return new Map(agents.map((agent) => [agent.id, agent]))
}
