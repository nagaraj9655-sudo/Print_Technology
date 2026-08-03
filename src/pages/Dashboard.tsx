import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertCircle, BellRing, IndianRupee, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useStore, useScopedBills, useScopedQuotes } from '../lib/store'
import { billTotals } from '../lib/calc'
import { daysBetween, formatDate, formatINR } from '../lib/format'
import { KpiCard, Section, StatusPill } from '../components/ui'
import { PaymentReminder, type ReminderTarget } from '../components/PaymentReminder'

export default function Dashboard() {
  const { db, activeCompanyId } = useStore()
  const bills = useScopedBills()
  const quotes = useScopedQuotes()
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null)

  // Customers with outstanding balances, oldest first — one-click reminders.
  const remindersDue = useMemo(() => {
    const map = new Map<string, { key: string; customerId?: string; name: string; phone: string; total: number; count: number; oldestAge: number }>()
    for (const b of bills) {
      if (b.docStatus !== 'Finalized') continue
      const t = billTotals(b, db.companies.find((c) => c.id === b.companyId))
      if (t.balance <= 0.001) continue
      const key = b.customerId ?? `${b.customerName}|${b.customerPhone}`
      const age = daysBetween(b.date)
      const cur = map.get(key) ?? { key, customerId: b.customerId, name: b.customerName, phone: b.customerPhone, total: 0, count: 0, oldestAge: 0 }
      cur.total += t.balance
      cur.count += 1
      cur.oldestAge = Math.max(cur.oldestAge, age)
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.oldestAge - a.oldestAge)
  }, [bills, db.companies])

  const data = useMemo(() => {
    const finalized = bills.filter((b) => b.docStatus === 'Finalized')
    let totalBilled = 0
    let totalReceived = 0
    let outstanding = 0
    let pendingCount = 0
    const pending: { id: string; no: string; customer: string; balance: number; age: number; status: string; companyName: string }[] = []

    for (const b of finalized) {
      const company = db.companies.find((c) => c.id === b.companyId)
      const t = billTotals(b, company)
      totalBilled += t.net
      totalReceived += t.received
      outstanding += t.balance
      if (t.balance > 0.001) {
        pendingCount++
        pending.push({
          id: b.id,
          no: b.companyBillNo,
          customer: b.customerName,
          balance: t.balance,
          age: daysBetween(b.date),
          status: t.status,
          companyName: company?.name ?? '',
        })
      }
    }
    pending.sort((a, b) => b.age - a.age)

    // Aging buckets
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const p of pending) {
      if (p.age <= 30) buckets['0-30'] += p.balance
      else if (p.age <= 60) buckets['31-60'] += p.balance
      else if (p.age <= 90) buckets['61-90'] += p.balance
      else buckets['90+'] += p.balance
    }

    // Revenue over time (by month)
    const monthMap = new Map<string, { billed: number; received: number }>()
    for (const b of finalized) {
      const key = b.date.slice(0, 7)
      const t = billTotals(b, db.companies.find((c) => c.id === b.companyId))
      const cur = monthMap.get(key) ?? { billed: 0, received: 0 }
      cur.billed += t.net
      cur.received += t.received
      monthMap.set(key, cur)
    }
    const revenue = [...monthMap.entries()].sort().map(([month, v]) => ({ month: month.slice(2), ...v }))

    // Top customers
    const custMap = new Map<string, number>()
    for (const b of finalized) {
      const t = billTotals(b, db.companies.find((c) => c.id === b.companyId))
      custMap.set(b.customerName, (custMap.get(b.customerName) ?? 0) + t.net)
    }
    const topCustomers = [...custMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))

    // Company comparison (consolidated)
    const companyCompare = db.companies.map((c) => {
      const cb = finalized.filter((b) => b.companyId === c.id)
      const billed = cb.reduce((s, b) => s + billTotals(b, c).net, 0)
      const bal = cb.reduce((s, b) => s + billTotals(b, c).balance, 0)
      return { name: c.name, billed, outstanding: bal }
    })

    return { totalBilled, totalReceived, outstanding, pendingCount, pending, buckets, revenue, topCustomers, companyCompare }
  }, [bills, db.companies])

  const activeQuotes = quotes.filter((q) => q.status === 'Sent' || q.status === 'Draft').length

  const bucketData = [
    { name: '0–30 d', value: data.buckets['0-30'], fill: '#10b981' },
    { name: '31–60 d', value: data.buckets['31-60'], fill: '#f59e0b' },
    { name: '61–90 d', value: data.buckets['61-90'], fill: '#f97316' },
    { name: '90+ d', value: data.buckets['90+'], fill: '#ef4444' },
  ]

  const activity = useMemo(() => {
    const items = [
      ...bills.map((b) => ({ type: 'bill' as const, date: b.updatedAt, label: `Bill ${b.docStatus === 'Draft' ? '(draft)' : b.companyBillNo}`, sub: b.customerName, id: b.id })),
      ...quotes.map((q) => ({ type: 'quote' as const, date: q.updatedAt, label: `Quote ${q.companyQuoteNo}`, sub: q.customerName, id: q.id })),
    ]
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
  }, [bills, quotes])

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {activeCompanyId === 'ALL' ? 'Consolidated — all companies' : db.companies.find((c) => c.id === activeCompanyId)?.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Billed" value={formatINR(data.totalBilled)} icon={IndianRupee} />
        <KpiCard label="Total Received" value={formatINR(data.totalReceived)} accent="text-emerald-600" icon={Wallet} />
        <KpiCard label="Outstanding" value={formatINR(data.outstanding)} accent="text-red-600" sub={`${data.pendingCount} pending bills`} icon={AlertCircle} />
        <KpiCard label="Active Quotes" value={String(activeQuotes)} sub={`${quotes.length} total`} icon={TrendingUp} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Revenue over time">
            <div className="h-64 p-4">
              {data.revenue.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenue} margin={{ left: -10, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="billed" name="Billed" stroke="#1f47f5" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="received" name="Received" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>
        </div>

        <Section title="Outstanding by age">
          <div className="h-64 p-4">
            {data.outstanding === 0 ? (
              <Empty label="No outstanding balances 🎉" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bucketData} margin={{ left: -10, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="value" name="Outstanding" radius={[4, 4, 0, 0]}>
                    {bucketData.map((b, i) => (
                      <Cell key={i} fill={b.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Pending bills widget */}
        <div className="lg:col-span-2">
          <Section title="Pending bills" action={<Link to="/reports" className="text-xs font-medium text-brand-600 hover:underline">View receivables →</Link>}>
            {data.pending.length === 0 ? (
              <Empty label="All bills settled." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Invoice</th>
                      <th className="th">Customer</th>
                      <th className="th text-right">Balance</th>
                      <th className="th text-right">Age</th>
                      <th className="th text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.pending.slice(0, 6).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="td"><Link to={`/bills/${p.id}`} className="font-medium text-brand-600 hover:underline">{p.no}</Link></td>
                        <td className="td">{p.customer}</td>
                        <td className="td text-right font-medium tnum text-red-600">{formatINR(p.balance)}</td>
                        <td className="td text-right tnum text-slate-500">{p.age}d</td>
                        <td className="td text-right"><StatusPill status={p.status as 'Pending' | 'Partial'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        {/* Recent activity */}
        <Section title="Recent activity">
          <ul className="divide-y divide-slate-100">
            {activity.length === 0 && <li className="p-4 text-sm text-slate-400">No activity yet.</li>}
            {activity.map((a, i) => (
              <li key={i}>
                <Link to={a.type === 'bill' ? `/bills/${a.id}` : `/quotations/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.type === 'bill' ? 'bg-brand-50 text-brand-600' : 'bg-violet-50 text-violet-600'}`}>
                    <Receipt className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{a.label}</p>
                    <p className="truncate text-xs text-slate-400">{a.sub} · {formatDate(a.date.slice(0, 10))}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {activeCompanyId === 'ALL' && (
        <div className="mt-5">
          <Section title="Company comparison">
            <div className="h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.companyCompare} margin={{ left: -10, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="billed" name="Billed" fill="#1f47f5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      )}

      {/* Reminders due — customers with outstanding, oldest first */}
      <div className="mt-5">
        <Section title="Reminders due" action={<span className="text-xs text-slate-400">{remindersDue.length} customer{remindersDue.length === 1 ? '' : 's'} owe money</span>}>
          {remindersDue.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">Nothing to chase — all bills settled. 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Customer</th>
                    <th className="th text-right">Bills</th>
                    <th className="th text-right">Outstanding</th>
                    <th className="th text-right">Oldest</th>
                    <th className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {remindersDue.slice(0, 10).map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50">
                      <td className="td">
                        <p className="font-medium text-slate-800">{r.name}</p>
                        <p className="text-xs text-slate-400">{r.phone || 'no phone'}</p>
                      </td>
                      <td className="td text-right tnum text-slate-500">{r.count}</td>
                      <td className="td text-right font-medium tnum text-red-600">{formatINR(r.total)}</td>
                      <td className="td text-right tnum">
                        <span className={r.oldestAge > 90 ? 'font-semibold text-red-600' : r.oldestAge > 60 ? 'text-orange-600' : 'text-slate-500'}>{r.oldestAge}d</span>
                      </td>
                      <td className="td text-right">
                        <button
                          className="btn-outline ml-auto py-1 text-amber-600 hover:bg-amber-50"
                          onClick={() => setReminderTarget({ customerId: r.customerId, customerName: r.name, customerPhone: r.phone })}
                        >
                          <BellRing className="h-4 w-4" /> Remind
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <PaymentReminder open={!!reminderTarget} onClose={() => setReminderTarget(null)} target={reminderTarget} />
    </div>
  )
}

function Empty({ label = 'No data for this period.' }: { label?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-400">{label}</div>
}
