import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Camera, Image, Video, FileText, CheckCircle, ChevronRight } from 'lucide-react'
import { useBetStore, useAuthStore } from '@/stores'
import { useProofStore } from '@/stores'
import type { ProofType, ProofRuling } from '@/lib/database.types'
import { PrimaryButton } from '../components/PrimaryButton'
import { UploadCard, FilePreviewGrid, CameraOverlay, HiddenFileInputs } from '../components/ProofUploadUI'
import { useProofUpload } from '@/lib/hooks/useProofUpload'
import { Capacitor } from '@capacitor/core'

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

  // step: 'upload' -> everyone uploads evidence
  //       'ruling' -> claimant-only: declare YES or NO
  const [step, setStep] = useState<'upload' | 'ruling'>('upload')
  const [caption, setCaption] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const upload = useProofUpload()

  useEffect(() => {
    if (id) fetchBetDetail(id)
  }, [id, fetchBetDetail])

  useEffect(() => {
    useProofStore.getState().clearError()
  }, [])

  /** Build the file object and determine proof type from current uploads */
  function buildFilesAndType() {
    const cameraFiles = upload.uploadFiles.filter((u) => u.type === 'camera').map((u) => u.file)
    const screenshots = upload.uploadFiles.filter((u) => u.type === 'screenshot').map((u) => u.file)
    const video = upload.uploadFiles.find((u) => u.type === 'video')?.file
    const doc = upload.uploadFiles.find((u) => u.type === 'document')?.file

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
    const hasFiles = upload.uploadFiles.length > 0
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
  const hasProof = upload.uploadFiles.length > 0 || caption.trim().length > 0
  const error = localError || storeError || upload.error

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
            {upload.uploadFiles.length > 0
              ? `${upload.uploadFiles.length} file${upload.uploadFiles.length !== 1 ? 's' : ''} attached`
              : 'Text proof ready'}
            {caption.trim() ? ' \u00B7 with description' : ''}
          </p>
        </div>

        <div className="flex-1 px-6 py-6 space-y-4 overflow-y-auto">
          <p className="text-xs text-text-muted text-center">
            Your verdict opens a 24-hour voting window. All participants can validate or dispute.
          </p>

          {/* YES -- Riders Win */}
          <button
            onClick={() => handleSubmitWithRuling('riders_win')}
            disabled={isSubmitting}
            className="w-full bg-accent-green/10 border-2 border-accent-green/50 rounded-2xl p-5 text-left flex items-start gap-4 hover:border-accent-green active:scale-[0.99] transition-all disabled:opacity-60"
          >
            <span className="text-4xl shrink-0 mt-0.5">{'\u2705'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-text-primary mb-1">YES -- Riders Win</p>
              <p className="text-sm text-text-muted leading-snug">
                The challenge was completed. Riders win, doubters lose.
              </p>
              <p className="text-[11px] font-bold text-accent-green mt-2 uppercase tracking-wide">
                Opens 24h vote {'\u00B7'} Riders win by default
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-accent-green shrink-0 mt-1" />
          </button>

          {/* NO -- Doubters Win */}
          <button
            onClick={() => handleSubmitWithRuling('doubters_win')}
            disabled={isSubmitting}
            className="w-full bg-accent-coral/10 border-2 border-accent-coral/50 rounded-2xl p-5 text-left flex items-start gap-4 hover:border-accent-coral active:scale-[0.99] transition-all disabled:opacity-60"
          >
            <span className="text-4xl shrink-0 mt-0.5">{'\u274C'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-text-primary mb-1">NO -- Doubters Win</p>
              <p className="text-sm text-text-muted leading-snug">
                The challenge was not completed. Doubters win, riders lose.
              </p>
              <p className="text-[11px] font-bold text-accent-coral mt-2 uppercase tracking-wide">
                Opens 24h vote {'\u00B7'} Doubters win by default
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-accent-coral shrink-0 mt-1" />
          </button>

          {isSubmitting && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-muted">Submitting...</p>
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
              count={upload.photoCount}
              onClick={upload.handlePhotosPick}
            />
            <UploadCard
              icon={<Video className="w-8 h-8 text-accent-green" />}
              label="Video"
              count={upload.videoCount}
              onClick={() => Capacitor.isNativePlatform() ? upload.nativeVideoInputRef.current?.click() : upload.videoInputRef.current?.click()}
            />
            <UploadCard
              icon={<FileText className="w-8 h-8 text-accent-green" />}
              label="Document"
              count={upload.docCount}
              onClick={() => Capacitor.isNativePlatform() ? upload.nativeDocInputRef.current?.click() : upload.docInputRef.current?.click()}
            />
            <UploadCard
              icon={<Camera className="w-8 h-8 text-accent-green" />}
              label="Take Photo"
              count={0}
              onClick={upload.openCamera}
            />
          </div>

          <HiddenFileInputs
            photoInputRef={upload.photoInputRef}
            videoInputRef={upload.videoInputRef}
            docInputRef={upload.docInputRef}
            cameraInputRef={upload.cameraInputRef}
            nativeVideoInputRef={upload.nativeVideoInputRef}
            nativeDocInputRef={upload.nativeDocInputRef}
            addFiles={upload.addFiles}
          />
        </div>

        {/* File previews */}
        <FilePreviewGrid files={upload.uploadFiles} onRemove={upload.removeFile} />

        {/* Caption / text proof */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-2 block">
            DESCRIPTION {upload.uploadFiles.length === 0 ? '' : '(OPTIONAL)'}
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={upload.uploadFiles.length === 0 ? 'Describe what happened as proof...' : 'Add context...'}
            className="w-full h-24 bg-bg-card border border-border-subtle rounded-xl p-3 text-text-primary placeholder:text-text-muted resize-none"
          />
        </div>
      </div>

      {error && <p className="px-6 text-destructive text-sm mb-2">{error}</p>}

      <div className="px-6 pt-4 pb-safe space-y-3">
        {isClaimant ? (
          <PrimaryButton
            onClick={() => {
              const hasFiles = upload.uploadFiles.length > 0
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
            Declare Verdict {'\u2192'}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={handleSubmitEvidence}
            disabled={!hasProof || isSubmitting || upload.nativeCapturing}
            variant="danger"
          >
            {upload.nativeCapturing ? 'Uploading\u2026' : isSubmitting ? 'Submitting\u2026' : 'Submit Evidence'}
          </PrimaryButton>
        )}
      </div>

      {/* Camera viewfinder overlay */}
      {upload.cameraOpen && (
        <CameraOverlay
          videoRef={upload.videoRef}
          facingMode={upload.facingMode}
          onCapture={upload.capturePhoto}
          onFlip={upload.flipCamera}
          onClose={upload.closeCamera}
        />
      )}
    </div>
  )
}
