import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Camera, Image, Video, FileText, X, CheckCircle, ChevronRight } from 'lucide-react'
import { useBetStore, useAuthStore } from '@/stores'
import { useProofStore } from '@/stores'
import type { ProofType, ProofRuling } from '@/lib/database.types'
import { PrimaryButton } from '../components/PrimaryButton'
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

interface UploadEntry {
  file: File
  type: 'camera' | 'screenshot' | 'video' | 'document'
  /** Object URL for image previews — revoked on removal */
  previewUrl?: string
}

interface ProofSubmissionProps {
  onSubmit?: () => void
  onBack?: () => void
}

export function ProofSubmission({ onSubmit, onBack }: ProofSubmissionProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const activeBet = useBetStore((s) => s.activeBet)
  const fetchBetDetail = useBetStore((s) => s.fetchBetDetail)

  const submitProof = useProofStore((s) => s.submitProof)
  const isSubmitting = useProofStore((s) => s.isSubmitting)
  const storeError = useProofStore((s) => s.error)

  // Is the current user the claimant (bet creator)?
  // Must also verify activeBet.id === id to guard against stale store state
  // while the correct bet is still loading.
  const isClaimant = !!user && !!activeBet && activeBet.id === id && activeBet.claimant_id === user.id

  // step: 'upload' → everyone uploads evidence
  //       'ruling' → claimant-only: declare YES or NO
  const [step, setStep] = useState<'upload' | 'ruling'>('upload')
  const [uploadFiles, setUploadFiles] = useState<UploadEntry[]>([])
  const [caption, setCaption] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [nativeCapturing, setNativeCapturing] = useState(false)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const nativeVideoInputRef = useRef<HTMLInputElement>(null)
  const nativeDocInputRef = useRef<HTMLInputElement>(null)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (id) fetchBetDetail(id)
  }, [id, fetchBetDetail])

  useEffect(() => {
    useProofStore.getState().clearError()
  }, [])

  useEffect(() => {
    return () => {
      uploadFiles.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl)
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: UploadEntry['type']) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const newEntries: UploadEntry[] = Array.from(fileList).map((file) => {
      const entry: UploadEntry = { file, type }
      if (file.type.startsWith('image/')) entry.previewUrl = URL.createObjectURL(file)
      return entry
    })
    setUploadFiles((prev) => [...prev, ...newEntries])
    setLocalError(null)
    e.target.value = ''
  }, [])

  const removeFile = useCallback((idx: number) => {
    setUploadFiles((prev) => {
      const removed = prev[idx]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const openCamera = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      const permissions = await CapCamera.requestPermissions({ permissions: ['camera', 'photos'] })
      if (permissions.camera === 'denied' && permissions.photos === 'denied') {
        setLocalError('Please allow camera or photo access in Settings to submit proof.')
        return
      }
      setNativeCapturing(true)
      try {
        const photo = await CapCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
        })
        const response = await fetch(photo.webPath!)
        const blob = await response.blob()
        const file = new File([blob], `photo_${Date.now()}.${photo.format || 'jpg'}`, { type: blob.type })
        const previewUrl = URL.createObjectURL(blob)
        setUploadFiles((prev) => [...prev, { file, type: 'camera', previewUrl }])
        setLocalError(null)
      } catch (err: any) {
        if (!(err?.message?.includes('cancelled') || err?.message?.includes('cancel'))) {
          setLocalError('Failed to capture photo. Please try again.')
        }
      } finally {
        setNativeCapturing(false)
      }
      return
    }
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
  }, [facingMode])

  const handlePhotosPick = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      // Must click synchronously — no await before this on web (Safari requirement)
      photoInputRef.current?.click()
      return
    }
    const permissions = await CapCamera.requestPermissions({ permissions: ['camera', 'photos'] })
    if (permissions.camera === 'denied' && permissions.photos === 'denied') {
      setLocalError('Please allow camera or photo access in Settings to submit proof.')
      return
    }
    setNativeCapturing(true)
    try {
      const photo = await CapCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      })
      const response = await fetch(photo.webPath!)
      const blob = await response.blob()
      const file = new File([blob], `photo_${Date.now()}.${photo.format || 'jpg'}`, { type: blob.type })
      const previewUrl = URL.createObjectURL(blob)
      setUploadFiles((prev) => [...prev, { file, type: 'screenshot', previewUrl }])
      setLocalError(null)
    } catch (err: any) {
      if (!(err?.message?.includes('cancelled') || err?.message?.includes('cancel'))) {
        setLocalError('Failed to pick photo. Please try again.')
      }
    } finally {
      setNativeCapturing(false)
    }
  }, [])

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
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const previewUrl = URL.createObjectURL(blob)
      setUploadFiles((prev) => [...prev, { file, type: 'screenshot', previewUrl }])
      setLocalError(null)
      closeCamera()
    }, 'image/jpeg', 0.9)
  }, [closeCamera])

  const flipCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    navigator.mediaDevices.getUserMedia({ video: { facingMode: next } }).then((stream) => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    }).catch(() => {})
  }, [facingMode])

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  /** Build the file object and determine proof type from current uploads */
  function buildFilesAndType() {
    const cameraFiles = uploadFiles.filter((u) => u.type === 'camera').map((u) => u.file)
    const screenshots = uploadFiles.filter((u) => u.type === 'screenshot').map((u) => u.file)
    const video = uploadFiles.find((u) => u.type === 'video')?.file
    const doc = uploadFiles.find((u) => u.type === 'document')?.file

    const files: {
      frontCameraFile?: File
      backCameraFile?: File
      screenshotFiles?: File[]
      videoFile?: File
      documentFile?: File
    } = {}
    if (cameraFiles.length) files.frontCameraFile = cameraFiles[0]
    if (screenshots.length) files.screenshotFiles = screenshots
    if (video) files.videoFile = video
    if (doc) files.documentFile = doc

    let proofType: ProofType = 'text'
    if (video) proofType = 'video'
    else if (doc) proofType = 'document'
    else if (screenshots.length) proofType = 'screenshot'
    else if (cameraFiles.length) proofType = 'camera'

    return { files, proofType }
  }

  /** Submit evidence only (non-claimant path, no ruling, no status change) */
  const handleSubmitEvidence = async () => {
    if (!id) return
    const hasFiles = uploadFiles.length > 0
    const hasCaption = caption.trim().length > 0
    if (!hasFiles && !hasCaption) {
      setLocalError('Add proof media or a text description.')
      return
    }
    setLocalError(null)
    const { files, proofType } = buildFilesAndType()
    const proof = await submitProof(id, files, proofType, caption.trim() || undefined)
    if (proof) {
      setSubmitted(true)
      if (onSubmit) setTimeout(onSubmit, 800)
      else setTimeout(() => navigate(`/bet/${id}`), 800)
    }
  }

  /** Submit with a ruling (claimant path) */
  const handleSubmitWithRuling = async (ruling: ProofRuling) => {
    if (!id) return
    setLocalError(null)
    const { files, proofType } = buildFilesAndType()
    const proof = await submitProof(id, files, proofType, caption.trim() || undefined, ruling)
    if (proof) {
      setSubmitted(true)
      if (onSubmit) setTimeout(onSubmit, 800)
      else setTimeout(() => navigate(`/bet/${id}`), 800)
    }
  }

  const handleBack = () => (onBack ? onBack() : navigate(-1))
  const hasProof = uploadFiles.length > 0 || caption.trim().length > 0
  const error = localError || storeError

  const photoCount = uploadFiles.filter((u) => u.type === 'screenshot').length
  const videoCount = uploadFiles.filter((u) => u.type === 'video').length
  const docCount = uploadFiles.filter((u) => u.type === 'document').length

  if (submitted) {
    return (
      <div className="h-full bg-bg-primary flex flex-col items-center justify-center">
        <CheckCircle className="w-16 h-16 text-accent-green mb-4" />
        <p className="text-accent-green font-bold text-xl">
          {isClaimant ? 'Ruling submitted! Voting is open.' : 'Evidence submitted!'}
        </p>
      </div>
    )
  }

  if (step === 'ruling') {
    return (
      <div className="h-full bg-bg-primary flex flex-col overflow-hidden">
        <div className="px-6 pt-12 pb-6 border-b border-border-subtle shrink-0">
          <button onClick={() => setStep('upload')} className="text-text-primary font-bold mb-4">
            &larr; Back
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-1">
            DECLARE YOUR VERDICT
          </p>
          <h2 className="text-2xl font-black text-text-primary leading-tight">
            Did the challenge happen?
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {uploadFiles.length > 0
              ? `${uploadFiles.length} file${uploadFiles.length !== 1 ? 's' : ''} attached`
              : 'Text proof ready'}
            {caption.trim() ? ' · with description' : ''}
          </p>
        </div>

        <div className="flex-1 px-6 py-6 space-y-4 overflow-y-auto">
          <p className="text-xs text-text-muted text-center">
            Your verdict opens a 24-hour voting window. All participants can validate or dispute.
          </p>

          {/* YES — Riders Win */}
          <button
            onClick={() => handleSubmitWithRuling('riders_win')}
            disabled={isSubmitting}
            className="w-full bg-accent-green/10 border-2 border-accent-green/50 rounded-2xl p-5 text-left flex items-start gap-4 hover:border-accent-green active:scale-[0.99] transition-all disabled:opacity-60"
          >
            <span className="text-4xl shrink-0 mt-0.5"></span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-text-primary mb-1">YES — Riders Win</p>
              <p className="text-sm text-text-muted leading-snug">
                The challenge was completed. Riders win, doubters lose.
              </p>
              <p className="text-[11px] font-bold text-accent-green mt-2 uppercase tracking-wide">
                Opens 24h vote · Riders win by default
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-accent-green shrink-0 mt-1" />
          </button>

          {/* NO — Doubters Win */}
          <button
            onClick={() => handleSubmitWithRuling('doubters_win')}
            disabled={isSubmitting}
            className="w-full bg-accent-coral/10 border-2 border-accent-coral/50 rounded-2xl p-5 text-left flex items-start gap-4 hover:border-accent-coral active:scale-[0.99] transition-all disabled:opacity-60"
          >
            <span className="text-4xl shrink-0 mt-0.5"></span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-text-primary mb-1">NO — Doubters Win</p>
              <p className="text-sm text-text-muted leading-snug">
                The challenge was not completed. Doubters win, riders lose.
              </p>
              <p className="text-[11px] font-bold text-accent-coral mt-2 uppercase tracking-wide">
                Opens 24h vote · Doubters win by default
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-accent-coral shrink-0 mt-1" />
          </button>

          {isSubmitting && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-muted">Submitting…</p>
            </div>
          )}

          {error && <p className="text-destructive text-sm px-1">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary overflow-y-auto pb-8">
      <div className="px-6 pt-12 pb-6 border-b border-border-subtle">
        <button onClick={handleBack} className="text-text-primary font-bold mb-4">
          &larr; Back
        </button>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-2">
          {isClaimant ? 'SUBMIT PROOF & VERDICT' : 'SUBMIT EVIDENCE'}
        </p>
        <h2 className="text-2xl font-black text-text-primary">{activeBet?.title ?? 'Upload Evidence'}</h2>
        {!isClaimant && (
          <p className="text-xs text-text-muted mt-1">
            Only the challenge creator can declare the final verdict.
          </p>
        )}
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Upload buttons */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-3">UPLOAD EVIDENCE</p>
          <div className="grid grid-cols-2 gap-3">
            <UploadCard
              icon={<Image className="w-8 h-8 text-accent-green" />}
              label="Photos"
              count={photoCount}
              onClick={handlePhotosPick}
            />
            <UploadCard
              icon={<Video className="w-8 h-8 text-accent-green" />}
              label="Video"
              count={videoCount}
              onClick={() => Capacitor.isNativePlatform() ? nativeVideoInputRef.current?.click() : videoInputRef.current?.click()}
            />
            <UploadCard
              icon={<FileText className="w-8 h-8 text-accent-green" />}
              label="Document"
              count={docCount}
              onClick={() => Capacitor.isNativePlatform() ? nativeDocInputRef.current?.click() : docInputRef.current?.click()}
            />
            <UploadCard
              icon={<Camera className="w-8 h-8 text-accent-green" />}
              label="Take Photo"
              count={0}
              onClick={openCamera}
            />
          </div>

          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e, 'screenshot')} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => addFiles(e, 'video')} />
          <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={(e) => addFiles(e, 'document')} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e, 'screenshot')} />
          <input ref={nativeVideoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => addFiles(e, 'video')} />
          <input ref={nativeDocInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => addFiles(e, 'document')} />
        </div>

        {/* File previews */}
        {uploadFiles.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-2">
              {uploadFiles.length} FILE{uploadFiles.length !== 1 ? 'S' : ''} SELECTED
            </p>
            <div className="flex gap-2 flex-wrap">
              {uploadFiles.map((u, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-accent-green/50 bg-bg-elevated">
                  {u.previewUrl ? (
                    <img src={u.previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : u.file.type.startsWith('video/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Video className="w-5 h-5 text-accent-green mb-1" />
                      <span className="text-[10px] text-text-muted truncate max-w-full px-1">{u.file.name}</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <FileText className="w-5 h-5 text-accent-green mb-1" />
                      <span className="text-[10px] text-text-muted truncate max-w-full px-1">{u.file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-coral text-white flex items-center justify-center z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Caption / text proof */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-2 block">
            DESCRIPTION {uploadFiles.length === 0 ? '' : '(OPTIONAL)'}
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={uploadFiles.length === 0 ? 'Describe what happened as proof...' : 'Add context...'}
            className="w-full h-24 bg-bg-card border border-border-subtle rounded-xl p-3 text-text-primary placeholder:text-text-muted resize-none"
          />
        </div>
      </div>

      {error && <p className="px-6 text-destructive text-sm mb-2">{error}</p>}

      <div className="px-6 pt-4 pb-safe space-y-3">
        {isClaimant ? (
          <PrimaryButton
            onClick={() => {
              const hasFiles = uploadFiles.length > 0
              const hasCaption = caption.trim().length > 0
              if (!hasFiles && !hasCaption) {
                setLocalError('Add proof media or a text description.')
                return
              }
              setLocalError(null)
              setStep('ruling')
            }}
            variant="danger"
          >
            Declare Verdict →
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={handleSubmitEvidence}
            disabled={!hasProof || isSubmitting || nativeCapturing}
            variant="danger"
          >
            {nativeCapturing ? 'Uploading…' : isSubmitting ? 'Submitting…' : 'Submit Evidence'}
          </PrimaryButton>
        )}
      </div>

      {/* Camera viewfinder overlay */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 object-cover w-full"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
          />
          <div className="absolute top-safe top-4 right-4 flex gap-3 z-10">
            <button
              onClick={flipCamera}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              aria-label="Flip camera"
            >
              <span className="text-white text-lg"></span>
            </button>
            <button
              onClick={closeCamera}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              aria-label="Close camera"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pb-safe">
            <button
              onClick={capturePhoto}
              className="w-18 h-18 rounded-full border-4 border-white bg-white/30 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
              style={{ width: 72, height: 72 }}
              aria-label="Take photo"
            >
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Tappable upload card with optional count badge */
function UploadCard({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative bg-bg-card border border-border-subtle rounded-xl p-4 flex flex-col items-center gap-2 hover:border-accent-green active:scale-95 transition-all cursor-pointer min-h-[100px]"
    >
      {icon}
      <span className="text-xs font-bold text-text-primary">{label}</span>
      {count > 0 && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-green text-white text-[10px] font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}
