import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, FileText, Plus } from 'lucide-react'
import { useStore, useScopedQuotes } from '../lib/store'
import { quoteTotals } from '../lib/calc'
import { formatDate, formatINR } from '../lib/format'
import { EmptyState, QuotePill } from '../components/ui'
import { exportQuoteRegister } from '../lib/excel'
import type { QuoteStatus } from '../lib/types'

export default function Quotations() {
  const { db, activeCompanyId } = useStore()
  const quotes = useScopedQuotes()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'' | QuoteStatus>('')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    let list = quotes.map((q) => ({ q, t: quoteTotals(q, db.companies.find((c) => c.id === q.companyId)) }))
    const term = search.trim().toLowerCase()
    if (term) list = list.filter((r) => r.q.companyQuoteNo.toLowerCase().includes(term) || r.q.customerName.toLowerCase().includes(term))
    if (status) list = list.filter((r) => r.q.status === status)
    list.sort((a, b) => (a.q.date < b.q.date ? 1 : -1))
    return list
  }, [quotes, db.companies, status, search])

  const accepted = quotes.filter((q) => q.status === 'Accepted' || q.status === 'Converted').length
  const conversion = quotes.length ? Math.round((accepted / quotes.length) * 100) : 0

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quotations</h1>
          <p className="text-sm text-slate-500">{rows.length} quotes · {conversion}% accepted/converted</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-outline"
            onClick={() =>
              exportQuoteRegister(rows.map((r) => r.q), db.companies, {
                title: 'Quotation Register',
                filterSummary: [`Company: ${activeCompanyId === 'ALL' ? 'All' : db.companies.find((c) => c.id === activeCompanyId)?.name}`, `Rows: ${rows.length}`],
              })
            }
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
          <Link to="/quotations/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New Quotation
          </Link>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label">Search</label>
          <input className="input" placeholder="Quote no or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">All</option>
            {(['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted'] as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotations yet"
          hint="Create a quotation and convert it to a bill once accepted."
          action={<Link to="/quotations/new" className="btn-primary"><Plus className="h-4 w-4" /> New Quotation</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Quote No</th>
                  <th className="th">Date</th>
                  <th className="th">Customer</th>
                  <th className="th">Valid Until</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ q, t }) => (
                  <tr key={q.id} className="cursor-pointer even:bg-slate-50/40 hover:bg-brand-50/40" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <td className="td font-medium text-slate-800">
                      {q.companyQuoteNo}
                      {activeCompanyId === 'ALL' && <span className="ml-2 text-xs text-slate-400">{db.companies.find((c) => c.id === q.companyId)?.name}</span>}
                    </td>
                    <td className="td text-slate-500">{formatDate(q.date)}</td>
                    <td className="td">{q.customerName}</td>
                    <td className="td text-slate-500">{formatDate(q.validUntil)}</td>
                    <td className="td text-right font-medium tnum">{formatINR(t.net)}</td>
                    <td className="td text-right"><QuotePill status={q.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
