import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteProperty, updateProperty } from './property.api'
import { propertyQueryKeys } from './property-queries'
import type { UpdatePropertyRequest } from './property.types'

interface UpdatePropertyVariables {
  propertyId: number
  input: UpdatePropertyRequest
}

export function useUpdatePropertyMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ propertyId, input }: UpdatePropertyVariables) =>
      updateProperty(propertyId, input),
    onSuccess: (property) => {
      queryClient.setQueryData(
        propertyQueryKeys.detail(property.id),
        property,
      )
      void queryClient.invalidateQueries({
        queryKey: propertyQueryKeys.lists(),
      })
      void queryClient.invalidateQueries({
        queryKey: propertyQueryKeys.details(),
      })
    },
  })
}

export function useDeletePropertyMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (propertyId: number) => deleteProperty(propertyId),
    onSuccess: (_deletedId, propertyId) => {
      queryClient.removeQueries({
        queryKey: propertyQueryKeys.detail(propertyId),
      })
      void queryClient.invalidateQueries({
        queryKey: propertyQueryKeys.lists(),
      })
    },
  })
}
