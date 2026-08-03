import { useState } from 'react'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { EmptyState, Modal, useConfirm, useToast } from '../components/ui'
import { uid } from '../lib/db'
import type { Company, Handbook } from '../lib/types'

export default function Companies() {
  const { db, saveCompany, deleteCompany, currentUser } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)

  const isAdmin = currentUser?.role === 'Admin'

  const onDelete = async (c: Company) => {
    if (!isAdmin) return toast('Only Admin can delete companies', 'error')
    const hasDocs = db.bills.some((b) => b.companyId === c.id) || db.quotations.some((q) => q.companyId === c.id)
    if (hasDocs) return toast('Cannot delete: this company has bills or quotations', 'error')
    if (await confirm(`Delete company ${c.name}?`)) {
      deleteCompany(c.id)
      toast('Company deleted')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Companies</h1>
          <p className="text-sm text-slate-500">{db.companies.length} companies · add any number, no code changes</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4" /> Add Company
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          You are signed in as Operator — company management is read-only.
        </div>
      )}

      {db.companies.length === 0 ? (
        <EmptyState icon={Building2} title="No companies" hint="Add your first company to start billing." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {db.companies.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <div className="h-1.5" style={{ background: c.accent ?? '#1f47f5' }} />
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {c.logoDataUrl ? (
                      <img src={c.logoDataUrl} alt="" className="h-11 w-11 rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-bold text-white" style={{ background: c.accent ?? '#1f47f5' }}>
                        {c.name.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-slate-800">{c.name}</h3>
                      <span className={`text-xs font-medium ${c.gstin ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {c.gstin ? 'GST registered' : 'Non-GST'}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => { setEditing(c); setOpen(true) }}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" onClick={() => onDelete(c)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                <dl className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <p className="line-clamp-2">{c.address}</p>
                  <p>☎ {c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                  {c.gstin && <p>GSTIN: <span className="font-medium text-slate-600">{c.gstin}</span></p>}
                  <p>Prefix: <span className="font-mono text-slate-600">{c.invoicePrefix || '—'}</span></p>
                </dl>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <CompanyModal
          company={editing}
          onClose={() => setOpen(false)}
          onSave={(data) => {
            saveCompany(data)
            toast(editing ? 'Company updated' : 'Company added')
            setOpen(false)
          }}
        />
      )}
      {node}
    </div>
  )
}

function CompanyModal({
  company,
  onClose,
  onSave,
}: {
  company: Company | null
  onClose: () => void
  onSave: (c: Partial<Company> & { id?: string }) => void
}) {
  const [form, setForm] = useState<Partial<Company>>(
    company ?? { name: '', address: '', phone: '', accent: '#1f47f5', invoicePrefix: '', isActive: true },
  )
  const set = (patch: Partial<Company>) => setForm((f) => ({ ...f, ...patch }))

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set({ logoDataUrl: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <Modal open onClose={onClose} title={company ? 'Edit company' : 'Add company'} size="lg">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Company name *</label>
          <input className="input" value={form.name ?? ''} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input min-h-[56px]" value={form.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
        </div>
        <div>
          <label className="label">GSTIN <span className="text-slate-400">(blank = non-GST)</span></label>
          <input className="input" value={form.gstin ?? ''} onChange={(e) => set({ gstin: e.target.value })} placeholder="e.g. 33ABCDE1234F1Z5" />
        </div>
        <div>
          <label className="label">State code</label>
          <input className="input" value={form.stateCode ?? ''} onChange={(e) => set({ stateCode: e.target.value })} placeholder="e.g. 33" />
        </div>
        <div>
          <label className="label">Invoice prefix</label>
          <input className="input font-mono" value={form.invoicePrefix ?? ''} onChange={(e) => set({ invoicePrefix: e.target.value })} placeholder="PT/" />
        </div>
        <div>
          <label className="label">Quote prefix</label>
          <input className="input font-mono" value={form.quotePrefix ?? ''} onChange={(e) => set({ quotePrefix: e.target.value })} placeholder="PT/" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Bank / UPI details</label>
          <input className="input" value={form.bankDetails ?? ''} onChange={(e) => set({ bankDetails: e.target.value })} placeholder="A/c No · IFSC · UPI" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Invoice terms &amp; footer</label>
          <textarea className="input min-h-[56px]" value={form.terms ?? ''} onChange={(e) => set({ terms: e.target.value })} />
        </div>
        <div>
          <label className="label">Document template</label>
          <select className="input" value={form.template ?? 'modern'} onChange={(e) => set({ template: e.target.value as Company['template'] })}>
            <option value="modern">Modern — bold coloured bands</option>
            <option value="classic">Classic — centered, serif, ruled</option>
            <option value="minimal">Minimal — clean accent edge</option>
          </select>
        </div>
        <div>
          <label className="label">Document font</label>
          <select className="input" value={form.fontFamily ?? 'Inter'} onChange={(e) => set({ fontFamily: e.target.value })}>
            <option value="Inter">Inter (sans)</option>
            <option value="Poppins">Poppins (sans)</option>
            <option value="Roboto Slab">Roboto Slab (slab)</option>
            <option value="Libre Baskerville">Libre Baskerville (serif)</option>
            <option value="Playfair Display">Playfair Display (serif)</option>
          </select>
        </div>
        <div>
          <label className="label">Brand accent</label>
          <div className="flex items-center gap-2">
            <input type="color" className="h-9 w-12 rounded border border-slate-300" value={form.accent ?? '#1f47f5'} onChange={(e) => set({ accent: e.target.value })} />
            <input className="input font-mono" value={form.accent ?? ''} onChange={(e) => set({ accent: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Secondary accent (gradient)</label>
          <div className="flex items-center gap-2">
            <input type="color" className="h-9 w-12 rounded border border-slate-300" value={form.accent2 ?? form.accent ?? '#7c3aed'} onChange={(e) => set({ accent2: e.target.value })} />
            <input className="input font-mono" value={form.accent2 ?? ''} onChange={(e) => set({ accent2: e.target.value })} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Logo</label>
          <input type="file" accept="image/*" className="text-xs text-slate-500" onChange={onLogo} />
          {form.logoDataUrl && <img src={form.logoDataUrl} alt="" className="mt-2 h-12 rounded object-contain" />}
        </div>
      </div>

      {/* Manual bill books (handbills) */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-700">Manual bill books (Handbills)</h4>
            <p className="text-xs text-slate-400">Pre-printed receipt books your workers carry. Configure them here; numbers stay editable when issuing a bill.</p>
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => set({ handbooks: [...(form.handbooks ?? []), { id: uid(), name: '', bookNo: '', billsPerBook: 50, startNo: 1 } as Handbook] })}
          >
            <Plus className="h-4 w-4" /> Add book
          </button>
        </div>
        {(form.handbooks ?? []).length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">No books yet. Add one for each physical receipt book / worker.</p>
        ) : (
          <div className="space-y-2">
            {(form.handbooks ?? []).map((hb) => {
              const upd = (patch: Partial<Handbook>) =>
                set({ handbooks: (form.handbooks ?? []).map((x) => (x.id === hb.id ? { ...x, ...patch } : x)) })
              return (
                <div key={hb.id} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-6">
                  <div className="col-span-2 sm:col-span-2">
                    <label className="label">Book name</label>
                    <input className="input" value={hb.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Counter / worker" />
                  </div>
                  <div>
                    <label className="label">Book No</label>
                    <input className="input" value={hb.bookNo} onChange={(e) => upd({ bookNo: e.target.value })} placeholder="12" />
                  </div>
                  <div>
                    <label className="label"># Bills</label>
                    <input type="number" min={1} className="input tnum" value={hb.billsPerBook} onChange={(e) => upd({ billsPerBook: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="label">Start No</label>
                    <input type="number" min={0} className="input tnum" value={hb.startNo} onChange={(e) => upd({ startNo: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-end gap-1">
                    <div className="flex-1">
                      <label className="label">Worker</label>
                      <input className="input" value={hb.assignedTo ?? ''} onChange={(e) => upd({ assignedTo: e.target.value })} placeholder="Optional" />
                    </div>
                    <button type="button" className="mb-1 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      onClick={() => set({ handbooks: (form.handbooks ?? []).filter((x) => x.id !== hb.id) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!form.name?.trim()} onClick={() => onSave({ ...form, id: company?.id })}>
          Save company
        </button>
      </div>
    </Modal>
  )
}
