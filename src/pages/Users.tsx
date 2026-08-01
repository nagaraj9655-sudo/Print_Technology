import { useState } from 'react'
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { useStore } from '../lib/store'
import { EmptyState, Modal, useConfirm, useToast } from '../components/ui'
import type { Role, User } from '../lib/types'

export default function Users() {
  const { db, currentUser, saveUser, deleteUser } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  if (currentUser?.role !== 'Admin') {
    return (
      <EmptyState icon={ShieldCheck} title="Admins only" hint="User management is restricted to Admin accounts." />
    )
  }

  const onDelete = async (u: User) => {
    if (await confirm(`Remove user ${u.name} (${u.email})?`)) {
      const res = await deleteUser(u.id)
      if (res.ok) toast('User removed')
      else toast(res.error ?? 'Could not remove user', 'error')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Users</h1>
          <p className="text-sm text-slate-500">{db.users.length} users · Admins manage everything, Operators create documents</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {db.users.length === 0 ? (
        <EmptyState icon={UserCog} title="No users" hint="Add your first user." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">Role</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.users.map((u) => (
                  <tr key={u.id} className="even:bg-slate-50/40">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                          {u.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-800">
                          {u.name}
                          {u.id === currentUser.id && <span className="ml-2 text-xs font-normal text-brand-600">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="td text-slate-600">{u.email}</td>
                    <td className="td">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${u.role === 'Admin' ? 'bg-brand-50 text-brand-700 ring-brand-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20'}`}>
                        {u.role === 'Admin' && <ShieldCheck className="h-3 w-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => { setEditing(u); setOpen(true) }}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" onClick={() => onDelete(u)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <UserModal
          user={editing}
          onClose={() => setOpen(false)}
          onSave={async (data) => {
            const res = await saveUser(data)
            if (res.ok) { toast(editing ? 'User updated' : 'User created'); setOpen(false) }
            else toast(res.error ?? 'Could not save', 'error')
          }}
        />
      )}
      {node}
    </div>
  )
}

function UserModal({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: (u: Partial<User> & { id?: string }) => void }) {
  const { mode } = useStore()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'Operator')
  const [password, setPassword] = useState('')
  const emailLocked = mode === 'supabase' && !!user // email is the Supabase login id; don't change it here

  return (
    <Modal open onClose={onClose} title={user ? 'Edit user' : 'Add user'}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={emailLocked} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="Operator">Operator</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
        {!(mode === 'supabase' && user) && (
          <div>
            <label className="label">{user ? 'New password (blank = unchanged)' : 'Password *'}</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={user ? '••••••••' : 'Set a password'} />
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {mode === 'supabase'
          ? user
            ? 'Editing updates this user’s name and role. Password/email changes are managed in Supabase.'
            : 'Creates a real Supabase login account (requires the admin-create-user function to be deployed — see README).'
          : 'Note: local mode stores passwords in the browser. Switch to Supabase for secure, hashed accounts.'}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!name.trim() || !email.trim() || (!user && !password.trim())} onClick={() => onSave({ id: user?.id, name, email, role, password })}>
          {user ? 'Save' : 'Create user'}
        </button>
      </div>
    </Modal>
  )
}
