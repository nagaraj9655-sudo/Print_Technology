// Excel exports via SheetJS. Registers export with headers, ₹-formatted numbers,
// a totals row, and a filter summary. Consolidated exports use one sheet per company.

import * as XLSX from 'xlsx'
import type { Bill, Company, Quotation } from './types'
import { billTotals, quoteTotals } from './calc'
import { formatDate } from './format'

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

const RUPEE_FMT = '#,##,##0.00'

function autoWidth(rows: (string | number)[][]): XLSX.ColInfo[] {
  const widths: number[] = []
  rows.forEach((row) =>
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length
      widths[i] = Math.max(widths[i] || 10, Math.min(len + 2, 60))
    }),
  )
  return widths.map((w) => ({ wch: w }))
}

// ---- Single invoice / quote workbook (line items + totals) ----
export function exportBillExcel(bill: Bill, company: Company | undefined) {
  const t = billTotals(bill, company)
  const header = [['#', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Amount']]
  const body = bill.items.map((it, i) => [
    i + 1,
    it.description,
    it.hsnSac ?? '',
    it.qty,
    it.rate,
    it.qty * it.rate,
  ])
  const totals = [
    [],
    ['', '', '', '', 'Gross', t.gross],
    ['', '', '', '', 'Discount', t.discount],
    ['', '', '', '', 'Taxable', t.taxable],
    ...(t.tax > 0
      ? t.igst > 0
        ? [['', '', '', '', 'IGST', t.igst]]
        : [
            ['', '', '', '', 'CGST', t.cgst],
            ['', '', '', '', 'SGST', t.sgst],
          ]
      : []),
    ['', '', '', '', 'Net Payable', t.net],
    ['', '', '', '', 'Received', t.received],
    ['', '', '', '', 'Balance Due', t.balance],
  ]
  const meta = [
    [company?.gstin ? 'TAX INVOICE' : 'INVOICE'],
    [company?.name ?? ''],
    ['Invoice No', bill.companyBillNo, '', 'Date', formatDate(bill.date)],
    ['Bill To', bill.customerName],
    [bill.customerAddress],
    [],
  ]
  const aoa = [...meta, ...header, ...body, ...totals]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = autoWidth(aoa as (string | number)[][])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice')
  download(wb, `${bill.companyBillNo.replace(/[\/\\]/g, '-')}.xlsx`)
}

export function exportQuoteExcel(quote: Quotation, company: Company | undefined) {
  const t = quoteTotals(quote, company)
  const header = [['#', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Amount']]
  const body = quote.items.map((it, i) => [i + 1, it.description, it.hsnSac ?? '', it.qty, it.rate, it.qty * it.rate])
  const totals = [
    [],
    ['', '', '', '', 'Gross', t.gross],
    ['', '', '', '', 'Discount', t.discount],
    ['', '', '', '', 'Taxable', t.taxable],
    ...(t.tax > 0 ? [['', '', '', '', 'Tax', t.tax]] : []),
    ['', '', '', '', 'Total', t.net],
  ]
  const meta = [
    ['QUOTATION'],
    [company?.name ?? ''],
    ['Quote No', quote.companyQuoteNo, '', 'Date', formatDate(quote.date)],
    ['Valid Until', formatDate(quote.validUntil)],
    ['To', quote.customerName],
    [],
  ]
  const aoa = [...meta, ...header, ...body, ...totals]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = autoWidth(aoa as (string | number)[][])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Quotation')
  download(wb, `${quote.companyQuoteNo.replace(/[\/\\]/g, '-')}.xlsx`)
}

// ---- Registers / reports ----
interface RegisterMeta {
  title: string
  filterSummary: string[]
}

export function exportBillRegister(bills: Bill[], companies: Company[], meta: RegisterMeta) {
  const wb = XLSX.utils.book_new()
  const byCompany = new Map<string, Bill[]>()
  for (const b of bills) {
    const arr = byCompany.get(b.companyId) ?? []
    arr.push(b)
    byCompany.set(b.companyId, arr)
  }

  const buildSheet = (rows: Bill[], sheetName: string) => {
    const head = ['Bill No', 'Invoice No', 'Date', 'Company', 'Customer', 'Phone', 'Gross', 'Discount', 'Tax', 'Net', 'Received', 'Balance', 'Status']
    const aoa: (string | number)[][] = [[meta.title], ...meta.filterSummary.map((s) => [s]), [], head]
    let net = 0, recv = 0, bal = 0
    for (const b of rows) {
      const company = companies.find((c) => c.id === b.companyId)
      const t = billTotals(b, company)
      net += t.net; recv += t.received; bal += t.balance
      aoa.push([
        b.billNo || '', b.companyBillNo, formatDate(b.date), company?.name ?? '', b.customerName, b.customerPhone,
        t.gross, t.discount, t.tax, t.net, t.received, t.balance, t.status,
      ])
    }
    aoa.push(['', '', '', '', '', 'TOTAL', '', '', '', net, recv, bal, ''])
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = autoWidth(aoa)
    applyRupeeFormat(ws, aoa, [6, 7, 8, 9, 10, 11])
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  }

  if (byCompany.size > 1) {
    buildSheet(bills, 'All Companies')
    for (const [cid, rows] of byCompany) {
      const name = companies.find((c) => c.id === cid)?.name ?? 'Company'
      buildSheet(rows, name)
    }
  } else {
    buildSheet(bills, 'Register')
  }
  download(wb, `${meta.title.replace(/\s+/g, '_')}.xlsx`)
}

export function exportQuoteRegister(quotes: Quotation[], companies: Company[], meta: RegisterMeta) {
  const head = ['Quote No', 'Quote Ref', 'Date', 'Company', 'Customer', 'Valid Until', 'Total', 'Status']
  const aoa: (string | number)[][] = [[meta.title], ...meta.filterSummary.map((s) => [s]), [], head]
  let total = 0
  for (const q of quotes) {
    const company = companies.find((c) => c.id === q.companyId)
    const t = quoteTotals(q, company)
    total += t.net
    aoa.push([q.quoteNo || '', q.companyQuoteNo, formatDate(q.date), company?.name ?? '', q.customerName, formatDate(q.validUntil), t.net, q.status])
  }
  aoa.push(['', '', '', '', '', 'TOTAL', total, ''])
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = autoWidth(aoa)
  applyRupeeFormat(ws, aoa, [6])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Quotations')
  download(wb, `${meta.title.replace(/\s+/g, '_')}.xlsx`)
}

export function exportGenericSheet(title: string, head: string[], rows: (string | number)[][], moneyCols: number[] = []) {
  const aoa: (string | number)[][] = [[title], [], head, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = autoWidth(aoa)
  applyRupeeFormat(ws, aoa, moneyCols)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  download(wb, `${title.replace(/\s+/g, '_')}.xlsx`)
}

function applyRupeeFormat(ws: XLSX.WorkSheet, aoa: (string | number)[][], cols: number[]) {
  for (let r = 0; r < aoa.length; r++) {
    for (const c of cols) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (cell && typeof cell.v === 'number') cell.z = RUPEE_FMT
    }
  }
}

// Full database backup (one-click export so the owner is never locked in).
export function exportFullBackup(db: { bills: Bill[]; quotations: Quotation[]; companies: Company[]; customers: unknown[] }) {
  const wb = XLSX.utils.book_new()
  const companiesWs = XLSX.utils.json_to_sheet(db.companies)
  XLSX.utils.book_append_sheet(wb, companiesWs, 'Companies')
  const customersWs = XLSX.utils.json_to_sheet(db.customers as Record<string, unknown>[])
  XLSX.utils.book_append_sheet(wb, customersWs, 'Customers')
  const billsWs = XLSX.utils.json_to_sheet(db.bills.filter(Boolean).map(({ items, payments, ...b }) => ({ ...b, itemCount: items?.length ?? 0, paymentCount: payments?.length ?? 0 })))
  XLSX.utils.book_append_sheet(wb, billsWs, 'Bills')
  const quotesWs = XLSX.utils.json_to_sheet(db.quotations.filter(Boolean).map(({ items, ...q }) => ({ ...q, itemCount: items?.length ?? 0 })))
  XLSX.utils.book_append_sheet(wb, quotesWs, 'Quotations')
  download(wb, `Magizhini_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
