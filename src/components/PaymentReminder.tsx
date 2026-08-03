import { useMemo, useState } from 'react'
import { Download, MessageCircle, Share2, Smartphone } from 'lucide-react'
import { useStore } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatDate, formatINR } from '../lib/format'
import { buildReminderMessage, smsLink, whatsappLink } from '../lib/payments'
import { canShareFiles, dataUrlToFile, upiQrDataUrl } from '../lib/qr'
import { useToast } from './ui'
import { Modal } from './ui'
import { UpiQr } from './UpiQr'

export interface ReminderTarget {
  customerId?: string
  customerName: string
  customerPhone: string
}

// Aggregates ALL of a customer's pending/partial bills (within the active company
// scope) into a single WhatsApp / SMS reminder, with a scannable UPI QR to pay.
export function PaymentReminder({ open, onClose, target }: { open: boolean; onClose: () => void; target: ReminderTarget | null }) {
  const { db, activeCompanyId } = useStore()
  const toast = useToast()

  const data = useMemo(() => {
    if (!target) return null
    const pend = db.bills
      .filter((b) => !b.deletedAt && b.docStatus === 'Finalized')
      .filter((b) => (activeCompanyId === 'ALL' ? true : b.companyId === activeCompanyId))
      .filter((b) =>
        target.customerId
          ? b.customerId === target.customerId
          : b.customerName === target.customerName && b.customerPhone === target.customerPhone,
      )
      .map((b) => ({ b, t: billTotals(b, db.companies.find((c) => c.id === b.companyId)) }))
      .filter((x) => x.t.balance > 0.001)
      .sort((a, b) => (a.b.date < b.b.date ? -1 : 1))

    const total = pend.reduce((s, x) => s + x.t.balance, 0)
    // Payment goes to the company owed the most.
    const byCompany = new Map<string, number>()
    pend.forEach((x) => byCompany.set(x.b.companyId, (byCompany.get(x.b.companyId) ?? 0) + x.t.balance))
    const payCompanyId = [...byCompany.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const payCompany = db.companies.find((c) => c.id === payCompanyId)
    return { pend, total, payCompany }
  }, [target, db, activeCompanyId])

  const [phone, setPhone] = useState(target?.customerPhone ?? '')
  const [message, setMessage] = useState('')

  // Rebuild the default message whenever the target changes.
  const defaultMessage = useMemo(() => {
    if (!data || !target) return ''
    return buildReminderMessage({
      companyName: data.payCompany?.name ?? 'us',
      customerName: target.customerName,
      lines: data.pend.map((x) => ({ no: x.b.companyBillNo, date: x.b.date, balance: x.t.balance })),
      total: data.total,
      upiId: data.payCompany?.upiId,
      bankDetails: data.payCompany?.bankDetails,
      intro: db.settings.reminderTemplate,
    })
  }, [data, target, db.settings.reminderTemplate])

  // Keep the editable box in sync when the dialog (re)opens for a new target.
  const [lastKey, setLastKey] = useState('')
  const key = `${target?.customerId ?? target?.customerName ?? ''}:${open}`
  if (open && key !== lastKey) {
    setLastKey(key)
    setPhone(target?.customerPhone ?? '')
    setMessage(defaultMessage)
  }

  const makeQrDataUrl = async () => {
    if (!data?.payCompany?.upiId) return ''
    return upiQrDataUrl({
      pa: data.payCompany.upiId,
      pn: data.payCompany.payeeName || data.payCompany.name,
      am: data.total,
      tn: `Bills ${data.pend.map((x) => x.b.companyBillNo).join(', ')}`.slice(0, 60),
      size: 420,
    })
  }

  const downloadQr = async () => {
    const url = await makeQrDataUrl()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-qr-${target?.customerName || 'customer'}.png`.replace(/\s+/g, '_')
    a.click()
    toast('QR image downloaded')
  }

  // Share the QR image + message together (native share sheet → pick WhatsApp).
  const shareWithQr = async () => {
    const url = await makeQrDataUrl()
    if (!url) return
    const file = dataUrlToFile(url, 'payment-qr.png')
    if (canShareFiles(file)) {
      try {
        await navigator.share({ files: [file], text: message, title: 'Payment reminder' })
      } catch {
        /* user cancelled */
      }
    } else {
      // Desktop fallback: download the QR so it can be attached, then open WhatsApp text.
      await downloadQr()
      window.open(whatsappLink(phone, message), '_blank')
      toast('QR downloaded — attach it in the WhatsApp chat that opened', 'info')
    }
  }

  if (!open || !target || !data) return null

  const noPhone = !phone.trim()
  const noUpi = !data.payCompany?.upiId

  return (
    <Modal open={open} onClose={onClose} title="Send payment reminder" size="lg">
      {data.pend.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">This customer has no pending bills. 🎉</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-3">
            <div>
              <label className="label">Customer mobile</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div>
              <label className="label">Message ({data.pend.length} pending {data.pend.length === 1 ? 'bill' : 'bills'} · {formatINR(data.total)})</label>
              <textarea className="input min-h-[180px] font-mono text-xs" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {!noUpi && (
                <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={shareWithQr}>
                  <Share2 className="h-4 w-4" /> Share with QR
                </button>
              )}
              <a
                className={`btn-outline ${noPhone ? 'pointer-events-none opacity-50' : ''}`}
                href={whatsappLink(phone, message)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp (text)
              </a>
              <a
                className={`btn-outline ${noPhone ? 'pointer-events-none opacity-50' : ''}`}
                href={smsLink(phone, message)}
              >
                <Smartphone className="h-4 w-4" /> SMS
              </a>
            </div>
            <p className="text-xs text-slate-400">
              “Share with QR” opens your phone's share sheet so you can send the message <strong>and</strong> the QR image together on WhatsApp. On a computer it downloads the QR and opens WhatsApp so you can attach it.
            </p>
            {noPhone && <p className="text-xs text-red-500">Enter the customer's mobile number for the text-only options.</p>}
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs font-semibold text-slate-600">Scan &amp; pay (UPI)</p>
            {noUpi ? (
              <p className="py-6 text-xs text-slate-400">
                No UPI ID set for {data.payCompany?.name}. Add one in Companies → Edit → UPI ID.
              </p>
            ) : (
              <>
                <UpiQr
                  upiId={data.payCompany!.upiId!}
                  payeeName={data.payCompany!.payeeName || data.payCompany!.name}
                  amount={data.total}
                  note={`Bills ${data.pend.map((x) => x.b.companyBillNo).join(', ')}`.slice(0, 60)}
                  className="mx-auto rounded"
                />
                <p className="tnum text-sm font-semibold text-slate-700">{formatINR(data.total)}</p>
                <p className="break-all text-xs text-slate-400">{data.payCompany!.upiId}</p>
                <button className="btn-outline mt-1 w-full justify-center py-1 text-xs" onClick={downloadQr}>
                  <Download className="h-3.5 w-3.5" /> Download QR
                </button>
              </>
            )}
          </div>

          <div className="sm:col-span-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Pending bills included</p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.pend.map((x) => (
                    <tr key={x.b.id}>
                      <td className="td font-medium">{x.b.companyBillNo}</td>
                      <td className="td text-slate-500">{formatDate(x.b.date)}</td>
                      <td className="td text-right tnum text-red-600">{formatINR(x.t.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
