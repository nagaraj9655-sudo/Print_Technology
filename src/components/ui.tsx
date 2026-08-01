import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { PaymentStatus, QuoteStatus } from '../lib/types'

// ---------------- Toasts ----------------
type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: string
  kind: ToastKind
  message: string
}
interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void
}
const ToastContext = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="no-print fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-soft animate-[slidein_.2s_ease]"
          >
            {t.kind === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            {t.kind === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
            {t.kind === 'info' && <Info className="h-4 w-4 text-brand-500" />}
            <span className="text-slate-700">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast within ToastProvider')
  return ctx.toast
}

// ---------------- Status pills ----------------
export function StatusPill({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Partial: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    Pending: 'bg-red-50 text-red-700 ring-red-600/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status]}`}>
      {status}
    </span>
  )
}

export function QuotePill({ status }: { status: QuoteStatus }) {
  const map: Record<QuoteStatus, string> = {
    Draft: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    Sent: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    Accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
    Expired: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    Converted: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status]}`}>
      {status}
    </span>
  )
}

// ---------------- Modal ----------------
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className={`mt-16 w-full ${width} rounded-xl border border-slate-200 bg-white shadow-soft`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ---------------- Confirm dialog ----------------
export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; message: string; resolve?: (v: boolean) => void }>({
    open: false,
    message: '',
  })
  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => setState({ open: true, message, resolve }))
  }, [])
  const node = (
    <Modal open={state.open} onClose={() => { state.resolve?.(false); setState({ open: false, message: '' }) }} title="Please confirm" size="sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <p className="text-sm text-slate-600">{state.message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={() => { state.resolve?.(false); setState({ open: false, message: '' }) }}>
          Cancel
        </button>
        <button className="btn-danger" onClick={() => { state.resolve?.(true); setState({ open: false, message: '' }) }}>
          Confirm
        </button>
      </div>
    </Modal>
  )
  return { confirm, node }
}

// ---------------- Empty state ----------------
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------------- KPI card ----------------
export function KpiCard({
  label,
  value,
  sub,
  accent = 'text-slate-800',
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-300" />}
      </div>
      <p className={`mt-2 text-2xl font-bold tnum ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}
