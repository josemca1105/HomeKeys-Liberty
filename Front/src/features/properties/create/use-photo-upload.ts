import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeApiError } from '@/api/errors'
import {
  confirmBatchPhoto,
  createPhotoBatch,
  deleteBatchPhoto,
  requestPhotoUpload,
  uploadPhotoBinary,
  validatePhotoSelection,
  type PhotoFileIssue,
} from './create-property.api'

export type PendingPhotoStatus =
  | 'queued'
  | 'uploading'
  | 'confirming'
  | 'ready'
  | 'error'

export interface PendingPhoto {
  localId: string
  file: File
  previewUrl: string
  status: PendingPhotoStatus
  progress: number
  uploadId?: string
  storageKey?: string
  error?: string
}

interface PhotoBatchState {
  id: string
  expiresAt: string
}

export interface PhotoUploadController {
  photos: PendingPhoto[]
  readyPhotos: PendingPhoto[]
  batch: PhotoBatchState | null
  coverUploadId: string | null
  isProcessing: boolean
  removingLocalId: string | null
  issues: PhotoFileIssue[]
  globalError: string | null
  canAddPhotos: boolean
  hasMinimumPhotos: boolean
  addFiles: (files: File[]) => Promise<void>
  retryPhoto: (localId: string) => Promise<void>
  removePhoto: (localId: string) => Promise<void>
  selectCover: (uploadId: string) => void
  reset: () => void
  clearIssues: () => void
  clearGlobalError: () => void
}

let localPhotoSequence = 0

export function createPhotoLocalId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  localPhotoSequence += 1
  return `photo-${Date.now().toString(36)}-${localPhotoSequence}`
}

export function usePhotoUpload(): PhotoUploadController {
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [batch, setBatch] = useState<PhotoBatchState | null>(null)
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [removingLocalId, setRemovingLocalId] = useState<string | null>(null)
  const [issues, setIssues] = useState<PhotoFileIssue[]>([])
  const [globalError, setGlobalError] = useState<string | null>(null)

  const photosRef = useRef<PendingPhoto[]>([])
  const previewUrlsRef = useRef<Set<string>>(new Set())
  const isMountedRef = useRef(true)
  const isBusyRef = useRef(false)
  const batchRef = useRef<PhotoBatchState | null>(null)

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

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

  const updatePhoto = useCallback(
    (localId: string, changes: Partial<PendingPhoto>) => {
      if (!isMountedRef.current) {
        return
      }

      setPhotos((current) =>
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

  const uploadSingle = useCallback(
    async (photo: PendingPhoto, batchId: string) => {
      updatePhoto(photo.localId, {
        status: 'uploading',
        progress: 0,
        error: undefined,
      })

      try {
        const target = await requestPhotoUpload(batchId, photo.file)

        if (!isMountedRef.current) {
          return
        }

        updatePhoto(photo.localId, {
          storageKey: target.storageKey,
        })

        await uploadPhotoBinary(target, photo.file, (progress) => {
          updatePhoto(photo.localId, { progress })
        })

        if (!isMountedRef.current) {
          return
        }

        updatePhoto(photo.localId, {
          status: 'confirming',
          progress: 100,
        })

        const confirmed = await confirmBatchPhoto(
          batchId,
          target,
          photo.file,
        )

        updatePhoto(photo.localId, {
          status: 'ready',
          progress: 100,
          uploadId: confirmed.id,
          storageKey: target.storageKey,
          error: undefined,
        })
      } catch (error) {
        const apiError = normalizeApiError(error)

        updatePhoto(photo.localId, {
          status: 'error',
          error: apiError.message,
        })
      }
    },
    [updatePhoto],
  )

  const addFiles = useCallback(
    async (files: File[]) => {
      if (isBusyRef.current) {
        setGlobalError('Espera a que termine la carga actual.')
        return
      }

      if (
        batchRef.current &&
        new Date(batchRef.current.expiresAt).getTime() <= Date.now()
      ) {
        setGlobalError(
          'El lote de fotografías expiró. Reinicia la selección e inténtalo nuevamente.',
        )
        return
      }

      const selection = validatePhotoSelection(
        files,
        photosRef.current.length,
      )
      setIssues(selection.issues)
      setGlobalError(null)

      if (selection.validFiles.length === 0) {
        return
      }

      const newPhotos: PendingPhoto[] = []

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

      setPhotos((current) => [...current, ...newPhotos])
      isBusyRef.current = true
      setIsProcessing(true)

      try {
        let activeBatch = batchRef.current

        if (!activeBatch) {
          const createdBatch = await createPhotoBatch()
          activeBatch = {
            id: createdBatch.id,
            expiresAt: createdBatch.expiresAt,
          }
          batchRef.current = activeBatch
          setBatch(activeBatch)
        }

        const queue = [...newPhotos]

        const worker = async (): Promise<void> => {
          while (queue.length > 0) {
            const nextPhoto = queue.shift()

            if (!nextPhoto) {
              return
            }

            await uploadSingle(nextPhoto, activeBatch.id)
          }
        }

        await Promise.all([worker(), worker()])
      } catch (error) {
        const apiError = normalizeApiError(error)
        setGlobalError(apiError.message)

        if (isMountedRef.current) {
          setPhotos((current) =>
            current.map((photo) =>
              newPhotos.some((newPhoto) => newPhoto.localId === photo.localId) &&
              photo.status !== 'ready'
                ? {
                    ...photo,
                    status: 'error',
                    error: apiError.message,
                  }
                : photo,
            ),
          )
        }
      } finally {
        isBusyRef.current = false

        if (isMountedRef.current) {
          setIsProcessing(false)
        }
      }
    },
    [revokePreview, uploadSingle],
  )

  const retryPhoto = useCallback(
    async (localId: string) => {
      if (isBusyRef.current) {
        setGlobalError('Espera a que termine la carga actual.')
        return
      }

      const photo = photosRef.current.find((item) => item.localId === localId)
      const activeBatch = batchRef.current

      if (!photo || !activeBatch) {
        setGlobalError('No hay un lote activo para reintentar esta fotografía.')
        return
      }

      if (new Date(activeBatch.expiresAt).getTime() <= Date.now()) {
        setGlobalError(
          'El lote de fotografías expiró. Reinicia la selección e inténtalo nuevamente.',
        )
        return
      }

      isBusyRef.current = true
      setIsProcessing(true)
      setGlobalError(null)

      try {
        await uploadSingle(photo, activeBatch.id)
      } finally {
        isBusyRef.current = false

        if (isMountedRef.current) {
          setIsProcessing(false)
        }
      }
    },
    [uploadSingle],
  )

  const removePhoto = useCallback(
    async (localId: string) => {
      if (isProcessing) {
        setGlobalError('Espera a que termine la carga actual.')
        return
      }

      const photo = photosRef.current.find((item) => item.localId === localId)

      if (!photo) {
        return
      }

      setRemovingLocalId(localId)
      setGlobalError(null)

      try {
        if (photo.uploadId && batchRef.current) {
          await deleteBatchPhoto(batchRef.current.id, photo.uploadId)
        }

        revokePreview(photo.previewUrl)
        setPhotos((current) =>
          current.filter((item) => item.localId !== localId),
        )
      } catch (error) {
        setGlobalError(normalizeApiError(error).message)
      } finally {
        if (isMountedRef.current) {
          setRemovingLocalId(null)
        }
      }
    },
    [isProcessing, revokePreview],
  )

  const selectCover = useCallback((uploadId: string) => {
    setSelectedCoverId(uploadId)
  }, [])

  const reset = useCallback(() => {
    for (const photo of photosRef.current) {
      revokePreview(photo.previewUrl)
    }

    setPhotos([])
    setBatch(null)
    setSelectedCoverId(null)
    setIssues([])
    setGlobalError(null)
    setRemovingLocalId(null)
    batchRef.current = null
    photosRef.current = []
  }, [revokePreview])

  const clearIssues = useCallback(() => {
    setIssues([])
  }, [])

  const clearGlobalError = useCallback(() => {
    setGlobalError(null)
  }, [])

  const readyPhotos = useMemo(
    () => photos.filter((photo) => photo.status === 'ready'),
    [photos],
  )

  const coverUploadId = useMemo(() => {
    if (
      selectedCoverId &&
      readyPhotos.some((photo) => photo.uploadId === selectedCoverId)
    ) {
      return selectedCoverId
    }

    return readyPhotos[0]?.uploadId ?? null
  }, [readyPhotos, selectedCoverId])

  const isUploading = photos.some(
    (photo) =>
      photo.status === 'queued' ||
      photo.status === 'uploading' ||
      photo.status === 'confirming',
  )

  return {
    photos,
    readyPhotos,
    batch,
    coverUploadId,
    isProcessing: isProcessing || isUploading,
    removingLocalId,
    issues,
    globalError,
    canAddPhotos: photos.length < 20,
    hasMinimumPhotos: readyPhotos.length >= 5,
    addFiles,
    retryPhoto,
    removePhoto,
    selectCover,
    reset,
    clearIssues,
    clearGlobalError,
  }
}
