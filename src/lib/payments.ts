// Payment reminders + UPI helpers (WhatsApp / SMS / UPI QR).

import { formatDate, formatINR } from './format'

export interface ReminderLine {
  no: string
  date: string
  balance: number
}

// Standard UPI deep-link / QR payload understood by GPay, PhonePe, Paytm, etc.
export function upiUri(opts: { pa: string; pn?: string; am?: number; tn?: string }): string {
  const params = new URLSearchParams()
  params.set('pa', opts.pa)
  if (opts.pn) params.set('pn', opts.pn)
  if (opts.am && opts.am > 0) params.set('am', opts.am.toFixed(2))
  params.set('cu', 'INR')
  if (opts.tn) params.set('tn', opts.tn)
  return `upi://pay?${params.toString()}`
}

// Keep only digits; add India country code when a bare 10-digit number is given.
export function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10) return '91' + digits
  return digits
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`
}

export function smsLink(phone: string, text: string): string {
  const p = (phone || '').replace(/[^\d+]/g, '')
  return `sms:${p}?body=${encodeURIComponent(text)}`
}

export function buildReminderMessage(p: {
  companyName: string
  customerName: string
  lines: ReminderLine[]
  total: number
  upiId?: string
  bankDetails?: string
  intro?: string
}): string {
  const parts: string[] = []
  parts.push(`Dear ${p.customerName || 'Customer'},`)
  parts.push(p.intro?.trim() || `This is a gentle payment reminder from ${p.companyName}.`)
  parts.push('')
  if (p.lines.length === 1) {
    const l = p.lines[0]
    parts.push(`Pending bill ${l.no} dated ${formatDate(l.date)}: ${formatINR(l.balance)} due.`)
  } else {
    parts.push('Pending bills:')
    p.lines.forEach((l) => parts.push(`• ${l.no} (${formatDate(l.date)}): ${formatINR(l.balance)}`))
    parts.push(`Total outstanding: ${formatINR(p.total)}`)
  }
  parts.push('')
  parts.push('Please pay via:')
  if (p.upiId) parts.push(`UPI (GPay / PhonePe): ${p.upiId}`)
  if (p.bankDetails) parts.push(p.bankDetails)
  parts.push('You can also scan the payment QR we shared to pay instantly.')
  parts.push('')
  parts.push(`Thank you,\n${p.companyName}`)
  return parts.join('\n')
}
