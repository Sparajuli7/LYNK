import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

interface BackButtonProps {
  /** Custom click handler. Defaults to navigate(-1). */
  onClick?: () => void
  /** Override aria-label (default: "Go back") */
  ariaLabel?: string
  /** Extra classes appended to the default positioning (e.g. "z-10") */
  className?: string
}

/**
 * Absolutely-positioned back button used on screens without a full header.
 * Consolidates the "absolute top-6 left-6 chevron" pattern that appears on
 * 10+ screens. Pass `onClick` if the target isn't `navigate(-1)`.
 */
export function BackButton({ onClick, ariaLabel = 'Go back', className = '' }: BackButtonProps) {
  const navigate = useNavigate()
  const handleClick = onClick ?? (() => navigate(-1))
  return (
    <button
      onClick={handleClick}
      className={`absolute top-6 left-6 p-2 -m-2 text-text-muted hover:text-text-primary transition-colors ${className}`}
      aria-label={ariaLabel}
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  )
}
