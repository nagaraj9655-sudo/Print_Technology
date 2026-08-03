import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { upiUri } from '../lib/payments'

// Renders a scannable UPI QR (GPay / PhonePe / any UPI app) as an <img>.
export function UpiQr({
  upiId,
  payeeName,
  amount,
  note,
  size = 132,
  className = '',
}: {
  upiId: string
  payeeName?: string
  amount?: number
  note?: string
  size?: number
  className?: string
}) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!upiId) return
    const uri = upiUri({ pa: upiId, pn: payeeName, am: amount, tn: note })
    QRCode.toDataURL(uri, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [upiId, payeeName, amount, note, size])

  if (!upiId) return null
  return dataUrl ? (
    <img src={dataUrl} alt="UPI payment QR" width={size} height={size} className={className} style={{ width: size, height: size }} />
  ) : (
    <div className={className} style={{ width: size, height: size }} />
  )
}
