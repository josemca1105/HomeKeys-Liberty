import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeApiError } from '@/api/errors'
import {
  MAX_PHOTOS,
  uploadPhotoBinary,
  validatePhotoSelection,
  type PhotoFileIssue,
} from '../create/create-property.api'
import { createPhotoLocalId } from '../create/use-photo-upload'
import {
  confirmPropertyPhoto,
  requestPropertyPhotoUpload,
} from '../property-photo.api'
import { propertyQueryKeys } from '../property-queries'
import type { Property } from '../property.types'

export type PendingPropertyPhotoStatus =
  | 'queued'
  | 'uploading'
  | 'confirming'
  | 'error'

export interface PendingPropertyPhoto {
  localId: string
  file: File
  previewUrl: string
  status: PendingPropertyPhotoStatus
  progress: number
  error?: string
}

export interface PropertyPhotoUploadController {
  pendingPhotos: PendingPropertyPhoto[]
  isProcessing: boolean
  canAddPhotos: boolean
  issues: PhotoFileIssue[]
  globalError: string | null
  addFiles: (files: File[]) => Promise<void>
  retryPhoto: (localId: string) => Promise<void>
  removePending: (localId: string) => void
  clearIssues: () => void
  clearGlobalError: () => void
}

export function usePropertyPhotoUpload(
  propertyId: number,
  existingCount: number,
): PropertyPhotoUploadController {
  const queryClient = useQueryClient()
  const [pendingPhotos, setPendingPhotos] = useState<
    PendingPropertyPhoto[]
  >([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [issues, setIssues] = useState<PhotoFileIssue[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)

  const pendingRef = useRef<PendingPropertyPhoto[]>([])
  const previewUrlsRef = useRef<Set<string>>(new Set())
  const isMountedRef = useRef(true)
  const isBusyRef = useRef(false)

  useEffect(() => {
    pendingRef.current = pendingPhotos
  }, [pendingPhotos])

  const revokeAllPreviews = useCallback(() => {
    for (const previewUrl of previewUrlsRef.current) {
      URL.revokeObjectURL(previewUrl)
    }

    previewUrlsRef.current.clear()
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      revokeAllPreviews()
    }
  }, [revokeAllPreviews])

  const updatePending = useCallback(
    (localId: string, changes: Partial<PendingPropertyPhoto>) => {
      if (!isMountedRef.current) {
        return
      }

      setPendingPhotos((current) =>
        current.map((photo) =>
          photo.localId === localId ? { ...photo, ...changes } : photo,
        ),
      )
    },
    [],
  )

  const revokePreview = useCallback((previewUrl: string) => {
    URL.revokeObjectURL(previewUrl)
    previewUrlsRef.current.delete(previewUrl)
  }, [])

  const storeConfirmedPhoto = useCallback(
    (photo: Property['photos'][number]) => {
      queryClient.setQueryData<Property>(
        propertyQueryKeys.detail(propertyId),
        (current) =>
          current && !current.photos.some((item) => item.id === photo.id)
            ? { ...current, photos: [...current.photos, photo] }
            : current,
      )
      void queryClient.invalidateQueries({
        queryKey: propertyQueryKeys.detail(propertyId),
      })
      void queryClient.invalidateQueries({
        queryKey: propertyQueryKeys.lists(),
      })
    },
    [propertyId, queryClient],
  )

  const uploadSingle = useCallback(
    async (photo: PendingPropertyPhoto) => {
      updatePending(photo.localId, {
        status: 'uploading',
        progress: 0,
        error: undefined,
      })

      try {
        const target = await requestPropertyPhotoUpload(
          propertyId,
          photo.file,
        )

        await uploadPhotoBinary(target, photo.file, (progress) => {
          updatePending(photo.localId, { progress })
        })

        updatePending(photo.localId, {
          status: 'confirming',
          progress: 100,
        })

        const confirmed = await confirmPropertyPhoto(
          propertyId,
          target,
          photo.file,
        )

        storeConfirmedPhoto(confirmed)

        if (!isMountedRef.current) {
          return
        }

        setPendingPhotos((current) =>
          current.filter((item) => item.localId !== photo.localId),
        )
        revokePreview(photo.previewUrl)
      } catch (error) {
        updatePending(photo.localId, {
          status: 'error',
          error: normalizeApiError(error).message,
        })
      }
    },
    [
      propertyId,
      revokePreview,
      storeConfirmedPhoto,
      updatePending,
    ],
  )

  const addFiles = useCallback(
    async (files: File[]) => {
      if (isBusyRef.current) {
        setGlobalError('Espera a que termine la carga actual.')
        return
      }

      const selection = validatePhotoSelection(
        files,
        existingCount + pendingRef.current.length,
      )
      setIssues(selection.issues)
      setGlobalError(null)

      if (selection.validFiles.length === 0) {
        return
      }

      const newPhotos: PendingPropertyPhoto[] = []

      try {
        for (const file of selection.validFiles) {
          const localId = createPhotoLocalId()
          const previewUrl = URL.createObjectURL(file)
          previewUrlsRef.current.add(previewUrl)

          newPhotos.push({
            localId,
            file,
            previewUrl,
            status: 'queued',
            progress: 0,
          })
        }
      } catch {
        for (const photo of newPhotos) {
          revokePreview(photo.previewUrl)
        }
        setGlobalError(
          'No se pudieron preparar las fotografías seleccionadas. Intenta nuevamente.',
        )
        return
      }

      setPendingPhotos((current) => [...current, ...newPhotos])
      isBusyRef.current = true
      setIsProcessing(true)

      try {
        const queue = [...newPhotos]

        const worker = async (): Promise<void> => {
          while (queue.length > 0) {
            const nextPhoto = queue.shift()

            if (!nextPhoto) {
              return
            }

            await uploadSingle(nextPhoto)
          }
        }

        await Promise.all([worker(), worker()])
      } finally {
        isBusyRef.current = false

        if (isMountedRef.current) {
          setIsProcessing(false)
        }
      }
    },
    [existingCount, revokePreview, uploadSingle],
  )

  const retryPhoto = useCallback(
    async (localId: string) => {
      if (isBusyRef.current) {
        setGlobalError('Espera a que termine la carga actual.')
        return
      }

      const photo = pendingRef.current.find(
        (item) => item.localId === localId,
      )

      if (!photo) {
        return
      }

      isBusyRef.current = true
      setIsProcessing(true)
      setGlobalError(null)

      try {
        await uploadSingle(photo)
      } finally {
        isBusyRef.current = false

        if (isMountedRef.current) {
          setIsProcessing(false)
        }
      }
    },
    [uploadSingle],
  )

  const removePending = useCallback(
    (localId: string) => {
      if (isBusyRef.current) {
        setGlobalError('Espera a que termine la carga actual.')
        return
      }

      const photo = pendingRef.current.find(
        (item) => item.localId === localId,
      )

      if (!photo || photo.status !== 'error') {
        return
      }

      revokePreview(photo.previewUrl)
      setPendingPhotos((current) =>
        current.filter((item) => item.localId !== localId),
      )
    },
    [revokePreview],
  )

  const clearIssues = useCallback(() => {
    setIssues([])
  }, [])

  const clearGlobalError = useCallback(() => {
    setGlobalError(null)
  }, [])

  const isUploading = pendingPhotos.some(
    (photo) => photo.status !== 'error',
  )

  return {
    pendingPhotos,
    isProcessing: isProcessing || isUploading,
    canAddPhotos: existingCount + pendingPhotos.length < MAX_PHOTOS,
    issues,
    globalError,
    addFiles,
    retryPhoto,
    removePending,
    clearIssues,
    clearGlobalError,
  }
}
