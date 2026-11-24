import { apiClient } from '@/api/client'
import type { components } from '@/api/generated/schema'
import type {
  PhotoUploadTarget,
  PropertyPhoto,
} from './property.types'

type PhotoUploadTargetRequest =
  components['schemas']['PhotoUploadTargetRequest']
type PhotoUploadTargetResponse =
  components['schemas']['PhotoUploadTargetResponse']
type PhotoResponse = components['schemas']['PhotoResponse']
type PhotoListResponse = components['schemas']['PhotoListResponse']
type DeletePhotoResponse = components['schemas']['DeletePhotoResponse']

export async function requestPropertyPhotoUpload(
  propertyId: number,
  file: File,
): Promise<PhotoUploadTarget> {
  const response = await apiClient.post<PhotoUploadTargetResponse>(
    `/properties/${propertyId}/photos/upload-url`,
    {
      mimeType: file.type as PhotoUploadTargetRequest['mimeType'],
      sizeBytes: file.size,
    },
  )

  return response.data.data.upload
}

export async function confirmPropertyPhoto(
  propertyId: number,
  target: PhotoUploadTarget,
  file: File,
): Promise<PropertyPhoto> {
  const response = await apiClient.post<PhotoResponse>(
    `/properties/${propertyId}/photos/confirm`,
    {
      storageKey: target.storageKey,
      altText: file.name.replace(/\.[^.]+$/, '').slice(0, 300),
    },
  )

  return response.data.data.photo
}

export async function reorderPropertyPhotos(
  propertyId: number,
  photoIds: number[],
): Promise<PropertyPhoto[]> {
  const response = await apiClient.patch<PhotoListResponse>(
    `/properties/${propertyId}/photos/order`,
    { photoIds },
  )

  return response.data.data.photos
}

export async function setPropertyPhotoCover(
  propertyId: number,
  photoId: number,
): Promise<PropertyPhoto> {
  const response = await apiClient.patch<PhotoResponse>(
    `/properties/${propertyId}/photos/${photoId}/cover`,
  )

  return response.data.data.photo
}

export async function deletePropertyPhoto(
  propertyId: number,
  photoId: number,
): Promise<number> {
  const response = await apiClient.delete<DeletePhotoResponse>(
    `/properties/${propertyId}/photos/${photoId}`,
  )

  return response.data.data.deletedId
}
