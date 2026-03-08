/**
 * Emoji — forces Apple Color Emoji / Segoe UI Emoji font rendering in
 * Capacitor WKWebView, which strips the emoji font from inherited styles.
 */
export function Emoji({ symbol, className }: { symbol: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={symbol}
      className={className}
      style={{
        fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
        fontStyle: 'normal',
        fontWeight: 'normal',
        display: 'inline-block',
        lineHeight: 1,
      }}
    >
      {symbol}
    </span>
  )
}
