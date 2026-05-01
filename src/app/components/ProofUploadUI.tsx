import { Video, FileText, X } from 'lucide-react'
import type { UploadEntry } from '@/lib/hooks/useProofUpload'

/**
 * Shared proof upload UI pieces.
 *
 * Previously duplicated identically across ProofSubmission and
 * ShameProofSubmission (~100 lines of identical JSX each).
 */

/** Tappable upload card with optional count badge */
export function UploadCard({
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

/** Grid of thumbnail previews for uploaded files */
export function FilePreviewGrid({
  files,
  onRemove,
}: {
  files: UploadEntry[]
  onRemove: (idx: number) => void
}) {
  if (files.length === 0) return null
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-2">
        {files.length} FILE{files.length !== 1 ? 'S' : ''} SELECTED
      </p>
      <div className="flex gap-2 flex-wrap">
        {files.map((u, i) => (
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
              onClick={() => onRemove(i)}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-coral text-white flex items-center justify-center z-10"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Full-screen camera viewfinder overlay */
export function CameraOverlay({
  videoRef,
  facingMode,
  onCapture,
  onFlip,
  onClose,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  facingMode: 'environment' | 'user'
  onCapture: () => void
  onFlip: () => void
  onClose: () => void
}) {
  return (
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
          onClick={onFlip}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          aria-label="Flip camera"
        >
          <span className="text-white text-lg">{'\u{1F504}'}</span>
        </button>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          aria-label="Close camera"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="absolute bottom-8 left-0 right-0 flex justify-center pb-safe">
        <button
          onClick={onCapture}
          className="w-18 h-18 rounded-full border-4 border-white bg-white/30 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 72, height: 72 }}
          aria-label="Take photo"
        >
          <div className="w-14 h-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}

/** Hidden file inputs for photo, video, document, and native variants */
export function HiddenFileInputs({
  photoInputRef,
  videoInputRef,
  docInputRef,
  cameraInputRef,
  nativeVideoInputRef,
  nativeDocInputRef,
  addFiles,
}: {
  photoInputRef: React.RefObject<HTMLInputElement | null>
  videoInputRef: React.RefObject<HTMLInputElement | null>
  docInputRef: React.RefObject<HTMLInputElement | null>
  cameraInputRef: React.RefObject<HTMLInputElement | null>
  nativeVideoInputRef: React.RefObject<HTMLInputElement | null>
  nativeDocInputRef: React.RefObject<HTMLInputElement | null>
  addFiles: (e: React.ChangeEvent<HTMLInputElement>, type: string) => void
}) {
  return (
    <>
      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e, 'screenshot')} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => addFiles(e, 'video')} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={(e) => addFiles(e, 'document')} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e, 'screenshot')} />
      <input ref={nativeVideoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => addFiles(e, 'video')} />
      <input ref={nativeDocInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => addFiles(e, 'document')} />
    </>
  )
}
