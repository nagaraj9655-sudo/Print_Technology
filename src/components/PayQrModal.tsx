import { useState } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '../lib/store'
import { formatINR } from '../lib/format'
import { upiQrDataUrl } from '../lib/qr'
import { Modal, useToast } from './ui'
import { UpiQr } from './UpiQr'

// On-demand "show my UPI QR" so a customer can scan and pay any time.
export function PayQrModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, activeCompanyId } = useStore()
  const toast = useToast()
  const payable = db.companies.filter((c) => c.upiId)
  const initial = activeCompanyId !== 'ALL' && payable.some((c) => c.id === activeCompanyId) ? activeCompanyId : payable[0]?.id ?? ''
  const [companyId, setCompanyId] = useState(initial)
  const [amount, setAmount] = useState<number>(0)

  const company = db.companies.find((c) => c.id === companyId)

  const download = async () => {
    if (!company?.upiId) return
    const url = await upiQrDataUrl({ pa: company.upiId, pn: company.payeeName || company.name, am: amount || undefined, size: 480 })
    const a = document.createElement('a')
    a.href = url
    a.download = `${company.name}-upi-qr.png`.replace(/\s+/g, '_')
    a.click()
    toast('QR image downloaded')
  }

  return (
    <Modal open={open} onClose={onClose} title="Show payment QR" size="sm">
      {payable.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No company has a UPI ID yet. Add one in Companies → Edit → UPI ID.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Receiving company</label>
              <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {payable.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount (optional)</label>
              <input type="number" min={0} step="any" className="input text-right tnum" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} placeholder="Any amount" />
            </div>
          </div>
          <div className="flex flex-col items-center rounded-lg border border-slate-200 p-4">
            {company?.upiId ? (
              <>
                <UpiQr upiId={company.upiId} payeeName={company.payeeName || company.name} amount={amount || undefined} size={220} className="rounded" />
                {amount > 0 && <p className="mt-2 tnum text-lg font-bold text-slate-800">{formatINR(amount)}</p>}
                <p className="mt-1 break-all text-xs text-slate-400">{company.upiId}</p>
                <p className="text-xs text-slate-400">Scan with GPay / PhonePe / any UPI app</p>
              </>
            ) : null}
          </div>
          <button className="btn-outline w-full justify-center" onClick={download}>
            <Download className="h-4 w-4" /> Download QR
          </button>
        </div>
      )}
    </Modal>
  )
}
