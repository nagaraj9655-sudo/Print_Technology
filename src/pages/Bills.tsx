import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, FileSpreadsheet, Filter, Plus, Receipt, Trash2 } from 'lucide-react'
import { useStore, useScopedBills } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatDate, formatINR } from '../lib/format'
import { EmptyState, StatusPill } from '../components/ui'
import { exportBillRegister } from '../lib/excel'
import type { PaymentStatus } from '../lib/types'

type SortKey = 'date' | 'companyBillNo' | 'customerName' | 'net' | 'status'

export default function Bills() {
  const { db, activeCompanyId, currentUser } = useStore()
  const bills = useScopedBills()
  const navigate = useNavigate()
  const deletedCount = db.bills.filter(
    (b) => b.deletedAt && (activeCompanyId === 'ALL' ? true : b.companyId === activeCompanyId),
  ).length

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | PaymentStatus | 'Draft'>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const rows = useMemo(() => {
    let list = bills.map((b) => ({ bill: b, t: billTotals(b, db.companies.find((c) => c.id === b.companyId)) }))
    const term = search.trim().toLowerCase()
    if (term)
      list = list.filter(
        (r) =>
          r.bill.companyBillNo.toLowerCase().includes(term) ||
          r.bill.customerName.toLowerCase().includes(term) ||
          r.bill.customerPhone.includes(term),
      )
    if (status) {
      if (status === 'Draft') list = list.filter((r) => r.bill.docStatus === 'Draft')
      else list = list.filter((r) => r.bill.docStatus === 'Finalized' && r.t.status === status)
    }
    if (from) list = list.filter((r) => r.bill.date >= from)
    if (to) list = list.filter((r) => r.bill.date <= to)

    list.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1
      switch (sort.key) {
        case 'date':
          return (a.bill.date < b.bill.date ? -1 : 1) * dir
        case 'companyBillNo':
          return a.bill.companyBillNo.localeCompare(b.bill.companyBillNo) * dir
        case 'customerName':
          return a.bill.customerName.localeCompare(b.bill.customerName) * dir
        case 'net':
          return (a.t.net - b.t.net) * dir
        case 'status':
          return a.t.status.localeCompare(b.t.status) * dir
      }
    })
    return list
  }, [bills, db.companies, search, status, from, to, sort])

  const totalNet = rows.reduce((s, r) => s + r.t.net, 0)
  const totalBalance = rows.reduce((s, r) => s + r.t.balance, 0)

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const exportList = (onlySelected: boolean) => {
    const source = onlySelected ? rows.filter((r) => selected.has(r.bill.id)) : rows
    exportBillRegister(
      source.map((r) => r.bill),
      db.companies,
      {
        title: 'Bill Register',
        filterSummary: [
          `Company: ${activeCompanyId === 'ALL' ? 'All Companies' : db.companies.find((c) => c.id === activeCompanyId)?.name}`,
          `Rows: ${source.length}${onlySelected ? ' (selected)' : ''}`,
          from || to ? `Period: ${from || '…'} to ${to || '…'}` : 'Period: all',
        ],
      },
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Bills</h1>
          <p className="text-sm text-slate-500">{rows.length} bills · Net {formatINR(totalNet)} · Outstanding {formatINR(totalBalance)}</p>
        </div>
        <div className="flex gap-2">
          {currentUser?.role === 'Admin' && (
            <Link to="/bills/trash" className="btn-outline">
              <Trash2 className="h-4 w-4" /> Recycle Bin
              {deletedCount > 0 && (
                <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-xs font-semibold text-slate-600">{deletedCount}</span>
              )}
            </Link>
          )}
          <button className="btn-outline" onClick={() => exportList(false)}>
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
          <Link to="/bills/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New Bill
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label">Search</label>
          <input className="input" placeholder="Invoice no, customer, phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">All</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {(search || status || from || to) && (
          <button className="btn-ghost" onClick={() => { setSearch(''); setStatus(''); setFrom(''); setTo('') }}>
            <Filter className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          <span className="font-medium">{selected.size} selected</span>
          <button className="btn-ghost text-brand-700" onClick={() => exportList(true)}>
            <Download className="h-4 w-4" /> Export selection
          </button>
          <button className="btn-ghost text-brand-700" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills found"
          hint="Create your first bill or adjust the filters."
          action={<Link to="/bills/new" className="btn-primary"><Plus className="h-4 w-4" /> New Bill</Link>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="th w-8"></th>
                    <SortableTh label="Invoice" k="companyBillNo" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Date" k="date" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Customer" k="customerName" sort={sort} onSort={toggleSort} />
                    <th className="th text-right">Net</th>
                    <th className="th text-right">Balance</th>
                    <SortableTh label="Status" k="status" sort={sort} onSort={toggleSort} right />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ bill, t }) => (
                    <tr
                      key={bill.id}
                      className="cursor-pointer even:bg-slate-50/40 hover:bg-brand-50/40"
                      onClick={() => navigate(`/bills/${bill.id}`)}
                    >
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(bill.id)} onChange={() => toggleSelect(bill.id)} />
                      </td>
                      <td className="td">
                        <span className="font-medium text-slate-800">{bill.docStatus === 'Draft' ? 'Draft' : bill.companyBillNo}</span>
                        {activeCompanyId === 'ALL' && (
                          <span className="ml-2 text-xs text-slate-400">{db.companies.find((c) => c.id === bill.companyId)?.name}</span>
                        )}
                      </td>
                      <td className="td text-slate-500">{formatDate(bill.date)}</td>
                      <td className="td">{bill.customerName}</td>
                      <td className="td text-right font-medium tnum">{formatINR(t.net)}</td>
                      <td className={`td text-right tnum ${t.balance > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatINR(t.balance)}</td>
                      <td className="td text-right">
                        {bill.docStatus === 'Draft' ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Draft</span>
                        ) : (
                          <StatusPill status={t.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {rows.map(({ bill, t }) => (
              <Link key={bill.id} to={`/bills/${bill.id}`} className="card block p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{bill.docStatus === 'Draft' ? 'Draft' : bill.companyBillNo}</span>
                  {bill.docStatus === 'Draft' ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Draft</span>
                  ) : (
                    <StatusPill status={t.status} />
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{bill.customerName}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">{formatDate(bill.date)}</span>
                  <span className="font-medium tnum">{formatINR(t.net)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SortableTh({
  label,
  k,
  sort,
  onSort,
  right,
}: {
  label: string
  k: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  right?: boolean
}) {
  return (
    <th className={`th ${right ? 'text-right' : ''}`}>
      <button className="inline-flex items-center gap-1 hover:text-slate-700" onClick={() => onSort(k)}>
        {label}
        {sort.key === k && <span className="text-brand-500">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}
