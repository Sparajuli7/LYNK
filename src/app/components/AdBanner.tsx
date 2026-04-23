import { useEffect, useRef, useState } from 'react'

/**
 * Banner ad component — renders an AdSense ad unit on web.
 * When the app is wrapped with Capacitor for native, this will be
 * swapped to use @capacitor-community/admob (see AD_SETUP_GUIDE.md).
 *
 * Replace the data-ad-client and data-ad-slot values with your own
 * from your Google AdSense dashboard.
 */

const AD_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID || ''
const AD_SLOT = import.meta.env.VITE_ADSENSE_SLOT_ID || ''

/** Google AdSense injects `window.adsbygoogle` as an array of push-able config objects. */
type AdsByGoogleQueue = Array<Record<string, unknown>>

declare global {
  interface Window {
    adsbygoogle?: AdsByGoogleQueue
  }
}

export function AdBanner() {
  const adRef = useRef<HTMLModElement>(null)
  const [adFailed, setAdFailed] = useState(false)

  useEffect(() => {
    if (!AD_CLIENT || !AD_SLOT) return

    try {
      const adsbygoogle: AdsByGoogleQueue = window.adsbygoogle ?? []
      adsbygoogle.push({})
    } catch {
      setAdFailed(true)
    }
  }, [])

  if (!AD_CLIENT || !AD_SLOT || adFailed) {
    return null
  }

  return (
    <div className="shrink-0 w-full bg-bg-primary flex items-center justify-center border-t border-border-subtle overflow-hidden">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '50px' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
