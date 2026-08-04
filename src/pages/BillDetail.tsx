import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BellRing,
  Copy,
  FileSpreadsheet,
  Pencil,
  Printer,
  Share2,
  Trash2,
  Wallet,
} from 'lucide-react'
import { HeaderToggle } from '../components/HeaderToggle'
import { useStore } from '../lib/store'
import { billTotals } from '../lib/calc'
import { DocumentView } from '../components/DocumentView'
import { PaymentReminder, type ReminderTarget } from '../components/PaymentReminder'
import { Modal, useConfirm, useToast } from '../components/ui'
import { exportBillExcel } from '../lib/excel'
import { formatDate, formatINR, todayISO } from '../lib/format'
import { elementToPngFile, shareImageFile } from '../lib/share'

export default function BillDetail() {
  const { id } = useParams()
  const { db, recordPayment, deleteBill, duplicateBill, currentUser } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, node: confirmNode } = useConfirm()
  const [payOpen, setPayOpen] = useState(false)
  const [showHeader, setShowHeader] = useState(true)
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null)

  const bill = db.bills.find((b) => b.id === id)
  if (!bill) return <div className="text-slate-500">Bill not found.</div>
  const company = db.companies.find((c) => c.id === bill.companyId)
  const t = billTotals(bill, company)

  const onDelete = async () => {
    if (currentUser?.role !== 'Admin') return toast('Only Admin can delete bills', 'error')
    if (await confirm(`Move bill ${bill.companyBillNo} to the recycle bin?`)) {
      deleteBill(bill.id)
      toast('Bill moved to recycle bin')
      navigate('/bills')
    }
  }

  const onDuplicate = () => {
    const copy = duplicateBill(bill.id)
    toast('Duplicated as draft')
    navigate(`/bills/${copy.id}/edit`)
  }

  const [sharing, setSharing] = useState(false)
  const shareBillImage = async () => {
    const el = document.querySelector('.print-page') as HTMLElement | null
    if (!el) return
    setSharing(true)
    try {
      const file = await elementToPngFile(el, `${bill.companyBillNo.replace(/[\/\\]/g, '-')}.png`)
      const caption =
        `${company?.gstin ? 'Invoice' : 'Bill'} ${bill.companyBillNo} from ${company?.name}\n` +
        `Amount: ${formatINR(t.net)}${t.balance > 0.001 ? ` · Balance due: ${formatINR(t.balance)}` : ' · PAID'}` +
        (company?.upiId ? `\nPay via UPI: ${company.upiId} (scan the QR in the image)` : '')
      const how = await shareImageFile(file, caption, bill.customerPhone)
      toast(how === 'shared' ? 'Bill shared' : 'Bill image downloaded — attach it in WhatsApp', how === 'shared' ? 'success' : 'info')
    } catch {
      toast('Could not create the bill image', 'error')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div>
      {/* Action bar */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => navigate('/bills')} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Bills
        </button>
        <HeaderToggle value={showHeader} onChange={setShowHeader} />
        <div className="ml-auto flex flex-wrap gap-2">
          {t.balance > 0.001 && bill.docStatus === 'Finalized' && (
            <button className="btn-primary" onClick={() => setPayOpen(true)}>
              <Wallet className="h-4 w-4" /> Record Payment
            </button>
          )}
          {t.balance > 0.001 && bill.docStatus === 'Finalized' && (
            <button
              className="btn-outline text-amber-600 hover:bg-amber-50"
              onClick={() => setReminderTarget({ customerId: bill.customerId, customerName: bill.customerName, customerPhone: bill.customerPhone })}
            >
              <BellRing className="h-4 w-4" /> Remind
            </button>
          )}
          <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={shareBillImage} disabled={sharing}>
            <Share2 className="h-4 w-4" /> {sharing ? 'Preparing…' : 'Share bill'}
          </button>
          <button className="btn-outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> PDF / Print
          </button>
          <button className="btn-outline" onClick={() => exportBillExcel(bill, company)}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <Link to={`/bills/${bill.id}/edit`} className="btn-outline">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button className="btn-outline" onClick={onDuplicate}>
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button className="btn-outline text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DocumentView doc={bill} company={company} kind="bill" settings={db.settings} showHeader={showHeader} />
        </div>

        {/* Side panel: payment history */}
        <div className="no-print space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Payment</h3>
              {bill.simpleBill && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">Simple — not on print</span>
              )}
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">{bill.simpleBill ? 'Total' : 'Net Payable'}</dt><dd className="font-semibold tnum">{formatINR(t.net)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Received</dt><dd className="tnum text-emerald-600">{formatINR(t.received)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="text-slate-500">Balance Due</dt><dd className={`font-bold tnum ${t.balance > 0 ? 'text-red-600' : 'text-slate-700'}`}>{formatINR(t.balance)}</dd></div>
            </dl>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Payment history</h3>
            {bill.payments.length === 0 ? (
              <p className="text-sm text-slate-400">No payments recorded.</p>
            ) : (
              <ul className="space-y-2">
                {bill.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-700 tnum">{formatINR(p.amount)}</p>
                      <p className="text-xs text-slate-400">{formatDate(p.date)} · {p.mode || '—'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4 text-xs text-slate-400">
            <p>Global Bill No: <span className="font-medium text-slate-600">{bill.billNo || '—'}</span></p>
            <p>Created by {bill.createdBy} · {formatDate(bill.createdAt.slice(0, 10))}</p>
          </div>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        maxAmount={t.balance}
        onSubmit={(amount, mode, note) => {
          recordPayment(bill.id, { date: todayISO(), amount, mode, note })
          toast('Payment recorded')
          setPayOpen(false)
        }}
      />
      {confirmNode}
      <PaymentReminder open={!!reminderTarget} onClose={() => setReminderTarget(null)} target={reminderTarget} />
    </div>
  )
}

function PaymentModal({
  open,
  onClose,
  maxAmount,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  maxAmount: number
  onSubmit: (amount: number, mode: string, note: string) => void
}) {
  const [amount, setAmount] = useState(maxAmount)
  const [mode, setMode] = useState('UPI')
  const [note, setNote] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="Record payment" size="sm">
      <div className="space-y-3">
        <div>
          <label className="label">Amount (Balance due {formatINR(maxAmount)})</label>
          <input
            type="number"
            className="input text-right tnum"
            value={amount}
            min={0}
            step="any"
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option>UPI</option>
            <option>Cash</option>
            <option>Bank Transfer</option>
            <option>Cheque</option>
            <option>Card</option>
          </select>
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ref / remarks" />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSubmit(amount, mode, note)} disabled={amount <= 0}>
          Save payment
        </button>
      </div>
    </Modal>
  )
}
