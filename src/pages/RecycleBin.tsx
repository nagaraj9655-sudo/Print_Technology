import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, RotateCcw, Trash2, ShieldAlert } from 'lucide-react'
import { useStore } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatDate, formatINR } from '../lib/format'
import { EmptyState, Modal, useToast } from '../components/ui'
import { exportBillExcel } from '../lib/excel'
import type { Bill } from '../lib/types'

// Password required to permanently remove a bill from the recycle bin.
const DELETE_PASSWORD = 'arul@123'

export default function RecycleBin() {
  const { db, activeCompanyId, currentUser, restoreBill, permanentlyDeleteBill } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [target, setTarget] = useState<Bill | null>(null)
  const [password, setPassword] = useState('')

  const isAdmin = currentUser?.role === 'Admin'

  const rows = useMemo(() => {
    return db.bills
      .filter((b) => b.deletedAt)
      .filter((b) => (activeCompanyId === 'ALL' ? true : b.companyId === activeCompanyId))
      .map((b) => ({ bill: b, t: billTotals(b, db.companies.find((c) => c.id === b.companyId)) }))
      .sort((a, b) => (a.bill.deletedAt! < b.bill.deletedAt! ? 1 : -1))
  }, [db.bills, db.companies, activeCompanyId])

  const onRestore = (bill: Bill) => {
    restoreBill(bill.id)
    toast(`Bill ${bill.companyBillNo} restored`)
  }

  const closeModal = () => {
    setTarget(null)
    setPassword('')
  }

  const confirmPermanentDelete = () => {
    if (!target) return
    if (password !== DELETE_PASSWORD) {
      toast('Incorrect password', 'error')
      return
    }
    const label = target.companyBillNo
    permanentlyDeleteBill(target.id)
    toast(`Bill ${label} permanently deleted`, 'info')
    closeModal()
  }

  if (!isAdmin) {
    return (
      <div>
        <button onClick={() => navigate('/bills')} className="btn-ghost -ml-2 mb-4">
          <ArrowLeft className="h-4 w-4" /> Bills
        </button>
        <EmptyState icon={ShieldAlert} title="Admins only" hint="Only an Admin can view and manage the recycle bin." />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate('/bills')} className="btn-ghost -ml-2 mb-1">
            <ArrowLeft className="h-4 w-4" /> Bills
          </button>
          <h1 className="text-xl font-bold text-slate-800">Recycle Bin</h1>
          <p className="text-sm text-slate-500">
            {rows.length} deleted {rows.length === 1 ? 'bill' : 'bills'} · restore, or permanently remove with the password
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Recycle bin is empty"
          hint="Bills you delete are moved here. You can restore them or delete them permanently."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="th">Invoice</th>
                    <th className="th">Bill Date</th>
                    <th className="th">Customer</th>
                    <th className="th text-right">Net</th>
                    <th className="th">Deleted</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ bill, t }) => (
                    <tr key={bill.id} className="even:bg-slate-50/40">
                      <td className="td">
                        <span className="font-medium text-slate-800">{bill.docStatus === 'Draft' ? 'Draft' : bill.companyBillNo}</span>
                        {activeCompanyId === 'ALL' && (
                          <span className="ml-2 text-xs text-slate-400">{db.companies.find((c) => c.id === bill.companyId)?.name}</span>
                        )}
                      </td>
                      <td className="td text-slate-500">{formatDate(bill.date)}</td>
                      <td className="td">{bill.customerName}</td>
                      <td className="td text-right font-medium tnum">{formatINR(t.net)}</td>
                      <td className="td text-slate-500">{bill.deletedAt ? formatDate(bill.deletedAt.slice(0, 10)) : '—'}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-2">
                          <button className="btn-ghost text-slate-500" title="Download backup" onClick={() => exportBillExcel(bill, db.companies.find((c) => c.id === bill.companyId))}>
                            <FileSpreadsheet className="h-4 w-4" />
                          </button>
                          <button className="btn-outline text-emerald-600 hover:bg-emerald-50" onClick={() => onRestore(bill)}>
                            <RotateCcw className="h-4 w-4" /> Restore
                          </button>
                          <button className="btn-outline text-red-600 hover:bg-red-50" onClick={() => setTarget(bill)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
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
              <div key={bill.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{bill.docStatus === 'Draft' ? 'Draft' : bill.companyBillNo}</span>
                  <span className="font-medium tnum">{formatINR(t.net)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{bill.customerName}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Bill {formatDate(bill.date)} · Deleted {bill.deletedAt ? formatDate(bill.deletedAt.slice(0, 10)) : '—'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-outline flex-1 text-emerald-600 hover:bg-emerald-50" onClick={() => onRestore(bill)}>
                    <RotateCcw className="h-4 w-4" /> Restore
                  </button>
                  <button className="btn-outline text-slate-500" onClick={() => exportBillExcel(bill, db.companies.find((c) => c.id === bill.companyId))}>
                    <FileSpreadsheet className="h-4 w-4" />
                  </button>
                  <button className="btn-outline flex-1 text-red-600 hover:bg-red-50" onClick={() => setTarget(bill)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Password-protected permanent delete */}
      <Modal open={!!target} onClose={closeModal} title="Permanently delete bill" size="sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-slate-600">
            This permanently removes bill <span className="font-semibold text-slate-800">{target?.companyBillNo}</span> — it cannot be
            restored. Enter the password to confirm.
          </p>
        </div>
        <div className="mt-4">
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmPermanentDelete()}
            placeholder="Enter password to delete"
            autoFocus
          />
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="btn-outline"
            onClick={() => target && exportBillExcel(target, db.companies.find((c) => c.id === target.companyId))}
          >
            <FileSpreadsheet className="h-4 w-4" /> Backup first
          </button>
          <button className="btn-outline" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn-danger" onClick={confirmPermanentDelete} disabled={!password}>
            Delete forever
          </button>
        </div>
      </Modal>
    </div>
  )
}
