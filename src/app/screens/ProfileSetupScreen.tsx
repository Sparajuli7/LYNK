import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/stores'
import { checkUsernameAvailable, uploadAvatarFile } from '@/lib/api/profiles'
import { validateUsername } from '@/lib/utils/validators'
import { loadPendingInvite } from './CompetitionInviteScreen'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { User } from 'lucide-react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

const USERNAME_DEBOUNCE_MS = 500

export function ProfileSetupScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createProfile = useAuthStore((s) => s.createProfile)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [nativeCapturing, setNativeCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const { valid } = validateUsername(username)
    if (!valid || username.length < 3) {
      setUsernameAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setUsernameChecking(true)
      try {
        const available = await checkUsernameAvailable(username.toLowerCase())
        setUsernameAvailable(available)
      } catch {
        setUsernameAvailable(null)
      } finally {
        setUsernameChecking(false)
      }
    }, USERNAME_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [username])

  const handleAvatarClick = async () => {
    if (Capacitor.isNativePlatform()) {
      const permissions = await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
      if (permissions.camera === 'denied' && permissions.photos === 'denied') {
        setCaptureError('Please allow camera or photo access in Settings to add a photo.')
        return
      }
      setNativeCapturing(true)
      try {
        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
        })
        const response = await fetch(photo.webPath!)
        const blob = await response.blob()
        const file = new File([blob], `${Date.now()}.${photo.format || 'jpg'}`, { type: blob.type })
        setAvatarFile(file)
        setAvatarPreview(photo.webPath!)
        setCaptureError(null)
      } catch (err: any) {
        if (!(err?.message?.includes('cancelled') || err?.message?.includes('cancel'))) {
          setCaptureError('Failed to capture photo. Please try again.')
        }
      } finally {
        setNativeCapturing(false)
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
    e.target.value = ''
  }

  const handleSubmit = async () => {
    const { valid: nameValid } = validateUsername(username)
    if (!nameValid) return
    if (!displayName.trim()) return
    if (usernameAvailable === false) return

    let avatarUrl: string | undefined
    if (avatarFile && user) {
      try {
        avatarUrl = await uploadAvatarFile(user.id, avatarFile)
      } catch {
        // Continue without avatar
      }
    }

    const success = await createProfile({
      username: username.toLowerCase().trim(),
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
    })

    if (success) {
      // Check for pending competition invite from deep link
      const pending = loadPendingInvite()
      if (pending) {
        const params = pending.groupInviteCode ? `?group=${pending.groupInviteCode}` : ''
        navigate(`/invite/compete/${pending.compId}${params}`, { replace: true })
      } else {
        navigate('/home', { replace: true })
      }
    }
  }

  if (!user) {
    navigate('/auth/signup', { replace: true })
    return null
  }

  const canSubmit =
    displayName.trim().length > 0 &&
    validateUsername(username).valid &&
    usernameAvailable === true &&
    !isLoading

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <div className="flex-1 flex flex-col justify-center pt-12">
        <h1 className="text-2xl font-black text-text-primary mb-2">
          Set up your profile
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Add a photo and pick a username
        </p>

        <div className="flex flex-col items-center mb-8">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="w-24 h-24 rounded-full bg-bg-elevated border-2 border-border-subtle flex items-center justify-center overflow-hidden hover:border-accent-green/50 transition-colors"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-text-muted" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <p className="text-text-muted text-xs mt-2">Tap to add photo</p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Display name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="h-12 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              placeholder="username"
              className="h-12 rounded-xl"
            />
            {username.length >= 3 && (
              <p className="text-xs mt-1">
                {usernameChecking ? (
                  <span className="text-text-muted">Checking...</span>
                ) : usernameAvailable === true ? (
                  <span className="text-accent-green">Available</span>
                ) : usernameAvailable === false ? (
                  <span className="text-destructive">Taken</span>
                ) : null}
              </p>
            )}
          </div>
        </div>

        {captureError && (
          <p className="text-destructive text-sm mb-2">{captureError}</p>
        )}

        {error && (
          <p className="text-destructive text-sm mb-4">{error}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || nativeCapturing}
          className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold text-base hover:bg-accent-green/90"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating...
            </span>
          ) : (
            "Let's Go"
          )}
        </Button>
      </div>
    </div>
  )
}
