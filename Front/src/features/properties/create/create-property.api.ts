import axios from 'axios'
import { apiClient } from '@/api/client'
import type { components } from '@/api/generated/schema'
import { resolveApiResourceUrl } from '@/api/resource-url'
import type {
  CreatePropertyRequest,
  PhotoUploadTarget,
  PropertyPhotoBatch,
  PropertyPhotoUpload,
} from '../property.types'

type PhotoBatchResponse = components['schemas']['PhotoBatchResponse']
type PhotoUploadTargetResponse =
  components['schemas']['PhotoUploadTargetResponse']
type PhotoUploadResponse = components['schemas']['PhotoUploadResponse']
type PropertyResponse = components['schemas']['PropertyResponse']

export const MAX_PHOTOS = 20
export const MIN_PHOTOS = 5
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const ACCEPTED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

const directUploadClient = axios.create({
  timeout: 60_000,
})

export interface PhotoFileIssue {
  fileName: string
  message: string
}

export function validatePhotoSelection(
  files: File[],
  existingCount: number,
): { validFiles: File[]; issues: PhotoFileIssue[] } {
  const issues: PhotoFileIssue[] = []
  const validFiles: File[] = []
  let remainingSlots = MAX_PHOTOS - existingCount

  for (const file of files) {
    if (
      !(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)
    ) {
      issues.push({
        fileName: file.name,
        message: 'Solo se permiten imágenes JPEG, PNG o WebP.',
      })
      continue
    }

    if (file.size <= 0) {
      issues.push({ fileName: file.name, message: 'El archivo está vacío.' })
      continue
    }

    if (file.size > MAX_PHOTO_BYTES) {
      issues.push({
        fileName: file.name,
        message: 'La imagen supera el máximo de 8 MB.',
      })
      continue
    }

    if (remainingSlots <= 0) {
      issues.push({
        fileName: file.name,
        message: 'Ya alcanzaste el máximo de 20 fotografías.',
      })
      continue
    }

    validFiles.push(file)
    remainingSlots -= 1
  }

  return { validFiles, issues }
}

export async function createPhotoBatch(): Promise<PropertyPhotoBatch> {
  const response = await apiClient.post<PhotoBatchResponse>(
    '/property-photo-batches',
  )

  return response.data.data.batch
}

export async function requestPhotoUpload(
  batchId: string,
  file: File,
): Promise<PhotoUploadTarget> {
  const response = await apiClient.post<PhotoUploadTargetResponse>(
    `/property-photo-batches/${batchId}/photos/upload-url`,
    {
      mimeType: file.type,
      sizeBytes: file.size,
    },
  )

  return response.data.data.upload
}

export async function uploadPhotoBinary(
  target: PhotoUploadTarget,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  const uploadUrl = resolveApiResourceUrl(target.url)

  await directUploadClient.put(uploadUrl, file, {
    headers: target.headers,
    onUploadProgress: (event) => {
      if (!event.total) {
        return
      }

      onProgress(
        Math.min(100, Math.round((event.loaded / event.total) * 100)),
      )
    },
  })
}

export async function confirmBatchPhoto(
  batchId: string,
  target: PhotoUploadTarget,
  file: File,
): Promise<PropertyPhotoUpload> {
  const response = await apiClient.post<PhotoUploadResponse>(
    `/property-photo-batches/${batchId}/photos/confirm`,
    {
      storageKey: target.storageKey,
      altText: file.name.replace(/\.[^.]+$/, '').slice(0, 300),
    },
  )

  return response.data.data.upload
}

export async function deleteBatchPhoto(
  batchId: string,
  uploadId: string,
): Promise<void> {
  await apiClient.delete(
    `/property-photo-batches/${batchId}/photos/${uploadId}`,
  )
}

export async function createProperty(
  payload: CreatePropertyRequest,
): Promise<components['schemas']['Property']> {
  const response = await apiClient.post<PropertyResponse>(
    '/properties',
    payload,
  )

  return response.data.data.property
}
