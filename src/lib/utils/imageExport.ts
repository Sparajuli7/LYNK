/**
 * Image export: capture DOM elements as images for social sharing.
 * Uses html-to-image under the hood.
 */

import { toBlob } from 'html-to-image'

export interface CaptureOptions {
  scale?: number
  backgroundColor?: string
  width?: number
  height?: number
}

/** Capture a DOM element as a PNG Blob. */
export async function captureElementAsImage(
  element: HTMLElement,
  options: CaptureOptions = {},
): Promise<Blob> {
  const blob = await toBlob(element, {
    pixelRatio: options.scale ?? 2,
    backgroundColor: options.backgroundColor ?? '#0A0A0F',
    width: options.width,
    height: options.height,
    cacheBust: true,
  })
  if (!blob) throw new Error('Failed to capture image')
  return blob
}

/** Trigger a browser download of an image Blob. */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Share an image using the Web Share API. Falls back to download. */
export async function shareImage(
  blob: Blob,
  filename: string,
  shareText: string,
): Promise<boolean> {
  const file = new File([blob], filename, { type: 'image/png' })

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        text: shareText,
        files: [file],
      })
      return true
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return true
    }
  }

  downloadImage(blob, filename)
  return false
}
