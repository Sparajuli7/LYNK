interface FullScreenSpinnerProps {
  /** Loading message displayed below the spinner */
  message?: string
  /** Spinner border color — defaults to 'border-accent-green' */
  color?: string
}

/**
 * Centered full-screen loading spinner used during page-level data loading.
 * Replaces the previously duplicated pattern across 15+ screen components.
 */
export function FullScreenSpinner({
  message,
  color = 'border-accent-green',
}: FullScreenSpinnerProps) {
  return (
    <div className="h-full bg-bg-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className={`w-8 h-8 border-2 ${color} border-t-transparent rounded-full animate-spin`}
        />
        {message && <p className="text-text-muted text-sm">{message}</p>}
      </div>
    </div>
  )
}
