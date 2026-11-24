import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deletePropertyPhoto,
  reorderPropertyPhotos,
  setPropertyPhotoCover,
} from '../property-photo.api'
import { propertyQueryKeys } from '../property-queries'

export function usePropertyPhotoActions(propertyId: number) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: propertyQueryKeys.detail(propertyId),
    })
    void queryClient.invalidateQueries({
      queryKey: propertyQueryKeys.lists(),
    })
  }

  const reorder = useMutation({
    mutationFn: (photoIds: number[]) =>
      reorderPropertyPhotos(propertyId, photoIds),
    onSuccess: invalidate,
  })

  const setCover = useMutation({
    mutationFn: (photoId: number) =>
      setPropertyPhotoCover(propertyId, photoId),
    onSuccess: invalidate,
  })

  const removePhoto = useMutation({
    mutationFn: (photoId: number) =>
      deletePropertyPhoto(propertyId, photoId),
    onSuccess: invalidate,
  })

  return { reorder, setCover, removePhoto }
}
