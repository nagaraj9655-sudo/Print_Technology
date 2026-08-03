import type { Bill, Company, DocTemplate, Quotation, Settings } from '../lib/types'
import { billTotals, docUsesGst, lineTotal, quoteTotals, recipientInterState, type Totals } from '../lib/calc'
import { amountInWords, formatDate, formatINR } from '../lib/format'
import { UpiQr } from './UpiQr'

// A4 print-ready invoice / quotation (§7) with per-company templates.
//
// Design goals:
//  • Colourful & distinct per company (colour, layout, font all differ by template).
//  • Prints in colour on colour printers (print-color-adjust: exact) yet stays fully
//    legible on a black-and-white printer — meaning is carried by contrast, borders,
//    weight and shape, never by colour alone.
//  • Header can be hidden for pre-printed letter-pad stationery (showHeader = false).

export interface DocViewProps {
  doc: Bill | Quotation
  company: Company | undefined
  kind: 'bill' | 'quote'
  settings: Settings
  showHeader?: boolean
}

function fontStack(name?: string): string {
  switch (name) {
    case 'Poppins':
      return "'Poppins', 'Inter', system-ui, sans-serif"
    case 'Libre Baskerville':
      return "'Libre Baskerville', Georgia, 'Times New Roman', serif"
    case 'Playfair Display':
      return "'Playfair Display', Georgia, serif"
    case 'Roboto Slab':
      return "'Roboto Slab', Georgia, serif"
    case 'Inter':
    default:
      return "'Inter', system-ui, sans-serif"
  }
}

interface Ctx {
  doc: Bill | Quotation
  company: Company | undefined
  kind: 'bill' | 'quote'
  settings: Settings
  showHeader: boolean
  gst: boolean
  accent: string
  accent2: string
  isBill: boolean
  t: Totals
  title: string
  docNo: string
  interState: boolean
  validUntil?: string
  topMm: number
}

export function DocumentView(props: DocViewProps) {
  const { doc, company, kind, settings, showHeader = true } = props
  const gst = docUsesGst(company, doc.gstEnabled)
  const accent = company?.accent ?? '#2563eb'
  const accent2 = company?.accent2 ?? accent
  const isBill = kind === 'bill'
  const bill = isBill ? (doc as Bill) : undefined
  const t = isBill ? billTotals(doc as Bill, company) : quoteTotals(doc as Quotation, company)
  const interState = recipientInterState(company, doc.customerGstin)
  const title = isBill ? (gst ? 'TAX INVOICE' : 'INVOICE') : 'QUOTATION'
  const docNo =
    bill && bill.billType === 'Handbill'
      ? `Book ${bill.handBookNo || '—'} · No ${bill.handBillNo || '—'}`
      : isBill
        ? (doc as Bill).companyBillNo
        : (doc as Quotation).companyQuoteNo
  const validUntil = !isBill ? (doc as Quotation).validUntil : undefined
  const topMm = (isBill ? settings.letterpadBillTopMm : settings.letterpadQuoteTopMm) ?? 40

  const ctx: Ctx = { doc, company, kind, settings, showHeader, gst, accent, accent2, isBill, t, title, docNo, interState, validUntil, topMm }
  const template: DocTemplate = company?.template ?? 'modern'

  return (
    <div
      className="print-page mx-auto w-full max-w-[820px] bg-white text-slate-800 shadow-card print:shadow-none"
      style={{
        fontFamily: fontStack(company?.fontFamily),
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {template === 'classic' ? <ClassicTemplate ctx={ctx} /> : template === 'minimal' ? <MinimalTemplate ctx={ctx} /> : <ModernTemplate ctx={ctx} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function LetterheadSpacer({ mm }: { mm: number }) {
  // Clears the pre-printed header on letter-pad stationery. Height is configurable
  // in Settings so content starts below your letterhead.
  return <div style={{ height: `${mm}mm` }} aria-hidden />
}

function StatusStamp({ status }: { status: string }) {
  const color = status === 'Paid' ? '#059669' : status === 'Partial' ? '#d97706' : '#dc2626'
  return (
    <div
      className="inline-block rotate-[-5deg] rounded border-2 px-3 py-1 text-sm font-extrabold uppercase tracking-wider"
      style={{ color, borderColor: color }}
    >
      {status}
    </div>
  )
}

function AmountWords({ amount }: { amount: number }) {
  return (
    <div className="mt-3 rounded border border-slate-300 px-3 py-2 text-xs text-slate-700">
      <span className="font-semibold">Amount in words:</span> {amountInWords(amount)}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* MODERN — bold coloured bands, sans-serif (Print Technology)         */
/* ------------------------------------------------------------------ */

function ModernTemplate({ ctx }: { ctx: Ctx }) {
  const { doc, company, gst, accent, accent2, isBill, t, title, docNo, interState, validUntil, showHeader, settings, topMm } = ctx
  return (
    <div className="p-8 print:p-0">
      {showHeader ? (
        <div className="flex items-start justify-between border-b-4 pb-4" style={{ borderColor: accent }}>
          <div className="flex items-start gap-3">
            {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="h-16 w-16 object-contain" />}
            <div>
              <h1 className="text-2xl font-extrabold leading-tight" style={{ color: accent }}>{company?.name}</h1>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{company?.address}</p>
              <p className="mt-1 text-xs text-slate-500">
                {company?.phone && <>☎ {company.phone}</>}
                {company?.email && <> · {company.email}</>}
              </p>
              {gst && <p className="mt-0.5 text-xs font-semibold text-slate-700">GSTIN: {company?.gstin}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold uppercase tracking-wide" style={{ color: accent }}>{title}</div>
          </div>
        </div>
      ) : (
        <LetterheadSpacer mm={topMm} />
      )}

      {/* Meta + bill to */}
      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="border-l-4 pl-3" style={{ borderColor: accent }}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{isBill ? 'Bill To' : 'Quotation For'}</p>
          <p className="mt-1 font-bold text-slate-900">{doc.customerName || '—'}</p>
          <p className="text-xs leading-relaxed text-slate-500">{doc.customerAddress}</p>
          {doc.customerPhone && <p className="text-xs text-slate-500">☎ {doc.customerPhone}</p>}
          {gst && doc.customerGstin && <p className="mt-0.5 text-xs font-medium text-slate-600">GSTIN: {doc.customerGstin}</p>}
        </div>
        <div className="space-y-1 text-right text-sm">
          <Meta label={isBill ? 'Invoice No' : 'Quote No'} value={docNo} strong />
          <Meta label="Date" value={formatDate(doc.date)} />
          {validUntil && <Meta label="Valid Until" value={formatDate(validUntil)} />}
          {gst && <Meta label="Supply" value={interState ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'} />}
          {isBill && <div className="flex justify-end pt-1"><StatusStamp status={t.status} /></div>}
        </div>
      </div>

      {/* Items */}
      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2" style={{ borderColor: accent }}>
            <th className="px-2 py-2 text-left text-xs font-bold uppercase" style={{ color: accent }}>#</th>
            <th className="px-2 py-2 text-left text-xs font-bold uppercase" style={{ color: accent }}>Description</th>
            {gst && <th className="px-2 py-2 text-left text-xs font-bold uppercase" style={{ color: accent }}>HSN/SAC</th>}
            <th className="px-2 py-2 text-right text-xs font-bold uppercase" style={{ color: accent }}>Qty</th>
            <th className="px-2 py-2 text-right text-xs font-bold uppercase" style={{ color: accent }}>Rate</th>
            {gst && <th className="px-2 py-2 text-right text-xs font-bold uppercase" style={{ color: accent }}>GST%</th>}
            <th className="px-2 py-2 text-right text-xs font-bold uppercase" style={{ color: accent }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, i) => (
            <tr key={it.id} className="border-b border-slate-200">
              <td className="px-2 py-2 text-slate-400">{i + 1}</td>
              <td className="px-2 py-2 font-medium text-slate-800">{it.description}</td>
              {gst && <td className="px-2 py-2 text-slate-500">{it.hsnSac || '—'}</td>}
              <td className="px-2 py-2 text-right tnum">{it.qty}</td>
              <td className="px-2 py-2 text-right tnum">{formatINR(it.rate, false)}</td>
              {gst && <td className="px-2 py-2 text-right tnum text-slate-500">{it.taxRate ?? 0}%</td>}
              <td className="px-2 py-2 text-right font-semibold tnum">{formatINR(lineTotal(it), false)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock ctx={ctx} variant="card" />
      {isBill && <AmountWords amount={t.net} />}
      <Footer ctx={ctx} />
      <p className="mt-4 text-center text-[10px] text-slate-400">{settings.invoiceFooter}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CLASSIC — centered, serif, ruled lines (Shravan Infotech)           */
/* ------------------------------------------------------------------ */

function ClassicTemplate({ ctx }: { ctx: Ctx }) {
  const { doc, company, gst, accent, isBill, t, title, docNo, interState, validUntil, showHeader, settings, topMm } = ctx
  return (
    <div className="p-9 print:p-2">
      {showHeader ? (
        <div className="text-center">
          {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" />}
          <h1 className="text-2xl font-bold tracking-wide text-slate-900" style={{ letterSpacing: '0.04em' }}>
            {company?.name}
          </h1>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">{company?.address}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {company?.phone && <>☎ {company.phone}</>}
            {company?.email && <> · {company.email}</>}
            {gst && <> · GSTIN: {company?.gstin}</>}
          </p>
          <div className="mx-auto mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-16" style={{ background: accent }} />
            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">{title}</span>
            <span className="h-px w-16" style={{ background: accent }} />
          </div>
        </div>
      ) : (
        <>
          <LetterheadSpacer mm={topMm} />
          <div className="mx-auto mb-2 flex items-center justify-center gap-3">
            <span className="h-px w-16" style={{ background: accent }} />
            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">{title}</span>
            <span className="h-px w-16" style={{ background: accent }} />
          </div>
        </>
      )}

      <div className="mt-6 flex justify-between border-y-2 py-3 text-sm" style={{ borderColor: accent }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{isBill ? 'Bill To' : 'Quotation For'}</p>
          <p className="mt-1 font-bold text-slate-900">{doc.customerName || '—'}</p>
          <p className="text-xs leading-relaxed text-slate-500">{doc.customerAddress}</p>
          {doc.customerPhone && <p className="text-xs text-slate-500">☎ {doc.customerPhone}</p>}
          {gst && doc.customerGstin && <p className="text-xs text-slate-600">GSTIN: {doc.customerGstin}</p>}
        </div>
        <div className="space-y-1 text-right">
          <Meta label={isBill ? 'Invoice No' : 'Quote No'} value={docNo} strong />
          <Meta label="Date" value={formatDate(doc.date)} />
          {validUntil && <Meta label="Valid Until" value={formatDate(validUntil)} />}
          {gst && <Meta label="Supply" value={interState ? 'IGST' : 'CGST+SGST'} />}
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2" style={{ borderColor: accent }}>
            <th className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>#</th>
            <th className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>Description</th>
            {gst && <th className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>HSN/SAC</th>}
            <th className="px-2 py-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>Qty</th>
            <th className="px-2 py-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>Rate</th>
            {gst && <th className="px-2 py-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>GST%</th>}
            <th className="px-2 py-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, i) => (
            <tr key={it.id} className="border-b border-slate-200">
              <td className="px-2 py-2.5 text-slate-400">{i + 1}</td>
              <td className="px-2 py-2.5 text-slate-800">{it.description}</td>
              {gst && <td className="px-2 py-2.5 text-slate-500">{it.hsnSac || '—'}</td>}
              <td className="px-2 py-2.5 text-right tnum">{it.qty}</td>
              <td className="px-2 py-2.5 text-right tnum">{formatINR(it.rate, false)}</td>
              {gst && <td className="px-2 py-2.5 text-right tnum text-slate-500">{it.taxRate ?? 0}%</td>}
              <td className="px-2 py-2.5 text-right font-medium tnum">{formatINR(lineTotal(it), false)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock ctx={ctx} variant="ruled" />
      {isBill && (
        <div className="mt-3 flex items-center justify-between">
          <AmountWords amount={t.net} />
          <StatusStamp status={t.status} />
        </div>
      )}
      <Footer ctx={ctx} />
      <p className="mt-4 text-center text-[10px] italic text-slate-400">{settings.invoiceFooter}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* MINIMAL — clean monochrome with a single accent edge                */
/* ------------------------------------------------------------------ */

function MinimalTemplate({ ctx }: { ctx: Ctx }) {
  const { doc, company, gst, accent, isBill, t, title, docNo, validUntil, showHeader, settings, topMm } = ctx
  return (
    <div className="border-l-[6px] p-8 print:p-2" style={{ borderColor: accent }}>
      {showHeader ? (
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="h-12 w-12 object-contain" />}
            <div>
              <h1 className="text-lg font-bold text-slate-900">{company?.name}</h1>
              <p className="max-w-xs text-xs text-slate-500">{company?.address}</p>
              <p className="text-xs text-slate-500">{company?.phone}{gst && <> · GSTIN {company?.gstin}</>}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
            <p className="text-lg font-bold" style={{ color: accent }}>{docNo}</p>
            <p className="text-xs text-slate-500">{formatDate(doc.date)}</p>
          </div>
        </div>
      ) : (
        <>
          <LetterheadSpacer mm={topMm} />
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
            <p className="text-sm font-bold text-slate-700">{docNo} · {formatDate(doc.date)}</p>
          </div>
        </>
      )}

      <div className="mt-5 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{isBill ? 'Bill To' : 'Quotation For'}</p>
        <p className="font-semibold text-slate-900">{doc.customerName}</p>
        <p className="text-xs text-slate-500">{doc.customerAddress}{doc.customerPhone ? ` · ☎ ${doc.customerPhone}` : ''}</p>
        {validUntil && <p className="text-xs text-slate-500">Valid until {formatDate(validUntil)}</p>}
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800">
            <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-600">Description</th>
            {gst && <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-600">HSN</th>}
            <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-600">Qty</th>
            <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-600">Rate</th>
            <th className="px-2 py-2 text-right text-xs font-semibold uppercase text-slate-600">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="px-2 py-2 text-slate-800">{it.description}</td>
              {gst && <td className="px-2 py-2 text-slate-500">{it.hsnSac || '—'}</td>}
              <td className="px-2 py-2 text-right tnum">{it.qty}</td>
              <td className="px-2 py-2 text-right tnum">{formatINR(it.rate, false)}</td>
              <td className="px-2 py-2 text-right font-medium tnum">{formatINR(lineTotal(it), false)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock ctx={ctx} variant="ruled" />
      {isBill && <AmountWords amount={t.net} />}
      <Footer ctx={ctx} />
      <p className="mt-4 text-[10px] text-slate-400">{settings.invoiceFooter}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared totals & footer                                              */
/* ------------------------------------------------------------------ */

function TotalsBlock({ ctx, variant }: { ctx: Ctx; variant: 'card' | 'ruled' }) {
  const { gst, isBill, t, accent } = ctx
  const boxed = variant === 'card'
  return (
    <div className="mt-4 flex justify-end">
      <div className={`w-72 text-sm ${boxed ? 'rounded-lg border border-slate-200 p-3' : ''}`}>
        <TotalRow label="Gross" value={formatINR(t.gross)} />
        {t.discount > 0 && <TotalRow label="Discount" value={`− ${formatINR(t.discount)}`} />}
        {gst && <TotalRow label="Taxable Value" value={formatINR(t.taxable)} />}
        {gst && t.igst > 0 && <TotalRow label="IGST" value={formatINR(t.igst)} />}
        {gst && t.cgst > 0 && <TotalRow label="CGST" value={formatINR(t.cgst)} />}
        {gst && t.sgst > 0 && <TotalRow label="SGST" value={formatINR(t.sgst)} />}
        <div
          className="my-1.5 flex items-center justify-between rounded border-2 px-2 py-1.5 font-bold"
          style={{ borderColor: accent, color: accent }}
        >
          <span>{isBill ? 'Net Payable' : 'Total'}</span>
          <span className="tnum">{formatINR(t.net)}</span>
        </div>
        {isBill && (
          <>
            <TotalRow label="Received" value={formatINR(t.received)} />
            <TotalRow label="Balance Due" value={formatINR(t.balance)} strong />
          </>
        )}
      </div>
    </div>
  )
}

function Footer({ ctx }: { ctx: Ctx }) {
  const { company, isBill, t } = ctx
  // Show a scannable pay-QR on bills that still owe money.
  const showQr = isBill && !!company?.upiId && t.balance > 0.001
  const qrAmount = t.balance > 0.001 ? t.balance : t.net
  return (
    <div className="mt-6 grid grid-cols-2 gap-6 border-t border-slate-200 pt-4 text-xs">
      <div className="space-y-2">
        {(company?.bankDetails || company?.upiId) && (
          <div>
            <p className="font-semibold text-slate-600">Payment details</p>
            {company?.bankDetails && <p className="text-slate-500">{company.bankDetails}</p>}
            {company?.upiId && <p className="text-slate-500">UPI (GPay/PhonePe): {company.upiId}</p>}
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-600">Terms &amp; Conditions</p>
          <p className="text-slate-500">{company?.terms || 'Thank you for your business.'}</p>
        </div>
      </div>
      <div className="flex items-end justify-end gap-4">
        {showQr && (
          <div className="text-center">
            <UpiQr upiId={company!.upiId!} payeeName={company!.payeeName || company!.name} amount={qrAmount} note={ctx.docNo} size={92} className="rounded border border-slate-200" />
            <p className="mt-0.5 text-[10px] text-slate-500">Scan to pay</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-slate-500">For {company?.name}</p>
          <div className="mt-10 border-t border-slate-300 pt-1 text-slate-500">Authorised Signatory</div>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-end gap-3">
      <span className="text-slate-400">{label}:</span>
      <span className={strong ? 'font-bold text-slate-900' : 'text-slate-600'}>{value}</span>
    </div>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={strong ? 'font-semibold text-slate-700' : 'text-slate-500'}>{label}</span>
      <span className={`tnum ${strong ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{value}</span>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 text-xs font-semibold ${className}`}>{children}</th>
}
