import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Receipt,
  Search,
  Settings as SettingsIcon,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { formatINR } from '../lib/format'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/quotations', label: 'Quotations', icon: FileText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/reports', label: 'Reports', icon: PieChart },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/users', label: 'Users', icon: UserCog, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { currentUser } = useStore()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-60 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            B
          </div>
          <span className="text-[15px] font-bold tracking-tight text-slate-800">BillFlow</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.filter((item) => !item.adminOnly || currentUser?.role === 'Admin').map((item) => {
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { currentUser, logout } = useStore()
  const [userMenu, setUserMenu] = useState(false)

  return (
    <header className="no-print z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button className="lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5 text-slate-500" />
      </button>

      <CompanySwitcher />
      <GlobalSearch />

      <div className="relative ml-auto">
        <button
          onClick={() => setUserMenu((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
            {currentUser?.name?.slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight text-slate-700">{currentUser?.name}</p>
            <p className="text-[11px] leading-tight text-slate-400">{currentUser?.role}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        {userMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-soft">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-xs text-slate-500">{currentUser?.email}</p>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function CompanySwitcher() {
  const { db, activeCompanyId, setActiveCompanyId, activeCompany } = useStore()
  const [open, setOpen] = useState(false)
  const label = activeCompanyId === 'ALL' ? 'All Companies' : activeCompany?.name ?? 'Select company'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: activeCompanyId === 'ALL' ? '#94a3b8' : activeCompany?.accent ?? '#1f47f5' }}
        />
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-soft">
            <button
              onClick={() => { setActiveCompanyId('ALL'); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${activeCompanyId === 'ALL' ? 'font-semibold text-brand-700' : 'text-slate-600'}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> All Companies
              <span className="ml-auto text-[11px] text-slate-400">Consolidated</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            {db.companies.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveCompanyId(c.id); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${activeCompanyId === c.id ? 'font-semibold text-brand-700' : 'text-slate-600'}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent ?? '#1f47f5' }} />
                <span className="truncate">{c.name}</span>
                {c.gstin ? <span className="ml-auto text-[10px] font-medium text-emerald-600">GST</span> : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GlobalSearch() {
  const { db } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return { bills: [], quotes: [], customers: [] }
    const bills = db.bills
      .filter((b) => !b.deletedAt)
      .filter(
        (b) =>
          b.companyBillNo.toLowerCase().includes(term) ||
          b.customerName.toLowerCase().includes(term) ||
          b.customerPhone.includes(term) ||
          String(b.billNo).includes(term),
      )
      .slice(0, 5)
    const quotes = db.quotations
      .filter((qq) => !qq.deletedAt)
      .filter((qq) => qq.companyQuoteNo.toLowerCase().includes(term) || qq.customerName.toLowerCase().includes(term))
      .slice(0, 4)
    const customers = db.customers
      .filter((c) => c.name.toLowerCase().includes(term) || c.phone.includes(term))
      .slice(0, 4)
    return { bills, quotes, customers }
  }, [q, db])

  const hasResults = results.bills.length + results.quotes.length + results.customers.length > 0

  return (
    <div className="relative hidden flex-1 max-w-md sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search bills, quotes, customers…"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
      />
      {open && q && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 shadow-soft">
            {!hasResults && <p className="px-3 py-2 text-sm text-slate-400">No matches</p>}
            {results.bills.length > 0 && <p className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-400">Bills</p>}
            {results.bills.map((b) => (
              <button key={b.id} onClick={() => { navigate(`/bills/${b.id}`); setOpen(false); setQ('') }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-slate-50">
                <span className="text-slate-700">{b.companyBillNo} · {b.customerName}</span>
                <span className="tnum text-xs text-slate-400">{formatINR(b.items.reduce((s, i) => s + i.qty * i.rate, 0))}</span>
              </button>
            ))}
            {results.quotes.length > 0 && <p className="mt-1 px-3 py-1 text-[10px] font-semibold uppercase text-slate-400">Quotations</p>}
            {results.quotes.map((qq) => (
              <button key={qq.id} onClick={() => { navigate(`/quotations/${qq.id}`); setOpen(false); setQ('') }}
                className="flex w-full items-center px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                {qq.companyQuoteNo} · {qq.customerName}
              </button>
            ))}
            {results.customers.length > 0 && <p className="mt-1 px-3 py-1 text-[10px] font-semibold uppercase text-slate-400">Customers</p>}
            {results.customers.map((c) => (
              <button key={c.id} onClick={() => { navigate('/customers'); setOpen(false); setQ('') }}
                className="flex w-full items-center px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                {c.name} · {c.phone}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
