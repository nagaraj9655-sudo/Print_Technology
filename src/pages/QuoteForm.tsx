import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useStore, type QuoteDraft } from '../lib/store'
import { CustomerFields, type CustomerValue } from '../components/CustomerFields'
import { LineItemEditor } from '../components/LineItemEditor'
import { useToast } from '../components/ui'
import { computeTotals, isGstCompany, recipientInterState } from '../lib/calc'
import { formatINR, todayISO } from '../lib/format'
import { nextQuoteNumbers } from '../lib/numbering'
import type { LineItem, QuoteStatus } from '../lib/types'
import { uid } from '../lib/db'

export default function QuoteForm() {
  const { id } = useParams()
  const { db, activeCompanyId, createQuote, updateQuote } = useStore()
  const navigate = useNavigate()
  const toast = useToast()

  const existing = id ? db.quotations.find((q) => q.id === id) : undefined
  const initialCompanyId = existing?.companyId ?? (activeCompanyId !== 'ALL' ? activeCompanyId : db.companies[0]?.id ?? '')

  const [companyId, setCompanyId] = useState(initialCompanyId)
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? '')
  const [statusVal, setStatusVal] = useState<QuoteStatus>(existing?.status ?? 'Draft')
  const [customer, setCustomer] = useState<CustomerValue>({
    customerType: existing?.customerType ?? 'Regular',
    customerId: existing?.customerId,
    customerName: existing?.customerName ?? '',
    customerAddress: existing?.customerAddress ?? '',
    customerPhone: existing?.customerPhone ?? '',
    customerGstin: existing?.customerGstin,
  })
  const [items, setItems] = useState<LineItem[]>(
    existing?.items.length
      ? existing.items.map((i) => ({ ...i }))
      : [{ id: uid(), description: '', qty: 1, rate: 0, hsnSac: '', taxRate: db.settings.defaultTaxRate }],
  )
  const [discountAmount, setDiscountAmount] = useState(existing?.discountAmount ?? 0)
  const [discountIsPercent, setDiscountIsPercent] = useState(existing?.discountIsPercent ?? false)

  const company = db.companies.find((c) => c.id === companyId)
  const gstMode = isGstCompany(company)

  const totals = useMemo(
    () => computeTotals({ items, discountAmount, discountIsPercent, company, interState: recipientInterState(company, customer.customerGstin) }),
    [items, discountAmount, discountIsPercent, company, customer.customerGstin],
  )

  const previewNumber = useMemo(
    () => (existing ? existing.companyQuoteNo : nextQuoteNumbers(db, companyId, date).companyQuoteNo),
    [db, companyId, date, existing],
  )

  const submit = () => {
    if (!customer.customerName.trim()) return toast('Customer name is required', 'error')
    if (items.every((i) => !i.description.trim())) return toast('Add at least one line item', 'error')
    const draft: QuoteDraft = {
      companyId,
      date,
      customerType: customer.customerType,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerAddress: customer.customerAddress,
      customerPhone: customer.customerPhone,
      customerGstin: customer.customerGstin,
      items: items.filter((i) => i.description.trim()),
      discountAmount,
      discountIsPercent,
      validUntil: validUntil || undefined,
      status: statusVal,
    }
    const saved = existing ? updateQuote(existing.id, draft) : createQuote(draft)
    toast('Quotation saved')
    navigate(`/quotations/${saved.id}`)
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-xl font-bold text-slate-800">{existing ? 'Edit Quotation' : 'New Quotation'}</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <label className="label">Company</label>
                <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  {db.companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Valid Until</label>
                <input type="date" className="input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={statusVal} onChange={(e) => setStatusVal(e.target.value as QuoteStatus)}>
                  {(['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as QuoteStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="label">Quote No</label>
                <input className="input bg-slate-50 font-medium" value={previewNumber} readOnly />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Customer</h3>
            <CustomerFields value={customer} onChange={setCustomer} gstMode={gstMode} />
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Line items</h3>
            <LineItemEditor items={items} onChange={setItems} gstMode={gstMode} taxRates={db.settings.taxRates} defaultTaxRate={db.settings.defaultTaxRate} />
          </div>
        </div>

        <div>
          <div className="card sticky top-2 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Gross</span><span className="tnum">{formatINR(totals.gross)}</span></div>
              <div>
                <label className="label">Discount</label>
                <div className="flex gap-2">
                  <input type="number" min={0} step="any" className="input text-right tnum" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} />
                  <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
                    <button type="button" onClick={() => setDiscountIsPercent(false)} className={`px-3 text-sm ${!discountIsPercent ? 'bg-brand-600 text-white' : 'bg-white text-slate-500'}`}>₹</button>
                    <button type="button" onClick={() => setDiscountIsPercent(true)} className={`px-3 text-sm ${discountIsPercent ? 'bg-brand-600 text-white' : 'bg-white text-slate-500'}`}>%</button>
                  </div>
                </div>
              </div>
              {gstMode && <div className="flex justify-between"><span className="text-slate-500">Taxable</span><span className="tnum">{formatINR(totals.taxable)}</span></div>}
              {gstMode && totals.tax > 0 && <div className="flex justify-between"><span className="text-slate-400">GST</span><span className="tnum text-slate-500">{formatINR(totals.tax)}</span></div>}
              <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-semibold text-slate-700">Total</span><span className="text-base font-bold tnum text-slate-800">{formatINR(totals.net)}</span></div>
            </div>
            <button className="btn-primary mt-5 w-full" onClick={submit}>
              <CheckCircle2 className="h-4 w-4" /> Save quotation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
