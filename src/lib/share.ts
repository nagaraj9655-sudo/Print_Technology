// Capture a DOM node (e.g. the rendered invoice, QR included) to a PNG and share
// it — natively on mobile (WhatsApp etc.), or download + open WhatsApp on desktop.

import { canShareFiles } from './qr'
import { whatsappLink } from './payments'

export async function elementToPngFile(el: HTMLElement, filename: string): Promise<File> {
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('capture failed'))), 'image/png', 0.95),
  )
  return new File([blob], filename, { type: 'image/png' })
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// Returns how the image was delivered so the caller can toast appropriately.
export async function shareImageFile(file: File, text: string, phone?: string): Promise<'shared' | 'downloaded'> {
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], text, title: 'Bill' })
      return 'shared'
    } catch {
      /* user cancelled — fall through to download */
    }
  }
  downloadFile(file)
  if (phone) window.open(whatsappLink(phone, text), '_blank')
  return 'downloaded'
}
