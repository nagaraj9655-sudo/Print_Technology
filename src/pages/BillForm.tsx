import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle2, BookOpen, Wifi } from 'lucide-react'
import { useStore } from '../lib/store'
import type { BillDraft } from '../lib/store'
import { CustomerFields, type CustomerValue } from '../components/CustomerFields'
import { LineItemEditor } from '../components/LineItemEditor'
import { useToast } from '../components/ui'
import { computeTotals, costBasis, isGstCompany, recipientInterState } from '../lib/calc'
import { handbookUsage } from '../lib/handbooks'
import { formatINR, todayISO } from '../lib/format'
import { nextBillNumbers } from '../lib/numbering'
import type { BillType, GstMode, LineItem } from '../lib/types'
import { uid } from '../lib/db'

export default function BillForm() {
  const { id } = useParams()
  const { db, activeCompanyId, createBill, updateBill, saveCustomer } = useStore()
  const navigate = useNavigate()
  const toast = useToast()

  const existing = id ? db.bills.find((b) => b.id === id) : undefined
  const editingFinalized = existing?.docStatus === 'Finalized'

  const initialCompanyId =
    existing?.companyId ?? (activeCompanyId !== 'ALL' ? activeCompanyId : db.companies[0]?.id ?? '')

  const [companyId, setCompanyId] = useState(initialCompanyId)
  const [date, setDate] = useState(existing?.date ?? todayISO())
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
  const [receivedAmount, setReceivedAmount] = useState(existing?.receivedAmount ?? 0)
  const [saveToCustomers, setSaveToCustomers] = useState(false)

  const initialCompany = db.companies.find((c) => c.id === initialCompanyId)
  // Tax mode: With GST (exclusive) | With GST (inclusive) | Without GST.
  const initialTaxMode: GstMode = existing
    ? existing.gstEnabled === false
      ? 'none'
      : existing.gstInclusive
        ? 'inclusive'
        : 'exclusive'
    : initialCompany?.defaultGstMode ?? 'exclusive'
  const [taxMode, setTaxMode] = useState<GstMode>(initialTaxMode)
  // Online (system-numbered) vs Handbill (manual paper book).
  const [billType, setBillType] = useState<BillType>(existing?.billType ?? initialCompany?.defaultBillType ?? 'Online')
  // Standard bill (with received/balance) vs Simple/cash bill (no payment shown, treated as paid).
  const [simpleBill, setSimpleBill] = useState(existing?.simpleBill ?? initialCompany?.defaultSimpleBill ?? false)
  const [handbookId, setHandbookId] = useState(existing?.handbookId ?? '')
  const [handBookNo, setHandBookNo] = useState(existing?.handBookNo ?? '')
  const [handBillNo, setHandBillNo] = useState(existing?.handBillNo ?? '')
  // Cost tracking for the profit report (never printed).
  const [showLineCost, setShowLineCost] = useState(existing?.items.some((i) => i.cost != null) ?? false)
  const [originalCost, setOriginalCost] = useState(existing?.originalCost ?? 0)
  // Editable invoice number (Online bills). Next auto number becomes edited + 1.
  const [invoiceNo, setInvoiceNo] = useState(
    existing && existing.docStatus === 'Finalized' && existing.billType !== 'Handbill' ? existing.companyBillNo : '',
  )

  const company = db.companies.find((c) => c.id === companyId)
  const companyIsGst = isGstCompany(company)
  const gstEnabled = taxMode !== 'none'
  const gstInclusive = taxMode === 'inclusive'
  const gstMode = companyIsGst && gstEnabled
  const handbooks = company?.handbooks ?? []
  const selectedBook = handbooks.find((h) => h.id === handbookId)
  const usage = useMemo(() => (selectedBook ? handbookUsage(selectedBook, db.bills) : null), [selectedBook, db.bills])

  // On a NEW bill, apply the picked company's default tax mode & bill type.
  const firstRender = useRef(true)
  useEffect(() => {
    if (existing) return
    if (firstRender.current) { firstRender.current = false; return }
    const c = db.companies.find((x) => x.id === companyId)
    setTaxMode(c?.defaultGstMode ?? 'exclusive')
    setBillType(c?.defaultBillType ?? 'Online')
    setSimpleBill(c?.defaultSimpleBill ?? false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Keep the editable invoice number in sync with the auto series for new/draft bills.
  useEffect(() => {
    if (billType !== 'Online') return
    if (existing && existing.docStatus === 'Finalized') return
    setInvoiceNo(nextBillNumbers(db, companyId, date).companyBillNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, date, billType])

  const totals = useMemo(
    () =>
      computeTotals({
        items,
        discountAmount,
        discountIsPercent,
        receivedAmount,
        company,
        interState: recipientInterState(company, customer.customerGstin),
        gstEnabled,
        gstInclusive,
      }),
    [items, discountAmount, discountIsPercent, receivedAmount, company, customer.customerGstin, gstEnabled, gstInclusive],
  )

  const cost = costBasis(items, originalCost)
  const sellingBase = totals.taxable // gross − discount, before tax
  const profit = sellingBase - cost

  const previewNumber = useMemo(() => {
    if (billType === 'Handbill') return `${handBookNo || '?'} / ${handBillNo || '?'}`
    if (existing && existing.docStatus === 'Finalized') return existing.companyBillNo
    return nextBillNumbers(db, companyId, date).companyBillNo
  }, [db, companyId, date, existing, billType, handBookNo, handBillNo])

  const pickHandbook = (hid: string) => {
    setHandbookId(hid)
    const hb = handbooks.find((h) => h.id === hid)
    if (hb) {
      setHandBookNo(hb.bookNo)
      const u = handbookUsage(hb, db.bills)
      setHandBillNo(u.nextAvailable != null ? String(u.nextAvailable) : '')
    }
  }

  const validate = (): string | null => {
    if (!companyId) return 'Select a company'
    if (!customer.customerName.trim()) return 'Customer name is required'
    if (items.length === 0 || items.every((i) => !i.description.trim())) return 'Add at least one line item'
    if (billType === 'Handbill' && (!handBookNo.trim() || !handBillNo.trim()))
      return 'Enter the book number and bill/receipt number for the handbill'
    return null
  }

  const buildDraft = (): BillDraft => ({
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
    simpleBill,
    receivedAmount: simpleBill ? totals.net : receivedAmount, // simple/cash bill = fully paid
    gstEnabled: companyIsGst ? gstEnabled : false,
    gstInclusive: companyIsGst && gstEnabled ? gstInclusive : false,
    originalCost: originalCost || undefined,
    billType,
    handbookId: billType === 'Handbill' ? handbookId || undefined : undefined,
    handBookNo: billType === 'Handbill' ? handBookNo : undefined,
    handBillNo: billType === 'Handbill' ? handBillNo : undefined,
    companyBillNoOverride: billType === 'Online' ? invoiceNo.trim() || undefined : undefined,
  })

  const persistCustomerIfNeeded = () => {
    if (saveToCustomers && customer.customerType === 'One_Time' && customer.customerName.trim()) {
      saveCustomer({
        name: customer.customerName,
        address: customer.customerAddress,
        phone: customer.customerPhone,
        gstin: customer.customerGstin,
      })
    }
  }

  const submit = (finalize: boolean) => {
    const err = validate()
    if (err) {
      toast(err, 'error')
      return
    }
    persistCustomerIfNeeded()
    const draft = buildDraft()
    const saved = existing ? updateBill(existing.id, draft, finalize || editingFinalized) : createBill(draft, finalize)
    toast(finalize ? 'Bill finalized' : 'Draft saved')
    navigate(`/bills/${saved.id}`)
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-xl font-bold text-slate-800">{existing ? 'Edit Bill' : 'New Bill'}</h1>
        {existing && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {existing.docStatus}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Header card */}
          <div className="card p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Company</label>
                <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={editingFinalized}>
                  {db.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.gstin ? ' (GST)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label">{billType === 'Handbill' ? 'Book / Bill No' : 'Invoice No (editable)'}</label>
                {billType === 'Handbill' ? (
                  <input className="input bg-slate-50 font-medium" value={previewNumber} readOnly />
                ) : (
                  <input className="input font-medium" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="PT/2026-27/008" />
                )}
                {billType === 'Online' && <p className="mt-1 text-xs text-slate-400">Edit if needed — the next bill continues from this +1.</p>}
              </div>
            </div>

            {/* Bill type + GST switches */}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className="label">Bill type</label>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
                  <button type="button" onClick={() => setBillType('Online')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${billType === 'Online' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                    <Wifi className="h-4 w-4" /> Online
                  </button>
                  <button type="button" onClick={() => setBillType('Handbill')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${billType === 'Handbill' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                    <BookOpen className="h-4 w-4" /> Handbill
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Bill format</label>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
                  <button type="button" onClick={() => setSimpleBill(false)}
                    className={`rounded-md px-3 py-1.5 font-medium ${!simpleBill ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
                    title="Shows received, balance and payment tracking">
                    Standard
                  </button>
                  <button type="button" onClick={() => setSimpleBill(true)}
                    className={`rounded-md px-3 py-1.5 font-medium ${simpleBill ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
                    title="Plain cash bill — no balance / received / payment shown">
                    Simple (cash)
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Tax</label>
                {companyIsGst ? (
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
                    <button type="button" onClick={() => setTaxMode('exclusive')}
                      className={`rounded-md px-3 py-1.5 font-medium ${taxMode === 'exclusive' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
                      title="Rate is before GST; tax is added on top">
                      GST (exclusive)
                    </button>
                    <button type="button" onClick={() => setTaxMode('inclusive')}
                      className={`rounded-md px-3 py-1.5 font-medium ${taxMode === 'inclusive' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
                      title="Rate already includes GST; tax is extracted from it">
                      GST (inclusive)
                    </button>
                    <button type="button" onClick={() => setTaxMode('none')}
                      className={`rounded-md px-3 py-1.5 font-medium ${taxMode === 'none' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                      Without GST
                    </button>
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-500">Non-GST company — plain invoice</p>
                )}
                {companyIsGst && gstInclusive && (
                  <p className="mt-1 text-xs text-amber-600">Item rates are treated as GST-inclusive; tax is split out automatically.</p>
                )}
              </div>
            </div>

            {/* Handbill details */}
            {billType === 'Handbill' && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg bg-amber-50/60 p-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <p className="text-xs text-amber-700">Manually-issued paper bill. Numbers below are editable and recorded for tracking.</p>
                </div>
                {handbooks.length > 0 && (
                  <div>
                    <label className="label">Book</label>
                    <select className="input" value={handbookId} onChange={(e) => pickHandbook(e.target.value)}>
                      <option value="">— Select / manual —</option>
                      {handbooks.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} (Book {h.bookNo}{h.assignedTo ? ` · ${h.assignedTo}` : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Book No *</label>
                  <input className="input" value={handBookNo} onChange={(e) => setHandBookNo(e.target.value)} placeholder="e.g. 12" />
                </div>
                <div>
                  <label className="label">Bill / Receipt No *</label>
                  <input className="input" value={handBillNo} onChange={(e) => setHandBillNo(e.target.value)} placeholder="e.g. 045" />
                </div>
                {usage && (
                  <div className="sm:col-span-3 text-xs text-amber-700">
                    {selectedBook?.name} · {usage.total - usage.remaining} of {usage.total} used ·{' '}
                    {usage.full ? (
                      <span className="font-semibold text-red-600">book full — start a new book</span>
                    ) : (
                      <>next available <span className="font-semibold">#{usage.nextAvailable}</span></>
                    )}
                    {usage.damaged.length > 0 && <> · damaged: {usage.damaged.join(', ')}</>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Customer</h3>
            <CustomerFields value={customer} onChange={setCustomer} gstMode={gstMode} />
            {customer.customerType === 'One_Time' && customer.customerName.trim() && (
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={saveToCustomers} onChange={(e) => setSaveToCustomers(e.target.checked)} />
                Also save to Customers for reuse
              </label>
            )}
          </div>

          {/* Items */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Line items</h3>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={showLineCost} onChange={(e) => setShowLineCost(e.target.checked)} />
                Track per-item cost (profit)
              </label>
            </div>
            <LineItemEditor
              items={items}
              onChange={setItems}
              gstMode={gstMode}
              taxRates={db.settings.taxRates}
              defaultTaxRate={db.settings.defaultTaxRate}
              showCost={showLineCost}
            />
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-5">
          <div className="card sticky top-2 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Summary</h3>
            <div className="space-y-3 text-sm">
              <Row label="Gross" value={formatINR(totals.gross)} />
              <div>
                <label className="label">Discount</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="input text-right tnum"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  />
                  <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setDiscountIsPercent(false)}
                      className={`px-3 text-sm ${!discountIsPercent ? 'bg-brand-600 text-white' : 'bg-white text-slate-500'}`}
                    >
                      ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountIsPercent(true)}
                      className={`px-3 text-sm ${discountIsPercent ? 'bg-brand-600 text-white' : 'bg-white text-slate-500'}`}
                    >
                      %
                    </button>
                  </div>
                </div>
                {discountIsPercent && <p className="mt-1 text-right text-xs text-slate-400">= {formatINR(totals.discount)}</p>}
              </div>
              {gstMode && (
                <>
                  <Row label="Taxable" value={formatINR(totals.taxable)} />
                  {totals.igst > 0 && <Row label="IGST" value={formatINR(totals.igst)} muted />}
                  {totals.cgst > 0 && <Row label="CGST" value={formatINR(totals.cgst)} muted />}
                  {totals.sgst > 0 && <Row label="SGST" value={formatINR(totals.sgst)} muted />}
                </>
              )}
              <div className="border-t border-slate-100 pt-2">
                <Row label={simpleBill ? 'Total' : 'Net Payable'} value={formatINR(totals.net)} strong />
              </div>

              {simpleBill ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Simple/cash bill — no received, balance or payment tracking is shown or printed. The full amount is treated as paid.
                </p>
              ) : (
                <>
                  <div>
                    <label className="label">Received amount</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="input text-right tnum"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                      disabled={!!existing && existing.payments.length > 0}
                    />
                    {!!existing && existing.payments.length > 0 && (
                      <p className="mt-1 text-xs text-slate-400">Use “Record Payment” on the bill to add more.</p>
                    )}
                  </div>
                  <Row label="Balance Due" value={formatINR(totals.balance)} />
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        totals.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : totals.status === 'Partial'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {totals.status}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <button className="btn-primary w-full" onClick={() => submit(true)}>
                <CheckCircle2 className="h-4 w-4" /> {existing?.docStatus === 'Finalized' ? 'Save changes' : 'Finalize bill'}
              </button>
              {existing?.docStatus !== 'Finalized' && (
                <button className="btn-outline w-full" onClick={() => submit(false)}>
                  <Save className="h-4 w-4" /> Save as draft
                </button>
              )}
            </div>
          </div>

          {/* Profit (internal, never printed) */}
          <div className="card border-amber-200 p-5">
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Profit (internal)</h3>
            <p className="mb-3 text-xs text-slate-400">Original cost is never printed on the bill.</p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="label">Total original cost (optional)</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="input text-right tnum"
                  placeholder="0.00"
                  value={originalCost || ''}
                  onChange={(e) => setOriginalCost(parseFloat(e.target.value) || 0)}
                />
                <p className="mt-1 text-xs text-slate-400">Overrides per-item costs if set.</p>
              </div>
              <Row label="Cost basis" value={formatINR(cost)} muted />
              <Row label="Selling (ex-tax)" value={formatINR(sellingBase)} muted />
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="font-medium text-slate-600">Profit</span>
                <span className={`font-bold tnum ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatINR(profit)}
                  {sellingBase > 0 && <span className="ml-1 text-xs font-normal text-slate-400">({Math.round((profit / sellingBase) * 100)}%)</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
      <span className={`tnum ${strong ? 'text-base font-bold text-slate-800' : muted ? 'text-slate-500' : 'text-slate-700'}`}>
        {value}
      </span>
    </div>
  )
}
