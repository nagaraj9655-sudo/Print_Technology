import { useState } from 'react'
import { useStore } from '../lib/store'
import { useToast } from '../components/ui'
import { Lock, Mail } from 'lucide-react'

export default function Login() {
  const { login, mode } = useStore()
  const toast = useToast()
  const [email, setEmail] = useState(mode === 'supabase' ? '' : 'admin@magizhini.app')
  const [password, setPassword] = useState(mode === 'supabase' ? '' : 'admin123')
  const [error, setError] = useState('')

  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Login failed')
    } else {
      toast(`Welcome back!`)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-brand-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white shadow-soft">
            M
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Magizhini</h1>
          <p className="text-sm text-slate-500">Billing &amp; Quotation Management</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {mode === 'local' ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <p className="font-medium text-slate-600">Demo accounts</p>
              <p>Admin — admin@magizhini.app / admin123</p>
              <p>Operator — operator@magizhini.app / operator123</p>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              Sign in with your Supabase account. The first user to sign up becomes the Admin.
            </p>
          )}
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          {mode === 'supabase' ? 'Connected to Supabase · secure cloud database' : 'Client-side mode · data stored locally in your browser'}
        </p>
      </div>
    </div>
  )
}
