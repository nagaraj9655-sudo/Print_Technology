import { useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useStore, useScopedBills, useScopedQuotes } from '../lib/store'
import { billTotals, quoteTotals } from '../lib/calc'
import { daysBetween, formatDate, formatINR } from '../lib/format'
import { exportBillRegister, exportGenericSheet, exportQuoteRegister } from '../lib/excel'
import type { Bill } from '../lib/types'

type Tab = 'sales' | 'receivables' | 'payments' | 'quotes' | 'statement' | 'company' | 'gst'

const TABS: { key: Tab; label: string }[] = [
  { key: 'sales', label: 'Sales Register' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'payments', label: 'Payments' },
  { key: 'quotes', label: 'Quotations' },
  { key: 'statement', label: 'Customer Statement' },
  { key: 'company', label: 'Company Summary' },
  { key: 'gst', label: 'GST Summary' },
]

export default function Reports() {
  const { db, activeCompanyId } = useStore()
  const bills = useScopedBills()
  const quotes = useScopedQuotes()
  const [tab, setTab] = useState<Tab>('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [customerId, setCustomerId] = useState('')

  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to)
  const finalized = bills.filter((b) => b.docStatus === 'Finalized' && inRange(b.date))
  const companyName = (id: string) => db.companies.find((c) => c.id === id)?.name ?? ''
  const scopeLabel = activeCompanyId === 'ALL' ? 'All Companies' : companyName(activeCompanyId)
  const filterSummary = [`Company: ${scopeLabel}`, from || to ? `Period: ${from || '…'} to ${to || '…'}` : 'Period: all']

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Reports</h1>
        <p className="text-sm text-slate-500">Filterable by company &amp; date range · export to Excel</p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {tab === 'statement' && (
          <div className="min-w-[220px]">
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer…</option>
              {db.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tab === 'sales' && <SalesRegister bills={finalized} db={db} companyName={companyName} onExport={() => exportBillRegister(finalized, db.companies, { title: 'Sales Register', filterSummary })} />}
      {tab === 'receivables' && <Receivables bills={finalized} companyName={companyName} db={db} filterSummary={filterSummary} />}
      {tab === 'payments' && <Payments bills={finalized} companyName={companyName} filterSummary={filterSummary} />}
      {tab === 'quotes' && (
        <QuotesReport
          quotes={quotes.filter((q) => inRange(q.date))}
          db={db}
          onExport={() => exportQuoteRegister(quotes.filter((q) => inRange(q.date)), db.companies, { title: 'Quotation Report', filterSummary })}
        />
      )}
      {tab === 'statement' && <Statement bills={bills.filter((b) => b.docStatus === 'Finalized')} customerId={customerId} db={db} />}
      {tab === 'company' && <CompanySummary bills={finalized} db={db} filterSummary={filterSummary} />}
      {tab === 'gst' && <GstSummary bills={finalized} db={db} filterSummary={filterSummary} />}
    </div>
  )
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn-outline" onClick={onClick}>
      <FileSpreadsheet className="h-4 w-4" /> Export Excel
    </button>
  )
}

function ReportShell({ title, onExport, children }: { title: string; onExport?: () => void; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {onExport && <ExportBtn onClick={onExport} />}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function SalesRegister({ bills, db, companyName, onExport }: { bills: Bill[]; db: ReturnType<typeof useStore>['db']; companyName: (id: string) => string; onExport: () => void }) {
  const rows = bills.map((b) => ({ b, t: billTotals(b, db.companies.find((c) => c.id === b.companyId)) }))
  const totalNet = rows.reduce((s, r) => s + r.t.net, 0)
  return (
    <ReportShell title="Sales / Billing register" onExport={onExport}>
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="th">Invoice</th><th className="th">Date</th><th className="th">Company</th><th className="th">Customer</th>
            <th className="th text-right">Gross</th><th className="th text-right">Discount</th><th className="th text-right">Tax</th><th className="th text-right">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ b, t }) => (
            <tr key={b.id} className="even:bg-slate-50/40">
              <td className="td font-medium">{b.companyBillNo}</td>
              <td className="td text-slate-500">{formatDate(b.date)}</td>
              <td className="td text-slate-500">{companyName(b.companyId)}</td>
              <td className="td">{b.customerName}</td>
              <td className="td text-right tnum">{formatINR(t.gross)}</td>
              <td className="td text-right tnum">{formatINR(t.discount)}</td>
              <td className="td text-right tnum">{formatINR(t.tax)}</td>
              <td className="td text-right font-medium tnum">{formatINR(t.net)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} className="td py-6 text-center text-slate-400">No bills in range.</td></tr>}
        </tbody>
        <tfoot><tr className="bg-slate-50 font-semibold"><td className="td" colSpan={7}>Total</td><td className="td text-right tnum">{formatINR(totalNet)}</td></tr></tfoot>
      </table>
    </ReportShell>
  )
}

function Receivables({ bills, companyName, db, filterSummary }: { bills: Bill[]; companyName: (id: string) => string; db: ReturnType<typeof useStore>['db']; filterSummary: string[] }) {
  const rows = bills
    .map((b) => ({ b, t: billTotals(b, db.companies.find((c) => c.id === b.companyId)), age: daysBetween(b.date) }))
    .filter((r) => r.t.balance > 0.001)
    .sort((a, b) => b.age - a.age)
  const total = rows.reduce((s, r) => s + r.t.balance, 0)
  const exp = () =>
    exportGenericSheet('Receivables Report', ['Invoice', 'Date', 'Company', 'Customer', 'Net', 'Received', 'Balance', 'Age (days)', 'Status'],
      rows.map((r) => [r.b.companyBillNo, formatDate(r.b.date), companyName(r.b.companyId), r.b.customerName, r.t.net, r.t.received, r.t.balance, r.age, r.t.status]),
      [4, 5, 6])
  return (
    <ReportShell title="Outstanding / Receivables" onExport={exp}>
      <table className="w-full">
        <thead className="bg-slate-50"><tr><th className="th">Invoice</th><th className="th">Customer</th><th className="th text-right">Net</th><th className="th text-right">Received</th><th className="th text-right">Balance</th><th className="th text-right">Age</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ b, t, age }) => (
            <tr key={b.id} className="even:bg-slate-50/40">
              <td className="td font-medium">{b.companyBillNo}</td><td className="td">{b.customerName}</td>
              <td className="td text-right tnum">{formatINR(t.net)}</td><td className="td text-right tnum text-emerald-600">{formatINR(t.received)}</td>
              <td className="td text-right font-medium tnum text-red-600">{formatINR(t.balance)}</td>
              <td className="td text-right tnum"><span className={age > 90 ? 'font-semibold text-red-600' : age > 60 ? 'text-orange-600' : 'text-slate-500'}>{age}d</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="td py-6 text-center text-slate-400">No outstanding balances.</td></tr>}
        </tbody>
        <tfoot><tr className="bg-slate-50 font-semibold"><td className="td" colSpan={4}>Total outstanding</td><td className="td text-right tnum text-red-600">{formatINR(total)}</td><td className="td"></td></tr></tfoot>
      </table>
    </ReportShell>
  )
}

function Payments({ bills, companyName, filterSummary }: { bills: Bill[]; companyName: (id: string) => string; filterSummary: string[] }) {
  const rows = bills.flatMap((b) => b.payments.map((p) => ({ b, p })))
  rows.sort((a, b) => (a.p.date < b.p.date ? 1 : -1))
  const total = rows.reduce((s, r) => s + r.p.amount, 0)
  const exp = () =>
    exportGenericSheet('Payments Received', ['Date', 'Invoice', 'Company', 'Customer', 'Mode', 'Amount'],
      rows.map((r) => [formatDate(r.p.date), r.b.companyBillNo, companyName(r.b.companyId), r.b.customerName, r.p.mode ?? '', r.p.amount]), [5])
  return (
    <ReportShell title="Payments received" onExport={exp}>
      <table className="w-full">
        <thead className="bg-slate-50"><tr><th className="th">Date</th><th className="th">Invoice</th><th className="th">Customer</th><th className="th">Mode</th><th className="th text-right">Amount</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="even:bg-slate-50/40">
              <td className="td text-slate-500">{formatDate(r.p.date)}</td><td className="td font-medium">{r.b.companyBillNo}</td>
              <td className="td">{r.b.customerName}</td><td className="td text-slate-500">{r.p.mode}</td>
              <td className="td text-right font-medium tnum text-emerald-600">{formatINR(r.p.amount)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="td py-6 text-center text-slate-400">No payments in range.</td></tr>}
        </tbody>
        <tfoot><tr className="bg-slate-50 font-semibold"><td className="td" colSpan={4}>Total received</td><td className="td text-right tnum text-emerald-600">{formatINR(total)}</td></tr></tfoot>
      </table>
    </ReportShell>
  )
}

function QuotesReport({ quotes, db, onExport }: { quotes: ReturnType<typeof useScopedQuotes>; db: ReturnType<typeof useStore>['db']; onExport: () => void }) {
  const accepted = quotes.filter((q) => q.status === 'Accepted' || q.status === 'Converted').length
  const conversion = quotes.length ? Math.round((accepted / quotes.length) * 100) : 0
  return (
    <ReportShell title={`Quotations · ${conversion}% conversion`} onExport={onExport}>
      <table className="w-full">
        <thead className="bg-slate-50"><tr><th className="th">Quote</th><th className="th">Date</th><th className="th">Customer</th><th className="th text-right">Total</th><th className="th text-right">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {quotes.map((q) => (
            <tr key={q.id} className="even:bg-slate-50/40">
              <td className="td font-medium">{q.companyQuoteNo}</td><td className="td text-slate-500">{formatDate(q.date)}</td>
              <td className="td">{q.customerName}</td><td className="td text-right tnum">{formatINR(quoteTotals(q, db.companies.find((c) => c.id === q.companyId)).net)}</td>
              <td className="td text-right text-slate-600">{q.status}</td>
            </tr>
          ))}
          {quotes.length === 0 && <tr><td colSpan={5} className="td py-6 text-center text-slate-400">No quotations in range.</td></tr>}
        </tbody>
      </table>
    </ReportShell>
  )
}

function Statement({ bills, customerId, db }: { bills: Bill[]; customerId: string; db: ReturnType<typeof useStore>['db'] }) {
  const rows = useMemo(() => {
    if (!customerId) return []
    const list = bills.filter((b) => b.customerId === customerId).sort((a, b) => (a.date < b.date ? -1 : 1))
    let running = 0
    return list.map((b) => {
      const t = billTotals(b, db.companies.find((c) => c.id === b.companyId))
      running += t.balance
      return { b, t, running }
    })
  }, [bills, customerId, db.companies])
  const cust = db.customers.find((c) => c.id === customerId)
  const exp = () =>
    exportGenericSheet(`Statement - ${cust?.name ?? ''}`, ['Invoice', 'Date', 'Net', 'Received', 'Balance', 'Running Balance'],
      rows.map((r) => [r.b.companyBillNo, formatDate(r.b.date), r.t.net, r.t.received, r.t.balance, r.running]), [2, 3, 4, 5])

  if (!customerId) return <div className="card p-8 text-center text-sm text-slate-400">Select a customer to view their statement.</div>
  return (
    <ReportShell title={`Statement — ${cust?.name}`} onExport={exp}>
      <table className="w-full">
        <thead className="bg-slate-50"><tr><th className="th">Invoice</th><th className="th">Date</th><th className="th text-right">Net</th><th className="th text-right">Received</th><th className="th text-right">Balance</th><th className="th text-right">Running Bal.</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ b, t, running }) => (
            <tr key={b.id} className="even:bg-slate-50/40">
              <td className="td font-medium">{b.companyBillNo}</td><td className="td text-slate-500">{formatDate(b.date)}</td>
              <td className="td text-right tnum">{formatINR(t.net)}</td><td className="td text-right tnum text-emerald-600">{formatINR(t.received)}</td>
              <td className="td text-right tnum">{formatINR(t.balance)}</td><td className="td text-right font-medium tnum">{formatINR(running)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="td py-6 text-center text-slate-400">No bills for this customer.</td></tr>}
        </tbody>
      </table>
    </ReportShell>
  )
}

function CompanySummary({ bills, db, filterSummary }: { bills: Bill[]; db: ReturnType<typeof useStore>['db']; filterSummary: string[] }) {
  const rows = db.companies.map((c) => {
    const cb = bills.filter((b) => b.companyId === c.id)
    const billed = cb.reduce((s, b) => s + billTotals(b, c).net, 0)
    const received = cb.reduce((s, b) => s + billTotals(b, c).received, 0)
    const outstanding = cb.reduce((s, b) => s + billTotals(b, c).balance, 0)
    return { name: c.name, count: cb.length, billed, received, outstanding }
  })
  const exp = () =>
    exportGenericSheet('Company Summary', ['Company', 'Bills', 'Billed', 'Received', 'Outstanding'],
      rows.map((r) => [r.name, r.count, r.billed, r.received, r.outstanding]), [2, 3, 4])
  return (
    <ReportShell title="Company-wise / consolidated summary" onExport={exp}>
      <table className="w-full">
        <thead className="bg-slate-50"><tr><th className="th">Company</th><th className="th text-right">Bills</th><th className="th text-right">Billed</th><th className="th text-right">Received</th><th className="th text-right">Outstanding</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.name} className="even:bg-slate-50/40">
              <td className="td font-medium">{r.name}</td><td className="td text-right tnum">{r.count}</td>
              <td className="td text-right tnum">{formatINR(r.billed)}</td><td className="td text-right tnum text-emerald-600">{formatINR(r.received)}</td>
              <td className="td text-right tnum text-red-600">{formatINR(r.outstanding)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className="td">Consolidated</td><td className="td text-right tnum">{rows.reduce((s, r) => s + r.count, 0)}</td>
            <td className="td text-right tnum">{formatINR(rows.reduce((s, r) => s + r.billed, 0))}</td>
            <td className="td text-right tnum">{formatINR(rows.reduce((s, r) => s + r.received, 0))}</td>
            <td className="td text-right tnum">{formatINR(rows.reduce((s, r) => s + r.outstanding, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </ReportShell>
  )
}

function GstSummary({ bills, db, filterSummary }: { bills: Bill[]; db: ReturnType<typeof useStore>['db']; filterSummary: string[] }) {
  const gstCompanies = db.companies.filter((c) => c.gstin)
  const rows = gstCompanies.map((c) => {
    const cb = bills.filter((b) => b.companyId === c.id)
    let taxable = 0, cgst = 0, sgst = 0, igst = 0
    for (const b of cb) {
      const t = billTotals(b, c)
      taxable += t.taxable; cgst += t.cgst; sgst += t.sgst; igst += t.igst
    }
    return { name: c.name, gstin: c.gstin!, taxable, cgst, sgst, igst, tax: cgst + sgst + igst }
  })
  const exp = () =>
    exportGenericSheet('GST Working Summary', ['Company', 'GSTIN', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax'],
      rows.map((r) => [r.name, r.gstin, r.taxable, r.cgst, r.sgst, r.igst, r.tax]), [2, 3, 4, 5, 6])
  return (
    <div>
      <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
        ⚠ Working summary only — <strong>not a filed GST return</strong>. Verify against current CBIC notifications and each company's registration before filing.
      </div>
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">No GST-registered companies in scope.</div>
      ) : (
        <ReportShell title="GST summary (internal working figure)" onExport={exp}>
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className="th">Company</th><th className="th">GSTIN</th><th className="th text-right">Taxable</th><th className="th text-right">CGST</th><th className="th text-right">SGST</th><th className="th text-right">IGST</th><th className="th text-right">Total Tax</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.name} className="even:bg-slate-50/40">
                  <td className="td font-medium">{r.name}</td><td className="td text-slate-500">{r.gstin}</td>
                  <td className="td text-right tnum">{formatINR(r.taxable)}</td><td className="td text-right tnum">{formatINR(r.cgst)}</td>
                  <td className="td text-right tnum">{formatINR(r.sgst)}</td><td className="td text-right tnum">{formatINR(r.igst)}</td>
                  <td className="td text-right font-medium tnum">{formatINR(r.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportShell>
      )}
    </div>
  )
}
