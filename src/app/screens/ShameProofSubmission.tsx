import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Camera, Image, Video, FileText, CheckCircle, Share2 } from 'lucide-react'
import { getOutcome } from '@/lib/api/outcomes'
import { submitShameProof } from '@/lib/api/shame'
import { supabase } from '@/lib/supabase'
import { PrimaryButton } from '../components/PrimaryButton'
import { FullScreenSpinner } from '../components/FullScreenSpinner'
import { UploadCard, FilePreviewGrid, CameraOverlay, HiddenFileInputs } from '../components/ProofUploadUI'
import { ShareSheet } from '../components/ShareSheet'
import { getShameShareText, getBetShareUrl, shareWithNative } from '@/lib/share'
import { useAuthStore } from '@/stores'
import { useProofUpload } from '@/lib/hooks/useProofUpload'
import { Capacitor } from '@capacitor/core'

export function ShameProofSubmission() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [outcomeId, setOutcomeId] = useState<string | null>(null)
  const [betTitle, setBetTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)

  const upload = useProofUpload()

  useEffect(() => {
    if (!id) return
    getOutcome(id).then((outcome) => {
      if (outcome) {
        setOutcomeId(outcome.id)
        supabase
          .from('bets')
          .select('title')
          .eq('id', id)
          .single()
          .then(({ data }) => setBetTitle(data?.title ?? 'Bet'))
      }
      setLoading(false)
    })
  }, [id])

  const handleSubmit = async () => {
    if (!id || !outcomeId) return

    const hasFiles = upload.uploadFiles.length > 0
    const hasCaption = caption.trim().length > 0

    if (!hasFiles && !hasCaption) {
      upload.setError('Add proof media or a text description.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    upload.clearError()
    try {
      const frontFile = upload.uploadFiles.find((u) => u.type === 'front')?.file
      const backFile = upload.uploadFiles.find((u) => u.type === 'back')?.file
      const videoFile = upload.uploadFiles.find((u) => u.type === 'video')?.file
      const documentFile = upload.uploadFiles.find((u) => u.type === 'document')?.file
      const screenshotFiles = upload.uploadFiles.filter((u) => u.type === 'screenshot').map((u) => u.file)

      await submitShameProof(id, outcomeId, {
        frontFile,
        backFile,
        videoFile,
        documentFile,
        screenshotFiles: screenshotFiles.length > 0 ? screenshotFiles : undefined,
        caption: caption.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => navigate(-1)
  const hasProof = upload.uploadFiles.length > 0 || caption.trim().length > 0
  const error = submitError || upload.error

  if (loading) {
    return <FullScreenSpinner />
  }

  if (!outcomeId) {
    return (
      <div className="h-full bg-bg-primary flex flex-col items-center justify-center px-6">
        <p className="text-text-muted mb-4">Outcome not found</p>
        <PrimaryButton onClick={() => navigate(-1)}>Go Back</PrimaryButton>
      </div>
    )
  }

  if (submitted) {
    const profile = useAuthStore.getState().profile
    const loserName = profile?.display_name ?? 'Someone'
    const shareText = getShameShareText({ loserName, betTitle })
    const shareUrl = id ? getBetShareUrl(id) : ''

    const proofImageFiles = upload.uploadFiles
      .filter((u) => u.file.type.startsWith('image/'))
      .slice(0, 1)
      .map((u) => u.file)

    const firstPreviewUrl = upload.uploadFiles.find((u) => u.previewUrl)?.previewUrl ?? null

    const handleShareAfterSubmit = async () => {
      const usedNative = await shareWithNative({
        title: 'Punishment Complete',
        text: shareText,
        url: shareUrl,
        files: proofImageFiles,
      })
      if (!usedNative) {
        setShareSheetOpen(true)
      }
    }

    return (
      <div className="h-full bg-bg-primary flex flex-col items-center justify-center px-6">
        {/* Official completion badge */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #00E676, #00BCD4)', boxShadow: '0 0 30px rgba(0,230,118,0.4)' }}
        >
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        <p className="text-2xl font-black text-white mb-1 text-center">Officially Complete!</p>
        <p className="text-accent-green font-bold text-sm mb-1">Punishment logged on your card</p>

        {/* Rep bonus */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full mb-4"
          style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)' }}
        >
          <span className="text-lg">{'\u2B50'}</span>
          <span className="text-sm font-black text-accent-green">+10 REP earned</span>
        </div>

        {/* Proof preview */}
        {firstPreviewUrl && (
          <div className="w-full max-w-xs rounded-xl overflow-hidden border border-border-subtle mb-4">
            <img src={firstPreviewUrl} alt="Your proof" className="w-full max-h-40 object-cover" />
            {caption.trim() && (
              <p className="px-3 py-2 text-xs text-text-muted truncate">{caption}</p>
            )}
          </div>
        )}

        <p className="text-text-muted text-sm mb-6 text-center">
          Your completion rate and rep score have been updated.
        </p>

        <div className="w-full max-w-xs space-y-3">
          <PrimaryButton onClick={handleShareAfterSubmit} className="w-full">
            <Share2 className="w-4 h-4 mr-2" />
            Share Proof
          </PrimaryButton>
          <button
            onClick={() => navigate('/profile')}
            className="w-full py-3 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm font-bold"
          >
            View My Player Card
          </button>
          <button
            onClick={() => navigate('/shame')}
            className="w-full text-sm text-text-muted font-medium py-2"
          >
            Go to Hall of Shame
          </button>
        </div>

        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          title="Share punishment proof"
          text={shareText}
          url={shareUrl}
          imageUrl={firstPreviewUrl}
          caption={betTitle}
          onShared={() => navigate('/shame')}
        />
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
          SUBMIT PUNISHMENT PROOF
        </p>
        <h2 className="text-2xl font-black text-text-primary">{betTitle}</h2>
      </div>

      <div className="px-6 py-6 space-y-4">
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
          {upload.uploadFiles.length === 0 && caption.trim().length > 0 && (
            <p className="text-xs text-text-muted mt-1">Text-only proof will be submitted</p>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <PrimaryButton
          onClick={handleSubmit}
          disabled={!hasProof || submitting || upload.nativeCapturing}
          className="w-full"
        >
          {upload.nativeCapturing ? 'Uploading...' : submitting ? 'Submitting...' : 'Submit Proof'}
        </PrimaryButton>
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
