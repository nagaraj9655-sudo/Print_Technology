import { useState } from 'react'
import { Database, Download, RotateCcw, Save } from 'lucide-react'
import { useStore } from '../lib/store'
import { useConfirm, useToast } from '../components/ui'
import { exportFullBackup } from '../lib/excel'

export default function Settings() {
  const { db, saveSettings, reset, currentUser } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()

  const [currency, setCurrency] = useState(db.settings.currency)
  const [defaultTaxRate, setDefaultTaxRate] = useState(db.settings.defaultTaxRate)
  const [fyStartMonth, setFyStartMonth] = useState(db.settings.fyStartMonth)
  const [taxRates, setTaxRates] = useState(db.settings.taxRates.join(', '))
  const [footer, setFooter] = useState(db.settings.invoiceFooter)

  const save = () => {
    saveSettings({
      currency,
      defaultTaxRate,
      fyStartMonth,
      invoiceFooter: footer,
      taxRates: taxRates.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)),
    })
    toast('Settings saved')
  }

  const doReset = async () => {
    if (currentUser?.role !== 'Admin') return toast('Only Admin can reset data', 'error')
    if (await confirm('Reset ALL data back to the seeded demo state? This cannot be undone.')) {
      reset()
      toast('Data reset to demo state', 'info')
    }
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Defaults, tax configuration, and data management</p>
      </div>

      <div className="card mb-5 p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">General</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Currency symbol</label>
            <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div>
            <label className="label">Financial year starts</label>
            <select className="input" value={fyStartMonth} onChange={(e) => setFyStartMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Default GST rate (%)</label>
            <input type="number" className="input" value={defaultTaxRate} onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Available GST rates (comma-separated %)</label>
            <input className="input" value={taxRates} onChange={(e) => setTaxRates(e.target.value)} placeholder="0, 5, 12, 18, 28" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Invoice footer text</label>
            <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Tax rates, HSN/SAC codes and the CGST/SGST-vs-IGST split are configurable and not hard-coded. Confirm the exact
          configuration against current CBIC notifications and each company's registration before go-live.
        </p>
        <div className="mt-4">
          <button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> Save settings</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Database className="h-4 w-4" /> Data management
        </h3>
        <p className="mb-4 text-xs text-slate-400">Your data lives in this browser. Export a full backup so you're never locked in.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => { exportFullBackup(db); toast('Backup exported') }}>
            <Download className="h-4 w-4" /> Export full backup (Excel)
          </button>
          <button className="btn-outline text-red-600 hover:bg-red-50" onClick={doReset}>
            <RotateCcw className="h-4 w-4" /> Reset to demo data
          </button>
        </div>
      </div>
      {node}
    </div>
  )
}
