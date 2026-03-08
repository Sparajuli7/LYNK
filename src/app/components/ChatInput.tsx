import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Camera, Video, X, Loader2, Reply, Pencil } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera'

const isIOS = Capacitor.getPlatform() === 'ios'
import { MentionSuggestions } from '@/app/components/MentionSuggestions'
import type { ParticipantProfile } from '@/lib/api/chat'
import type { MessageWithSender } from '@/lib/api/chat'

interface ChatInputProps {
  onSend: (content: string) => void
  onSendImage: (file: File, caption: string) => void
  onSendVideo: (file: File, caption: string) => void
  onCancelReply: () => void
  onCancelEdit: () => void
  onSaveEdit: (messageId: string, newContent: string) => void
  replyingTo: MessageWithSender | null
  editingMessage: MessageWithSender | null
  participants: ParticipantProfile[]
  disabled?: boolean
  isUploading?: boolean
}

export function ChatInput({
  onSend,
  onSendImage,
  onSendVideo,
  onCancelReply,
  onCancelEdit,
  onSaveEdit,
  replyingTo,
  editingMessage,
  participants,
  disabled,
  isUploading,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // When entering edit mode, populate with existing content
  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.content)
      textareaRef.current?.focus()
    }
  }, [editingMessage])

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  // Detect @mention trigger
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      setMentionQuery(atMatch[1])
    } else {
      setMentionQuery(null)
    }
  }

  const handleMentionSelect = (participant: ParticipantProfile) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = value.slice(0, cursorPos)
    const textAfterCursor = value.slice(cursorPos)

    // Find the @ position
    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex === -1) return

    const before = value.slice(0, atIndex)
    const mention = `@${participant.username} `
    const newValue = before + mention + textAfterCursor
    setValue(newValue)
    setMentionQuery(null)

    // Move cursor after mention
    requestAnimationFrame(() => {
      const newPos = atIndex + mention.length
      textarea.setSelectionRange(newPos, newPos)
      textarea.focus()
    })
  }

  const handleSend = () => {
    if (isUploading || disabled) return

    // Edit mode
    if (editingMessage) {
      const trimmed = value.trim()
      if (trimmed && trimmed !== editingMessage.content) {
        onSaveEdit(editingMessage.id, trimmed)
      } else {
        onCancelEdit()
      }
      setValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      return
    }

    if (imagePreview) {
      onSendImage(imagePreview.file, value.trim())
      URL.revokeObjectURL(imagePreview.url)
      setImagePreview(null)
      setValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      return
    }

    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
    setMentionQuery(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      if (editingMessage) onCancelEdit()
      if (replyingTo) onCancelReply()
      setMentionQuery(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Clean up previous preview
    if (imagePreview) URL.revokeObjectURL(imagePreview.url)
    setImagePreview({ file, url: URL.createObjectURL(file) })
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onSendVideo(file, '')
    e.target.value = ''
  }

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview.url)
    setImagePreview(null)
  }

  const handleCameraPress = useCallback(async () => {
    if (isIOS) {
      try {
        const photo = await CapCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
        })
        if (!photo.webPath) return
        const res = await fetch(photo.webPath)
        const blob = await res.blob()
        const ext = photo.format === 'png' ? 'png' : 'jpg'
        const file = new File([blob], `photo_${Date.now()}.${ext}`, { type: `image/${ext}` })
        if (imagePreview) URL.revokeObjectURL(imagePreview.url)
        setImagePreview({ file, url: URL.createObjectURL(file) })
      } catch {
        // user cancelled
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [imagePreview])

  const canSend =
    (!disabled && !isUploading) &&
    (value.trim().length > 0 || imagePreview !== null)

  return (
    <div className="border-t border-border-subtle bg-bg-primary px-4 py-3 pb-safe relative">
      {/* Mention suggestions */}
      {mentionQuery !== null && participants.length > 0 && (
        <MentionSuggestions
          query={mentionQuery}
          participants={participants}
          onSelect={handleMentionSelect}
        />
      )}

      {/* Reply preview bar */}
      {replyingTo && !editingMessage && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-bg-elevated rounded-lg border-l-2 border-accent-green">
          <Reply className="w-3.5 h-3.5 text-accent-green shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-accent-green">{replyingTo._senderName}</p>
            <p className="text-xs text-text-muted truncate">
              {replyingTo.deleted_at ? 'Message deleted' : replyingTo.content}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 p-0.5 text-text-muted hover:text-text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Edit mode indicator */}
      {editingMessage && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-bg-elevated rounded-lg border-l-2 border-yellow-500">
          <Pencil className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-yellow-500">Editing message</p>
          </div>
          <button
            onClick={() => { onCancelEdit(); setValue('') }}
            className="shrink-0 p-0.5 text-text-muted hover:text-text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img
            src={imagePreview.url}
            alt="Preview"
            className="h-20 w-20 rounded-xl object-cover border border-border-subtle"
          />
          {!isUploading && (
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent-coral text-white flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Camera / image picker button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        {/* Video picker button */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoSelect}
        />

        {!editingMessage && (
          <>
            <button
              onClick={handleCameraPress}
              disabled={disabled || isUploading}
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-bg-elevated text-text-muted hover:text-accent-green transition-colors disabled:opacity-50"
              aria-label="Take photo or choose image"
            >
              <Camera className="w-5 h-5" />
            </button>

            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-bg-elevated text-text-muted hover:text-accent-green transition-colors disabled:opacity-50"
              aria-label="Upload video"
            >
              <Video className="w-5 h-5" />
            </button>
          </>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            editingMessage
              ? 'Edit message...'
              : imagePreview
                ? 'Add a caption...'
                : 'Type a message...'
          }
          rows={1}
          className="flex-1 resize-none bg-bg-elevated rounded-2xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-green/50 no-scrollbar"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            canSend
              ? editingMessage
                ? 'bg-yellow-500 text-bg-primary'
                : 'bg-accent-green text-bg-primary glow-green'
              : 'bg-bg-elevated text-text-muted'
          }`}
          aria-label={editingMessage ? 'Save edit' : 'Send message'}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : editingMessage ? (
            <Pencil className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
