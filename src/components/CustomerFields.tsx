import { useMemo, useState } from 'react'
import { Check, Search, UserPlus } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Customer, CustomerType } from '../lib/types'

export interface CustomerValue {
  customerType: CustomerType
  customerId?: string
  customerName: string
  customerAddress: string
  customerPhone: string
  customerGstin?: string
}

export function CustomerFields({
  value,
  onChange,
  gstMode,
}: {
  value: CustomerValue
  onChange: (v: CustomerValue) => void
  gstMode: boolean
}) {
  const { db } = useStore()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return db.customers.slice(0, 6)
    return db.customers
      .filter((c) => c.name.toLowerCase().includes(t) || c.phone.includes(t))
      .slice(0, 8)
  }, [search, db.customers])

  const pick = (c: Customer) => {
    onChange({
      customerType: 'Regular',
      customerId: c.id,
      customerName: c.name,
      customerAddress: c.address,
      customerPhone: c.phone,
      customerGstin: c.gstin,
    })
    setSearch(c.name)
    setOpen(false)
  }

  const setType = (type: CustomerType) => {
    if (type === value.customerType) return
    onChange({
      customerType: type,
      customerId: undefined,
      customerName: '',
      customerAddress: '',
      customerPhone: '',
      customerGstin: undefined,
    })
    setSearch('')
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
        {(['Regular', 'One_Time'] as CustomerType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              value.customerType === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'Regular' ? 'Regular customer' : 'One-time customer'}
          </button>
        ))}
      </div>

      {value.customerType === 'Regular' && (
        <div className="relative">
          <label className="label">Find customer</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
            />
          </div>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-soft">
                {matches.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No customers found. Add one in the Customers page.</p>}
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className="ml-2 text-slate-400">{c.phone}</span>
                    </span>
                    {value.customerId === c.id && <Check className="h-4 w-4 text-brand-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {(value.customerType === 'One_Time' || value.customerId || value.customerName) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Customer name</label>
            <input
              className="input"
              value={value.customerName}
              onChange={(e) => onChange({ ...value, customerName: e.target.value })}
              placeholder="Name"
              readOnly={value.customerType === 'Regular' && !!value.customerId}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <textarea
              className="input min-h-[60px]"
              value={value.customerAddress}
              onChange={(e) => onChange({ ...value, customerAddress: e.target.value })}
              placeholder="Address"
              readOnly={value.customerType === 'Regular' && !!value.customerId}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={value.customerPhone}
              onChange={(e) => onChange({ ...value, customerPhone: e.target.value })}
              placeholder="Phone"
              readOnly={value.customerType === 'Regular' && !!value.customerId}
            />
          </div>
          {gstMode && (
            <div>
              <label className="label">Customer GSTIN (B2B)</label>
              <input
                className="input"
                value={value.customerGstin ?? ''}
                onChange={(e) => onChange({ ...value, customerGstin: e.target.value })}
                placeholder="Optional"
              />
            </div>
          )}
        </div>
      )}

      {value.customerType === 'One_Time' && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <UserPlus className="h-3.5 w-3.5" /> One-time details are saved on this document only, not to the customer list.
        </p>
      )}
    </div>
  )
}
