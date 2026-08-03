import { useMemo, useState } from 'react'
import { BellRing, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import { EmptyState, Modal, useConfirm, useToast } from '../components/ui'
import { PaymentReminder, type ReminderTarget } from '../components/PaymentReminder'
import { billTotals } from '../lib/calc'
import { formatINR } from '../lib/format'
import type { Customer } from '../lib/types'

export default function Customers() {
  const { db, saveCustomer, deleteCustomer, currentUser } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase()
    return db.customers.filter((c) => !t || c.name.toLowerCase().includes(t) || c.phone.includes(t))
  }, [db.customers, search])

  // Aggregate each customer's outstanding across all bills.
  const stats = useMemo(() => {
    const map = new Map<string, { billed: number; balance: number }>()
    for (const b of db.bills.filter((x) => !x.deletedAt && x.customerId)) {
      const t = billTotals(b, db.companies.find((c) => c.id === b.companyId))
      const cur = map.get(b.customerId!) ?? { billed: 0, balance: 0 }
      cur.billed += t.net
      cur.balance += t.balance
      map.set(b.customerId!, cur)
    }
    return map
  }, [db.bills, db.companies])

  const openNew = () => { setEditing(null); setOpen(true) }
  const openEdit = (c: Customer) => { setEditing(c); setOpen(true) }

  const onDelete = async (c: Customer) => {
    if (currentUser?.role !== 'Admin') return toast('Only Admin can delete', 'error')
    if (await confirm(`Delete customer ${c.name}? Existing bills keep their snapshot.`)) {
      deleteCustomer(c.id)
      toast('Customer deleted')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500">{db.customers.length} regular customers</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> Add Customer</button>
      </div>

      <div className="card mb-4 p-4">
        <input className="input" placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No customers" hint="Add regular customers so they auto-complete on new bills." action={<button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> Add Customer</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">GSTIN</th>
                  <th className="th text-right">Total Billed</th>
                  <th className="th text-right">Outstanding</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const s = stats.get(c.id)
                  return (
                    <tr key={c.id} className="even:bg-slate-50/40">
                      <td className="td">
                        <p className="font-medium text-slate-800">{c.name}</p>
                        <p className="text-xs text-slate-400">{c.address}</p>
                      </td>
                      <td className="td text-slate-600">{c.phone}</td>
                      <td className="td text-slate-500">{c.gstin || '—'}</td>
                      <td className="td text-right tnum">{formatINR(s?.billed ?? 0)}</td>
                      <td className={`td text-right tnum ${(s?.balance ?? 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatINR(s?.balance ?? 0)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {(s?.balance ?? 0) > 0 && (
                            <button
                              className="rounded p-1.5 text-amber-500 hover:bg-amber-50"
                              title="Send payment reminder"
                              onClick={() => setReminderTarget({ customerId: c.id, customerName: c.name, customerPhone: c.phone })}
                            >
                              <BellRing className="h-4 w-4" />
                            </button>
                          )}
                          <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></button>
                          <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" onClick={() => onDelete(c)}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <CustomerModal
          customer={editing}
          existing={db.customers}
          onClose={() => setOpen(false)}
          onSave={(data) => {
            saveCustomer(data)
            toast(editing ? 'Customer updated' : 'Customer added')
            setOpen(false)
          }}
        />
      )}
      {node}
    </div>
  )
}

function CustomerModal({
  customer,
  existing,
  onClose,
  onSave,
}: {
  customer: Customer | null
  existing: Customer[]
  onClose: () => void
  onSave: (c: Partial<Customer> & { id?: string }) => void
}) {
  const [name, setName] = useState(customer?.name ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [gstin, setGstin] = useState(customer?.gstin ?? '')
  const [notes, setNotes] = useState(customer?.notes ?? '')

  const duplicate = existing.find(
    (c) => c.id !== customer?.id && c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.phone === phone,
  )

  return (
    <Modal open onClose={onClose} title={customer ? 'Edit customer' : 'Add customer'}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input min-h-[60px]" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input className="input" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Optional (B2B)" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {duplicate && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠ A customer with this name &amp; phone already exists.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          disabled={!name.trim()}
          onClick={() => onSave({ id: customer?.id, name, address, phone, gstin, notes })}
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
