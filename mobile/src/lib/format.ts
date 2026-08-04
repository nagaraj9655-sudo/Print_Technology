// Formatting helpers — Indian rupee grouping, amount-in-words, dates. Verbatim.

export function formatINR(value: number, withSymbol = true): string {
  const n = Number.isFinite(value) ? value : 0
  const neg = n < 0
  const fixed = Math.abs(n).toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  let grouped = intPart
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3)
    const rest = intPart.slice(0, -3)
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
  }
  const out = `${grouped}.${decPart}`
  return `${neg ? '-' : ''}${withSymbol ? '₹' : ''}${out}`
}

export function formatNumber(value: number): string {
  return formatINR(value, false)
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  let s = ''
  if (h) s += ONES[h] + ' Hundred'
  if (rest) s += (h ? ' ' : '') + twoDigits(rest)
  return s
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only'

  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const hundred = rupees % 1000

  const parts: string[] = []
  if (crore) parts.push(threeDigits(crore) + ' Crore')
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh')
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand')
  if (hundred) parts.push(threeDigits(hundred))

  let words = parts.join(' ').trim()
  words = (amount < 0 ? 'Minus ' : '') + words + ' Rupees'
  if (paise) words += ' and ' + twoDigits(paise) + ' Paise'
  return words + ' Only'
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export function daysBetween(fromISO: string, toISO?: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime()
  const b = new Date((toISO ?? todayISO()) + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export function financialYear(iso: string, fyStartMonth = 4): string {
  const d = new Date(iso + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const startYear = m >= fyStartMonth ? y : y - 1
  const endYear = (startYear + 1) % 100
  return `${startYear}-${String(endYear).padStart(2, '0')}`
}
