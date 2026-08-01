// Money is derived, never hand-typed (§2.5, §4.3, §5.4).
// Every total here is computed from line items + discount; status from balance.

import type { Bill, Company, LineItem, PaymentStatus, Quotation } from './types'

export function lineTotal(item: LineItem): number {
  return round2((item.qty || 0) * (item.rate || 0))
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface Totals {
  gross: number // Σ line totals
  discount: number // resolved flat discount amount
  taxable: number // gross − discount
  cgst: number
  sgst: number
  igst: number
  tax: number // total GST
  net: number // taxable + tax (Bill_Amount / Quote_Amount)
  received: number
  balance: number
  status: PaymentStatus
}

interface ComputeInput {
  items: LineItem[]
  discountAmount: number
  discountIsPercent?: boolean
  receivedAmount?: number
  company: Company | undefined
  interState?: boolean // true => IGST, false => CGST+SGST
}

export function computeTotals(input: ComputeInput): Totals {
  const gross = round2(input.items.reduce((s, it) => s + lineTotal(it), 0))

  const discount = round2(
    input.discountIsPercent ? (gross * (input.discountAmount || 0)) / 100 : input.discountAmount || 0,
  )
  const taxable = round2(Math.max(0, gross - discount))

  const gstMode = isGstCompany(input.company)
  let tax = 0
  let cgst = 0
  let sgst = 0
  let igst = 0

  if (gstMode) {
    // Tax computed per line so mixed rates work; discount applied proportionally.
    const discountRatio = gross > 0 ? discount / gross : 0
    for (const it of input.items) {
      const lt = lineTotal(it)
      const lineTaxable = round2(lt * (1 - discountRatio))
      const rate = it.taxRate ?? 0
      tax += (lineTaxable * rate) / 100
    }
    tax = round2(tax)
    if (input.interState) {
      igst = tax
    } else {
      cgst = round2(tax / 2)
      sgst = round2(tax - cgst)
    }
  }

  const net = round2(taxable + tax)
  const received = round2(input.receivedAmount ?? 0)
  const balance = round2(net - received)

  let status: PaymentStatus = 'Pending'
  if (received <= 0) status = 'Pending'
  else if (balance <= 0.001) status = 'Paid'
  else status = 'Partial'

  return { gross, discount, taxable, cgst, sgst, igst, tax, net, received, balance, status }
}

export function isGstCompany(company: Company | undefined): boolean {
  return !!company?.gstin && company.gstin.trim().length > 0
}

export function billTotals(bill: Bill, company: Company | undefined): Totals {
  return computeTotals({
    items: bill.items,
    discountAmount: bill.discountAmount,
    discountIsPercent: bill.discountIsPercent,
    receivedAmount: bill.receivedAmount,
    company,
    interState: recipientInterState(company, bill.customerGstin),
  })
}

export function quoteTotals(quote: Quotation, company: Company | undefined): Totals {
  return computeTotals({
    items: quote.items,
    discountAmount: quote.discountAmount,
    discountIsPercent: quote.discountIsPercent,
    receivedAmount: 0,
    company,
    interState: recipientInterState(company, quote.customerGstin),
  })
}

// Inter-state when the first 2 digits (state code) of supplier & recipient GSTIN differ.
export function recipientInterState(company: Company | undefined, customerGstin?: string): boolean {
  if (!company?.gstin || !customerGstin) return false
  return company.gstin.slice(0, 2) !== customerGstin.slice(0, 2)
}
