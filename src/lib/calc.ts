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
  gstEnabled?: boolean // per-document switch; undefined = follow company (backward compat)
  gstInclusive?: boolean // true => entered rates already include GST
}

export function computeTotals(input: ComputeInput): Totals {
  const gross = round2(input.items.reduce((s, it) => s + lineTotal(it), 0))

  const discount = round2(
    input.discountIsPercent ? (gross * (input.discountAmount || 0)) / 100 : input.discountAmount || 0,
  )
  const afterDiscount = round2(Math.max(0, gross - discount))

  const gstMode = docUsesGst(input.company, input.gstEnabled)
  const inclusive = gstMode && !!input.gstInclusive
  let tax = 0
  let cgst = 0
  let sgst = 0
  let igst = 0
  let taxable = afterDiscount

  if (gstMode) {
    // Discount applied proportionally across lines; per-line rates so mixes work.
    const discountRatio = gross > 0 ? discount / gross : 0
    if (inclusive) {
      // Entered rates already include GST → back out the taxable value and tax.
      let taxableSum = 0
      for (const it of input.items) {
        const lineIncl = round2(lineTotal(it) * (1 - discountRatio))
        const rate = it.taxRate ?? 0
        taxableSum += lineIncl / (1 + rate / 100)
      }
      taxable = round2(taxableSum)
      tax = round2(afterDiscount - taxable) // reconciles: taxable + tax = afterDiscount
    } else {
      // Exclusive → tax added on top of the taxable value.
      for (const it of input.items) {
        const lineTaxable = round2(lineTotal(it) * (1 - discountRatio))
        tax += (lineTaxable * (it.taxRate ?? 0)) / 100
      }
      tax = round2(tax)
      taxable = afterDiscount
    }
    if (input.interState) {
      igst = tax
    } else {
      cgst = round2(tax / 2)
      sgst = round2(tax - cgst)
    }
  }

  const net = inclusive ? afterDiscount : round2(taxable + tax)
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

// Whether a specific document should carry GST: the company must be GST-registered
// AND the document's GST switch must be on. `gstEnabled === undefined` means follow
// the company (keeps older records that predate the per-document switch working).
export function docUsesGst(company: Company | undefined, gstEnabled?: boolean): boolean {
  if (!isGstCompany(company)) return false
  return gstEnabled ?? true
}

// Cost basis for the profit report: a whole-document cost overrides per-line costs.
export function costBasis(items: LineItem[], originalCost?: number): number {
  if (originalCost && originalCost > 0) return round2(originalCost)
  return round2(items.reduce((s, it) => s + (it.cost || 0) * (it.qty || 0), 0))
}

export function billTotals(bill: Bill, company: Company | undefined): Totals {
  return computeTotals({
    items: bill.items,
    discountAmount: bill.discountAmount,
    discountIsPercent: bill.discountIsPercent,
    receivedAmount: bill.receivedAmount,
    company,
    interState: recipientInterState(company, bill.customerGstin),
    gstEnabled: bill.gstEnabled,
    gstInclusive: bill.gstInclusive,
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
    gstEnabled: quote.gstEnabled,
    gstInclusive: quote.gstInclusive,
  })
}

// Inter-state when the first 2 digits (state code) of supplier & recipient GSTIN differ.
export function recipientInterState(company: Company | undefined, customerGstin?: string): boolean {
  if (!company?.gstin || !customerGstin) return false
  return company.gstin.slice(0, 2) !== customerGstin.slice(0, 2)
}
