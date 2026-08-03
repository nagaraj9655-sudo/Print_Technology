import { Plus, Trash2 } from 'lucide-react'
import type { LineItem } from '../lib/types'
import { formatINR } from '../lib/format'
import { lineTotal } from '../lib/calc'
import { uid } from '../lib/db'

interface Props {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  gstMode: boolean
  taxRates: number[]
  defaultTaxRate: number
  showCost?: boolean // per-line original/cost price (never printed; profit only)
}

export function LineItemEditor({ items, onChange, gstMode, taxRates, defaultTaxRate, showCost = false }: Props) {
  const update = (id: string, patch: Partial<LineItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const addRow = () =>
    onChange([
      ...items,
      { id: uid(), description: '', qty: 1, rate: 0, hsnSac: '', taxRate: gstMode ? defaultTaxRate : undefined },
    ])

  const removeRow = (id: string) => onChange(items.filter((it) => it.id !== id))

  // Enter on the last row's rate/qty adds a new row (spreadsheet-like fast entry).
  const onKeyDown = (e: React.KeyboardEvent, isLast: boolean) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isLast) addRow()
    }
  }

  const gross = items.reduce((s, it) => s + lineTotal(it), 0)
  const totalCols = 6 + (gstMode ? 2 : 0) + (showCost ? 1 : 0)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="th w-8">#</th>
            <th className="th">Description</th>
            {gstMode && <th className="th w-24">HSN/SAC</th>}
            <th className="th w-20 text-right">Qty</th>
            <th className="th w-28 text-right">Rate</th>
            {showCost && <th className="th w-28 text-right text-amber-600" title="Not printed — profit report only">Cost*</th>}
            {gstMode && <th className="th w-20 text-right">GST%</th>}
            <th className="th w-28 text-right">Amount</th>
            <th className="th w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((it, idx) => {
            const isLast = idx === items.length - 1
            return (
              <tr key={it.id} className="hover:bg-slate-50/50">
                <td className="td text-center text-slate-400">{idx + 1}</td>
                <td className="td">
                  <input
                    className="input"
                    value={it.description}
                    placeholder="Service / item description"
                    onChange={(e) => update(it.id, { description: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, isLast)}
                  />
                </td>
                {gstMode && (
                  <td className="td">
                    <input
                      className="input"
                      value={it.hsnSac ?? ''}
                      placeholder="HSN"
                      onChange={(e) => update(it.id, { hsnSac: e.target.value })}
                    />
                  </td>
                )}
                <td className="td">
                  <input
                    className="input text-right tnum"
                    type="number"
                    min={0}
                    step="any"
                    value={it.qty}
                    onChange={(e) => update(it.id, { qty: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => onKeyDown(e, isLast)}
                  />
                </td>
                <td className="td">
                  <input
                    className="input text-right tnum"
                    type="number"
                    min={0}
                    step="any"
                    value={it.rate}
                    onChange={(e) => update(it.id, { rate: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => onKeyDown(e, isLast)}
                  />
                </td>
                {showCost && (
                  <td className="td">
                    <input
                      className="input text-right tnum"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="—"
                      value={it.cost ?? ''}
                      onChange={(e) => update(it.id, { cost: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                )}
                {gstMode && (
                  <td className="td">
                    <select
                      className="input px-1 text-right tnum"
                      value={it.taxRate ?? 0}
                      onChange={(e) => update(it.id, { taxRate: parseFloat(e.target.value) })}
                    >
                      {taxRates.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="td text-right font-medium tnum text-slate-800">{formatINR(lineTotal(it))}</td>
                <td className="td text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(it.id)}
                    className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={totalCols} className="td py-6 text-center text-slate-400">
                No items yet — add your first line.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td colSpan={totalCols - 2} className="td">
              <button type="button" onClick={addRow} className="btn-ghost -ml-1 text-brand-600">
                <Plus className="h-4 w-4" /> Add row
                <span className="ml-1 text-xs text-slate-400">(Enter)</span>
              </button>
            </td>
            <td className="td text-right text-xs font-semibold uppercase text-slate-500">Gross</td>
            <td className="td text-right font-bold tnum text-slate-800">{formatINR(gross)}</td>
          </tr>
        </tfoot>
      </table>
      {showCost && (
        <p className="border-t border-slate-100 bg-amber-50/50 px-3 py-1.5 text-xs text-amber-700">
          * Cost is your original/buying price — used only for the profit report and never shown on the printed bill or quote.
        </p>
      )}
    </div>
  )
}
