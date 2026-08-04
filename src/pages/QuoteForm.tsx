import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useStore, type QuoteDraft } from '../lib/store'
import { CustomerFields, type CustomerValue } from '../components/CustomerFields'
import { LineItemEditor } from '../components/LineItemEditor'
import { useToast } from '../components/ui'
import { computeTotals, costBasis, isGstCompany, recipientInterState } from '../lib/calc'
import { formatINR, todayISO } from '../lib/format'
import { nextQuoteNumbers } from '../lib/numbering'
import type { GstMode, LineItem, QuoteStatus } from '../lib/types'
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
  const initialCompany = db.companies.find((c) => c.id === initialCompanyId)
  const initialTaxMode: GstMode = existing
    ? existing.gstEnabled === false ? 'none' : existing.gstInclusive ? 'inclusive' : 'exclusive'
    : initialCompany?.defaultGstMode ?? 'exclusive'
  const [taxMode, setTaxMode] = useState<GstMode>(initialTaxMode)
  const [showLineCost, setShowLineCost] = useState(existing?.items.some((i) => i.cost != null) ?? false)
  const [originalCost, setOriginalCost] = useState(existing?.originalCost ?? 0)
  const [quoteNoField, setQuoteNoField] = useState(existing?.companyQuoteNo ?? '')

  const company = db.companies.find((c) => c.id === companyId)
  const companyIsGst = isGstCompany(company)
  const gstEnabled = taxMode !== 'none'
  const gstInclusive = taxMode === 'inclusive'
  const gstMode = companyIsGst && gstEnabled

  const firstRender = useRef(true)
  useEffect(() => {
    if (existing) return
    if (firstRender.current) { firstRender.current = false; return }
    setTaxMode(db.companies.find((x) => x.id === companyId)?.defaultGstMode ?? 'exclusive')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  useEffect(() => {
    if (existing) return
    setQuoteNoField(nextQuoteNumbers(db, companyId, date).companyQuoteNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, date])

  const totals = useMemo(
    () => computeTotals({ items, discountAmount, discountIsPercent, company, interState: recipientInterState(company, customer.customerGstin), gstEnabled, gstInclusive }),
    [items, discountAmount, discountIsPercent, company, customer.customerGstin, gstEnabled, gstInclusive],
  )

  const cost = costBasis(items, originalCost)
  const profit = totals.taxable - cost

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
      gstEnabled: companyIsGst ? gstEnabled : false,
      gstInclusive: companyIsGst && gstEnabled ? gstInclusive : false,
      originalCost: originalCost || undefined,
      companyQuoteNoOverride: quoteNoField.trim() || undefined,
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
                <label className="label">Quote No (editable)</label>
                <input className="input font-medium" value={quoteNoField} onChange={(e) => setQuoteNoField(e.target.value)} placeholder="PT/Q/2026-27/008" />
                <p className="mt-1 text-xs text-slate-400">Edit if needed — the next quote continues from this +1.</p>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="label">Tax</label>
              {companyIsGst ? (
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
                  <button type="button" onClick={() => setTaxMode('exclusive')}
                    className={`rounded-md px-3 py-1.5 font-medium ${taxMode === 'exclusive' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                    GST (exclusive)
                  </button>
                  <button type="button" onClick={() => setTaxMode('inclusive')}
                    className={`rounded-md px-3 py-1.5 font-medium ${taxMode === 'inclusive' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                    GST (inclusive)
                  </button>
                  <button type="button" onClick={() => setTaxMode('none')}
                    className={`rounded-md px-3 py-1.5 font-medium ${taxMode === 'none' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                    Without GST
                  </button>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-500">Non-GST company — no tax on this quote</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Customer</h3>
            <CustomerFields value={customer} onChange={setCustomer} gstMode={gstMode} />
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Line items</h3>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={showLineCost} onChange={(e) => setShowLineCost(e.target.checked)} />
                Track per-item cost (profit)
              </label>
            </div>
            <LineItemEditor items={items} onChange={setItems} gstMode={gstMode} taxRates={db.settings.taxRates} defaultTaxRate={db.settings.defaultTaxRate} showCost={showLineCost} />
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

          <div className="card mt-5 border-amber-200 p-5">
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Profit (internal)</h3>
            <p className="mb-3 text-xs text-slate-400">Original cost is never printed on the quotation.</p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="label">Total original cost (optional)</label>
                <input type="number" min={0} step="any" className="input text-right tnum" placeholder="0.00"
                  value={originalCost || ''} onChange={(e) => setOriginalCost(parseFloat(e.target.value) || 0)} />
                <p className="mt-1 text-xs text-slate-400">Overrides per-item costs if set.</p>
              </div>
              <div className="flex justify-between"><span className="text-slate-400">Cost basis</span><span className="tnum text-slate-500">{formatINR(cost)}</span></div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="font-medium text-slate-600">Profit</span>
                <span className={`font-bold tnum ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatINR(profit)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
