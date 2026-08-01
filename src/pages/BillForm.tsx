import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react'
import { useStore } from '../lib/store'
import type { BillDraft } from '../lib/store'
import { CustomerFields, type CustomerValue } from '../components/CustomerFields'
import { LineItemEditor } from '../components/LineItemEditor'
import { useToast } from '../components/ui'
import { computeTotals, isGstCompany, recipientInterState } from '../lib/calc'
import { formatINR, todayISO } from '../lib/format'
import { nextBillNumbers } from '../lib/numbering'
import type { LineItem } from '../lib/types'
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

  const company = db.companies.find((c) => c.id === companyId)
  const gstMode = isGstCompany(company)

  const totals = useMemo(
    () =>
      computeTotals({
        items,
        discountAmount,
        discountIsPercent,
        receivedAmount,
        company,
        interState: recipientInterState(company, customer.customerGstin),
      }),
    [items, discountAmount, discountIsPercent, receivedAmount, company, customer.customerGstin],
  )

  const previewNumber = useMemo(() => {
    if (existing && existing.docStatus === 'Finalized') return existing.companyBillNo
    return nextBillNumbers(db, companyId, date).companyBillNo
  }, [db, companyId, date, existing])

  const validate = (): string | null => {
    if (!companyId) return 'Select a company'
    if (!customer.customerName.trim()) return 'Customer name is required'
    if (items.length === 0 || items.every((i) => !i.description.trim())) return 'Add at least one line item'
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
    receivedAmount,
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
                <label className="label">Invoice No {existing?.docStatus === 'Finalized' ? '' : '(on finalize)'}</label>
                <input className="input bg-slate-50 font-medium" value={previewNumber} readOnly />
              </div>
            </div>
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
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Line items</h3>
            <LineItemEditor
              items={items}
              onChange={setItems}
              gstMode={gstMode}
              taxRates={db.settings.taxRates}
              defaultTaxRate={db.settings.defaultTaxRate}
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
                <Row label="Net Payable" value={formatINR(totals.net)} strong />
              </div>

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
