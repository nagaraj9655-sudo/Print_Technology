// UPI QR helpers — generate a PNG data URL and convert to a shareable File so the
// QR image can be attached to a WhatsApp share (not just sent as text).

import QRCode from 'qrcode'
import { upiUri } from './payments'

export async function upiQrDataUrl(opts: { pa: string; pn?: string; am?: number; tn?: string; size?: number }): Promise<string> {
  const uri = upiUri(opts)
  return QRCode.toDataURL(uri, { width: (opts.size ?? 300), margin: 1, errorCorrectionLevel: 'M' })
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [head, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

// True when the browser can share image files (mobile Chrome/Safari, etc.).
export function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  return typeof navigator.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
}
