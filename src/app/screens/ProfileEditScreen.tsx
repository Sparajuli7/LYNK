import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { uploadAvatar, checkUsernameAvailable } from '@/lib/api/profiles'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'

export function ProfileEditScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const updateProfileStore = useAuthStore((s) => s.updateProfile)

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      const url = await uploadAvatar(user.id, file)
      setProfile({ ...profile!, avatar_url: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload')
    }
    e.target.value = ''
  }

  const handleUsernameBlur = async () => {
    const trimmed = username.trim().toLowerCase()
    if (!trimmed || trimmed === profile?.username) {
      setUsernameAvailable(null)
      return
    }
    setUsernameChecking(true)
    try {
      const available = await checkUsernameAvailable(trimmed)
      setUsernameAvailable(available)
    } finally {
      setUsernameChecking(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    const trimmedDisplay = displayName.trim()
    const trimmedUsername = username.trim().toLowerCase()

    if (!trimmedDisplay) {
      setError('Display name is required')
      return
    }
    if (!trimmedUsername) {
      setError('Username is required')
      return
    }
    if (usernameAvailable === false && trimmedUsername !== profile.username) {
      setError('Username is taken')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateProfileStore({
        display_name: trimmedDisplay,
        username: trimmedUsername,
      })
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!user || !profile) {
    return (
      <div className="h-full bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary grain-texture flex flex-col px-6">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="flex-1 pt-12">
        <h1 className="text-2xl font-black text-text-primary mb-8">Edit Profile</h1>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              className="w-24 h-24 rounded-full overflow-hidden bg-bg-elevated border-2 border-border-subtle flex items-center justify-center hover:border-accent-green/50 transition-colors"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl"></span>
              )}
            </button>
            <p className="text-xs text-text-muted mt-2">Tap to change photo</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Display name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="h-12 rounded-xl"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase())
                setUsernameAvailable(null)
              }}
              onBlur={handleUsernameBlur}
              placeholder="@username"
              className="h-12 rounded-xl"
              maxLength={30}
            />
            {usernameChecking && (
              <p className="text-xs text-text-muted mt-1">Checking...</p>
            )}
            {usernameAvailable === true && (
              <p className="text-xs text-accent-green mt-1">Available</p>
            )}
            {usernameAvailable === false && (
              <p className="text-xs text-accent-coral mt-1">Username is taken</p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-accent-green text-white font-bold"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </form>
      </div>
    </div>
  )
}
