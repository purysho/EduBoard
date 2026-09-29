// The school's logo (a PNG data URL, Settings → Appearance) as a square image, for the
// Windows shortcuts (shortcutBranding.ts) and the Portal (portalSyncService.ts).
import { nativeImage } from 'electron'

/** The image centred on a transparent square, so a wide logo isn't squashed. */
export function squareImage(image: Electron.NativeImage, side: number): Electron.NativeImage {
  const { width, height } = image.getSize()
  const scale = side / Math.max(width, height)
  const fitted = image.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: 'best'
  })
  const { width: w, height: h } = fitted.getSize()
  const src = fitted.toBitmap() // 4 bytes a pixel
  const out = Buffer.alloc(side * side * 4) // transparent
  const left = Math.floor((side - w) / 2)
  const top = Math.floor((side - h) / 2)
  for (let y = 0; y < h; y++) {
    src.copy(out, ((top + y) * side + left) * 4, y * w * 4, (y + 1) * w * 4)
  }
  return nativeImage.createFromBitmap(out, { width: side, height: side })
}

// Converting is slow next to building the rest of a publish, which happens often (the
// "unpublished changes" check), so the last answer is kept.
let lastPng: { logo: string; side: number; png: Buffer | null } | null = null

/** The logo as a square PNG of `side` pixels, or null when there's none (or it won't
 * open). */
export function squareLogoPng(schoolLogo: string, side: number): Buffer | null {
  if (!schoolLogo) return null
  if (lastPng?.logo === schoolLogo && lastPng.side === side) return lastPng.png
  const image = nativeImage.createFromDataURL(schoolLogo)
  const png = image.isEmpty() ? null : squareImage(image, side).toPNG()
  lastPng = { logo: schoolLogo, side, png }
  return png
}
