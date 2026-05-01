import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export interface UploadEntry {
  file: File
  type: 'camera' | 'front' | 'back' | 'screenshot' | 'video' | 'document'
  /** Object URL for image previews -- revoked on removal */
  previewUrl?: string
}

/**
 * Shared hook for media upload + camera capture logic.
 *
 * Previously duplicated across ProofSubmission and ShameProofSubmission
 * (~200 lines of identical camera, photo picker, file handling, and
 * viewfinder state in each file).
 */
export function useProofUpload() {
  const [uploadFiles, setUploadFiles] = useState<UploadEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [nativeCapturing, setNativeCapturing] = useState(false)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const nativeVideoInputRef = useRef<HTMLInputElement>(null)
  const nativeDocInputRef = useRef<HTMLInputElement>(null)

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      uploadFiles.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl)
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const addFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: UploadEntry['type']) => {
      const fileList = e.target.files
      if (!fileList || fileList.length === 0) return
      const newEntries: UploadEntry[] = Array.from(fileList).map((file) => {
        const entry: UploadEntry = { file, type }
        if (file.type.startsWith('image/')) entry.previewUrl = URL.createObjectURL(file)
        return entry
      })
      setUploadFiles((prev) => [...prev, ...newEntries])
      setError(null)
      e.target.value = ''
    },
    [],
  )

  const removeFile = useCallback((idx: number) => {
    setUploadFiles((prev) => {
      const removed = prev[idx]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const openCamera = useCallback(
    async (source: CameraSource = CameraSource.Camera) => {
      if (Capacitor.isNativePlatform()) {
        const permissions = await CapCamera.requestPermissions({ permissions: ['camera', 'photos'] })
        if (permissions.camera === 'denied' && permissions.photos === 'denied') {
          setError('Please allow camera or photo access in Settings to submit proof.')
          return
        }
        setNativeCapturing(true)
        try {
          const photo = await CapCamera.getPhoto({
            quality: 85,
            allowEditing: false,
            resultType: CameraResultType.Uri,
            source,
          })
          const response = await fetch(photo.webPath!)
          const blob = await response.blob()
          const file = new File([blob], `photo_${Date.now()}.${photo.format || 'jpg'}`, { type: blob.type })
          const previewUrl = URL.createObjectURL(blob)
          setUploadFiles((prev) => [...prev, { file, type: source === CameraSource.Camera ? 'camera' : 'screenshot', previewUrl }])
          setError(null)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : ''
          if (!(msg.includes('cancelled') || msg.includes('cancel'))) {
            setError('Failed to capture photo. Please try again.')
          }
        } finally {
          setNativeCapturing(false)
        }
        return
      }
      // Web fallback: use getUserMedia
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } })
        streamRef.current = stream
        setCameraOpen(true)
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play()
          }
        })
      } catch {
        cameraInputRef.current?.click()
      }
    },
    [facingMode],
  )

  const handlePhotosPick = useCallback(
    async (source: CameraSource = CameraSource.Photos) => {
      if (!Capacitor.isNativePlatform()) {
        photoInputRef.current?.click()
        return
      }
      const permissions = await CapCamera.requestPermissions({ permissions: ['camera', 'photos'] })
      if (permissions.camera === 'denied' && permissions.photos === 'denied') {
        setError('Please allow camera or photo access in Settings to submit proof.')
        return
      }
      setNativeCapturing(true)
      try {
        const photo = await CapCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source,
        })
        const response = await fetch(photo.webPath!)
        const blob = await response.blob()
        const file = new File([blob], `photo_${Date.now()}.${photo.format || 'jpg'}`, { type: blob.type })
        const previewUrl = URL.createObjectURL(blob)
        setUploadFiles((prev) => [...prev, { file, type: 'screenshot', previewUrl }])
        setError(null)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : ''
        if (!(msg.includes('cancelled') || msg.includes('cancel'))) {
          setError('Failed to pick photo. Please try again.')
        }
      } finally {
        setNativeCapturing(false)
      }
    },
    [],
  )

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }, [])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        setUploadFiles((prev) => [...prev, { file, type: 'screenshot', previewUrl }])
        setError(null)
        closeCamera()
      },
      'image/jpeg',
      0.9,
    )
  }, [closeCamera])

  const flipCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: next } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch(() => {})
  }, [facingMode])

  const clearError = useCallback(() => setError(null), [])

  const photoCount = uploadFiles.filter((u) => u.type === 'screenshot' || u.type === 'front' || u.type === 'back').length
  const videoCount = uploadFiles.filter((u) => u.type === 'video').length
  const docCount = uploadFiles.filter((u) => u.type === 'document').length
  const hasProof = uploadFiles.length > 0

  return {
    uploadFiles,
    error,
    setError,
    clearError,
    nativeCapturing,
    cameraOpen,
    facingMode,
    videoRef,
    photoInputRef,
    videoInputRef,
    docInputRef,
    cameraInputRef,
    nativeVideoInputRef,
    nativeDocInputRef,
    addFiles,
    removeFile,
    openCamera,
    handlePhotosPick,
    closeCamera,
    capturePhoto,
    flipCamera,
    photoCount,
    videoCount,
    docCount,
    hasProof,
  }
}
