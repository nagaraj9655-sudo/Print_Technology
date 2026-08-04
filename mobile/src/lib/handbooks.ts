// Handbook (manual bill book) receipt tracking. Ported verbatim from the web app.

import type { Bill, Handbook } from './types'

export interface HandbookUsage {
  used: number[]
  damaged: number[]
  remaining: number
  nextAvailable: number | null
  total: number
  full: boolean
}

export function handbookUsage(book: Handbook, bills: Bill[]): HandbookUsage {
  const start = book.startNo || 1
  const total = book.billsPerBook || 0
  const end = start + total - 1
  const damaged = (book.damagedReceipts ?? []).filter((n) => n >= start && n <= end)

  const used = bills
    .filter((b) => !b.deletedAt && b.billType === 'Handbill' && b.handbookId === book.id)
    .map((b) => parseInt(b.handBillNo ?? '', 10))
    .filter((n) => !Number.isNaN(n))

  const taken = new Set<number>([...used, ...damaged])
  let nextAvailable: number | null = null
  for (let n = start; n <= end; n++) {
    if (!taken.has(n)) {
      nextAvailable = n
      break
    }
  }
  const remaining = Math.max(0, total - taken.size)
  return { used, damaged, remaining, nextAvailable, total, full: nextAvailable === null }
}

export function parseNumberList(input: string): number[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n > 0),
    ),
  ).sort((a, b) => a - b)
}
