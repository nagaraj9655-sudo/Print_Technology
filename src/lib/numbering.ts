// Invoice / quote numbering (§2.2, §5.4).
// Two series: a GLOBAL running number unique system-wide, and a PER-COMPANY,
// per-financial-year sequence that prints on the customer document.
// Numbers are assigned atomically on save to avoid duplicates/gaps.

import type { Database } from './types'
import { financialYear } from './format'

export interface AssignedBillNumbers {
  billNo: number
  companyBillNo: string
}

export function nextBillNumbers(db: Database, companyId: string, dateISO: string): AssignedBillNumbers {
  const company = db.companies.find((c) => c.id === companyId)
  const fy = financialYear(dateISO, db.settings.fyStartMonth)
  const key = `${companyId}:${fy}`

  const billNo = (db.counters.billNo || 0) + 1
  const seq = (db.counters.companyBillSeq[key] || 0) + 1

  const prefix = company?.invoicePrefix?.trim() || ''
  const companyBillNo = `${prefix}${fy}/${String(seq).padStart(3, '0')}`

  return { billNo, companyBillNo }
}

export function commitBillNumbers(db: Database, companyId: string, dateISO: string): AssignedBillNumbers {
  const fy = financialYear(dateISO, db.settings.fyStartMonth)
  const key = `${companyId}:${fy}`
  const assigned = nextBillNumbers(db, companyId, dateISO)
  db.counters.billNo = assigned.billNo
  db.counters.companyBillSeq[key] = (db.counters.companyBillSeq[key] || 0) + 1
  return assigned
}

export interface AssignedQuoteNumbers {
  quoteNo: number
  companyQuoteNo: string
}

export function nextQuoteNumbers(db: Database, companyId: string, dateISO: string): AssignedQuoteNumbers {
  const company = db.companies.find((c) => c.id === companyId)
  const fy = financialYear(dateISO, db.settings.fyStartMonth)
  const key = `${companyId}:${fy}`

  const quoteNo = (db.counters.quoteNo || 0) + 1
  const seq = (db.counters.companyQuoteSeq[key] || 0) + 1

  const prefix = company?.quotePrefix?.trim() || company?.invoicePrefix?.trim() || ''
  const companyQuoteNo = `${prefix}Q/${fy}/${String(seq).padStart(3, '0')}`

  return { quoteNo, companyQuoteNo }
}

export function commitQuoteNumbers(db: Database, companyId: string, dateISO: string): AssignedQuoteNumbers {
  const fy = financialYear(dateISO, db.settings.fyStartMonth)
  const key = `${companyId}:${fy}`
  const assigned = nextQuoteNumbers(db, companyId, dateISO)
  db.counters.quoteNo = assigned.quoteNo
  db.counters.companyQuoteSeq[key] = (db.counters.companyQuoteSeq[key] || 0) + 1
  return assigned
}
