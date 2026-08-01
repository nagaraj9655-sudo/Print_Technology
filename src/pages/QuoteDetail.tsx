import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, FileSpreadsheet, Pencil, Printer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../lib/store'
import { DocumentView } from '../components/DocumentView'
import { HeaderToggle } from '../components/HeaderToggle'
import { QuotePill, useConfirm, useToast } from '../components/ui'
import { exportQuoteExcel } from '../lib/excel'
import type { QuoteStatus } from '../lib/types'

export default function QuoteDetail() {
  const { id } = useParams()
  const { db, setQuoteStatus, convertQuoteToBill, deleteQuote, currentUser } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [showHeader, setShowHeader] = useState(true)

  const quote = db.quotations.find((q) => q.id === id)
  if (!quote) return <div className="text-slate-500">Quotation not found.</div>
  const company = db.companies.find((c) => c.id === quote.companyId)

  const convert = async () => {
    if (await confirm(`Create a new bill from ${quote.companyQuoteNo}? The quote will be marked Converted.`)) {
      const bill = convertQuoteToBill(quote.id)
      toast('Converted to bill')
      navigate(`/bills/${bill.id}`)
    }
  }

  const onDelete = async () => {
    if (currentUser?.role !== 'Admin') return toast('Only Admin can delete', 'error')
    if (await confirm(`Delete quotation ${quote.companyQuoteNo}?`)) {
      deleteQuote(quote.id)
      toast('Quotation deleted')
      navigate('/quotations')
    }
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => navigate('/quotations')} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Quotations
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={quote.status}
            onChange={(e) => { setQuoteStatus(quote.id, e.target.value as QuoteStatus); toast('Status updated') }}
            disabled={quote.status === 'Converted'}
          >
            {(['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            {quote.status === 'Converted' && <option value="Converted">Converted</option>}
          </select>

          {quote.status !== 'Converted' && (
            <button className="btn-primary" onClick={convert}>
              <ArrowRightLeft className="h-4 w-4" /> Convert to Bill
            </button>
          )}
          {quote.convertedBillId && (
            <Link to={`/bills/${quote.convertedBillId}`} className="btn-outline">View Bill</Link>
          )}
          <button className="btn-outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> PDF / Print</button>
          <button className="btn-outline" onClick={() => exportQuoteExcel(quote, company)}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <Link to={`/quotations/${quote.id}/edit`} className="btn-outline"><Pencil className="h-4 w-4" /> Edit</Link>
          <button className="btn-outline text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </div>

      <div className="no-print mb-3 flex items-center gap-3 text-sm text-slate-500">
        <span className="flex items-center gap-2">Status: <QuotePill status={quote.status} /></span>
        <HeaderToggle value={showHeader} onChange={setShowHeader} />
      </div>

      <div className="mx-auto max-w-3xl">
        <DocumentView doc={quote} company={company} kind="quote" settings={db.settings} showHeader={showHeader} />
      </div>
      {node}
    </div>
  )
}
