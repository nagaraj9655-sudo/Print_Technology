import type { FC } from 'react'
import type { Bill, Company, DocTemplate, Quotation, Settings } from '../lib/types'
import { billTotals, docUsesGst, lineTotal, quoteTotals, recipientInterState, type Totals } from '../lib/calc'
import { amountInWords, formatDate, formatINR } from '../lib/format'
import { UpiQr } from './UpiQr'

// A4 print-ready invoice / quotation with SIX visually distinct templates.
// Each template differs in font, header, line/border treatment, status stamp and
// the net-payable box. Colour is carried by text + borders (print-friendly — no
// heavy background shading), except a couple of small accent chips.

export interface DocViewProps {
  doc: Bill | Quotation
  company: Company | undefined
  kind: 'bill' | 'quote'
  settings: Settings
  showHeader?: boolean
}

function fontStack(name?: string): string {
  switch (name) {
    case 'Poppins': return "'Poppins', 'Inter', system-ui, sans-serif"
    case 'Libre Baskerville': return "'Libre Baskerville', Georgia, 'Times New Roman', serif"
    case 'Playfair Display': return "'Playfair Display', Georgia, serif"
    case 'Roboto Slab': return "'Roboto Slab', Georgia, serif"
    case 'Inter': return "'Inter', system-ui, sans-serif"
    default: return ''
  }
}
function templateFont(t: DocTemplate): string {
  switch (t) {
    case 'classic': return "'Libre Baskerville', Georgia, serif"
    case 'elegant': return "'Playfair Display', Georgia, serif"
    case 'bold': return "'Roboto Slab', Georgia, serif"
    case 'modern': return "'Poppins', 'Inter', sans-serif"
    default: return "'Inter', system-ui, sans-serif"
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
  inclusive: boolean
  template: DocTemplate
  simpleBill: boolean
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
      : isBill ? (doc as Bill).companyBillNo : (doc as Quotation).companyQuoteNo
  const validUntil = !isBill ? (doc as Quotation).validUntil : undefined
  const topMm = (isBill ? settings.letterpadBillTopMm : settings.letterpadQuoteTopMm) ?? 40
  const inclusive = gst && !!doc.gstInclusive
  const template: DocTemplate = company?.template ?? 'modern'
  const simpleBill = isBill && !!(doc as Bill).simpleBill

  const ctx: Ctx = { doc, company, kind, settings, showHeader, gst, accent, accent2, isBill, t, title, docNo, interState, validUntil, topMm, inclusive, template, simpleBill }

  const font = company?.fontFamily ? fontStack(company.fontFamily) || templateFont(template) : templateFont(template)

  const Template = TEMPLATES[template] ?? ModernTemplate
  return (
    <div
      className="print-page mx-auto bg-white text-slate-800 print:shadow-none"
      style={{
        fontFamily: font,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box'
      }}
    >
      <Template ctx={ctx} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function LetterheadSpacer({ mm }: { mm: number }) {
  return <div style={{ height: `${mm}mm` }} aria-hidden />
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-end gap-3">
      <span className="text-slate-600">{label}:</span>
      <span className={strong ? 'font-bold text-slate-900' : 'text-slate-700'}>{value}</span>
    </div>
  )
}

function AmountWords({ amount }: { amount: number }) {
  return (
    <div className="mt-3 rounded border border-slate-400 px-3 py-2 text-xs text-slate-700">
      <span className="font-semibold">Amount in words:</span> {amountInWords(amount)}
    </div>
  )
}

// ---- Status stamp: distinct per template ----
function Stamp({ ctx }: { ctx: Ctx }) {
  const { t, template } = ctx
  const label = t.status === 'Paid' ? 'PAID' : t.status === 'Partial' ? 'PART PAID' : 'NOT PAID'
  const color = t.status === 'Paid' ? '#059669' : t.status === 'Partial' ? '#d97706' : '#dc2626'
  const base = 'inline-block font-extrabold uppercase tracking-wider'
  switch (template) {
    case 'modern':
      return <div className={`${base} rotate-[-5deg] rounded border-2 px-3 py-1 text-sm`} style={{ color, borderColor: color }}>{label}</div>
    case 'classic':
      return <div className={`${base} border-y-2 px-3 py-0.5 text-sm tracking-[0.3em]`} style={{ color, borderColor: color }}>{label}</div>
    case 'minimal':
      return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase" style={{ color, borderColor: color }}>{label}</span>
    case 'elegant':
      return <div className={`${base} rounded-full border-2 px-4 py-1.5 text-xs`} style={{ color, borderColor: color }}>{label}</div>
    case 'bold':
      return <div className={`${base} border-4 px-3 py-1 text-base`} style={{ color, borderColor: color }}>{label}</div>
    case 'grid':
      return <div className={`${base} border px-2 py-0.5 text-xs`} style={{ color, borderColor: color, background: color + '14' }}>{label}</div>
    default:
      return <div className={`${base} rounded border-2 px-3 py-1 text-sm`} style={{ color, borderColor: color }}>{label}</div>
  }
}

// ---- Net payable box: distinct per template ----
function NetBox({ ctx }: { ctx: Ctx }) {
  const { t, accent, isBill, template, simpleBill } = ctx
  const label = isBill ? (simpleBill ? 'Total' : 'Net Payable') : 'Grand Total'
  const val = formatINR(t.net)
  switch (template) {
    case 'modern':
      return (
        <div className="my-1.5 flex items-center justify-between rounded-lg px-3 py-2 font-bold text-white" style={{ background: accent }}>
          <span>{label}</span><span className="tnum text-lg">{val}</span>
        </div>
      )
    case 'classic':
      return (
        <div className="my-1.5 flex items-center justify-between border-y-4 border-double py-1.5 text-base font-bold" style={{ borderColor: accent, color: accent }}>
          <span className="tracking-wide">{label}</span><span className="tnum">{val}</span>
        </div>
      )
    case 'minimal':
      return (
        <div className="my-1.5 flex items-end justify-between border-b-2 pb-1" style={{ borderColor: accent }}>
          <span className="text-xs uppercase tracking-widest text-slate-600">{label}</span>
          <span className="tnum text-2xl font-bold" style={{ color: accent }}>{val}</span>
        </div>
      )
    case 'elegant':
      return (
        <div className="my-2 rounded border px-3 py-2 text-center" style={{ borderColor: accent }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-600">{label}</div>
          <div className="tnum text-xl font-bold" style={{ color: accent }}>{val}</div>
        </div>
      )
    case 'bold':
      return (
        <div className="my-1.5 flex items-center justify-between border-l-8 bg-transparent py-1 pl-3 pr-2" style={{ borderColor: accent }}>
          <span className="text-sm font-extrabold uppercase">{label}</span>
          <span className="tnum text-2xl font-extrabold text-slate-900">{val}</span>
        </div>
      )
    case 'grid':
      return (
        <div className="my-0 flex items-center justify-between border-2 px-2 py-1.5 font-bold" style={{ borderColor: accent, color: accent }}>
          <span>{label}</span><span className="tnum">{val}</span>
        </div>
      )
    default:
      return <div className="flex justify-between font-bold" style={{ color: accent }}><span>{label}</span><span className="tnum">{val}</span></div>
  }
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={strong ? 'font-semibold text-slate-700' : 'text-slate-600'}>{label}</span>
      <span className={`tnum ${strong ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{value}</span>
    </div>
  )
}

// Breakup rows (gross → discount → taxable → taxes). Net box + received/balance handled by templates.
function TotalsRows({ ctx }: { ctx: Ctx }) {
  const { gst, t, inclusive } = ctx
  return (
    <>
      <TotalRow label={inclusive ? 'Gross (incl. GST)' : 'Gross'} value={formatINR(t.gross)} />
      {t.discount > 0 && <TotalRow label="Discount" value={`− ${formatINR(t.discount)}`} />}
      {gst && <TotalRow label="Taxable Value" value={formatINR(t.taxable)} />}
      {gst && t.igst > 0 && <TotalRow label="IGST" value={formatINR(t.igst)} />}
      {gst && t.cgst > 0 && <TotalRow label="CGST" value={formatINR(t.cgst)} />}
      {gst && t.sgst > 0 && <TotalRow label="SGST" value={formatINR(t.sgst)} />}
    </>
  )
}

// Totals column used by most templates (breakup rows + net box + received/balance).
function TotalsColumn({ ctx, boxed }: { ctx: Ctx; boxed?: boolean }) {
  const { isBill, t, simpleBill } = ctx
  return (
    <div className={`w-72 text-sm ${boxed ? 'rounded-lg border border-slate-300 p-3' : ''}`}>
      <TotalsRows ctx={ctx} />
      <NetBox ctx={ctx} />
      {isBill && !simpleBill && (
        <>
          <TotalRow label="Received" value={formatINR(t.received)} />
          <TotalRow label="Balance Due" value={formatINR(t.balance)} strong />
        </>
      )}
    </div>
  )
}

function ItemHead({ gst, accent, style }: { gst: boolean; accent: string; style: 'accent' | 'dark' | 'plain' }) {
  const color = style === 'accent' ? accent : style === 'dark' ? '#1e293b' : '#475569'
  const cls = 'px-2 py-2 text-xs font-bold uppercase'
  return (
    <tr className={style === 'plain' ? 'border-b border-slate-400' : 'border-b-2'} style={{ borderColor: color }}>
      <th className={`${cls} text-left`} style={{ color }}>#</th>
      <th className={`${cls} text-left`} style={{ color }}>Description</th>
      {gst && <th className={`${cls} text-left`} style={{ color }}>HSN/SAC</th>}
      <th className={`${cls} text-right`} style={{ color }}>Qty</th>
      <th className={`${cls} text-right`} style={{ color }}>Rate</th>
      {gst && <th className={`${cls} text-right`} style={{ color }}>GST%</th>}
      <th className={`${cls} text-right`} style={{ color }}>Amount</th>
    </tr>
  )
}

function ItemRows({ ctx, grid }: { ctx: Ctx; grid?: boolean }) {
  const { doc, gst } = ctx
  const cell = grid ? 'border border-slate-300 px-2 py-1.5' : 'px-2 py-2'
  const rowBorder = grid ? '' : 'border-b border-slate-200'
  return (
    <>
      {doc.items.map((it, i) => (
        <tr key={it.id} className={rowBorder}>
          <td className={`${cell} text-slate-600`}>{i + 1}</td>
          <td className={`${cell} font-medium text-slate-800`}>{it.description}</td>
          {gst && <td className={`${cell} text-slate-700`}>{it.hsnSac || '—'}</td>}
          <td className={`${cell} text-right tnum text-slate-700`}>{it.qty}</td>
          <td className={`${cell} text-right tnum text-slate-700`}>{formatINR(it.rate, false)}</td>
          {gst && <td className={`${cell} text-right tnum text-slate-700`}>{it.taxRate ?? 0}%</td>}
          <td className={`${cell} text-right tnum font-semibold text-slate-800`}>{formatINR(lineTotal(it), false)}</td>
        </tr>
      ))}
    </>
  )
}

function BillTo({ ctx, className = '' }: { ctx: Ctx; className?: string }) {
  const { doc, gst, isBill } = ctx
  return (
    <div className={className}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{isBill ? 'Bill To' : 'Quotation For'}</p>
      <p className="mt-1 font-bold text-slate-900">{doc.customerName || '—'}</p>
      <p className="text-xs leading-relaxed text-slate-700">{doc.customerAddress}</p>
      {doc.customerPhone && <p className="text-xs text-slate-700">☎ {doc.customerPhone}</p>}
      {gst && doc.customerGstin && <p className="mt-0.5 text-xs font-medium text-slate-700">GSTIN: {doc.customerGstin}</p>}
    </div>
  )
}

function MetaCol({ ctx }: { ctx: Ctx }) {
  const { isBill, docNo, doc, validUntil, gst, interState, t } = ctx
  return (
    <div className="space-y-1 text-right text-sm">
      <Meta label={isBill ? 'Invoice No' : 'Quote No'} value={docNo} strong />
      <Meta label="Date" value={formatDate(doc.date)} />
      {validUntil && <Meta label="Valid Until" value={formatDate(validUntil)} />}
      {gst && <Meta label="Supply" value={interState ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'} />}
      {isBill && !ctx.simpleBill && <div className="flex justify-end pt-1"><Stamp ctx={{ ...ctx, t }} /></div>}
    </div>
  )
}

function SignatureBlock({ ctx, align = 'right' }: { ctx: Ctx; align?: 'right' | 'center' }) {
  const { company } = ctx
  const alignCls = align === 'center' ? 'text-center items-center' : 'text-right items-end'
  return (
    <div className={`flex flex-col ${alignCls}`}>
      <p className="text-slate-700">For {company?.name}</p>
      {company?.signatureDataUrl ? (
        <img src={company.signatureDataUrl} alt="signature" className="mt-1 h-14 object-contain" />
      ) : (
        <div className="mt-12" />
      )}
      <div className="border-t border-slate-400 pt-1 text-slate-800">{company?.signatoryName || 'Authorised Signatory'}</div>
      {company?.signatoryName && <p className="text-[10px] text-slate-600">Authorised Signatory</p>}
    </div>
  )
}

function PaymentQr({ ctx, size = 90 }: { ctx: Ctx; size?: number }) {
  const { company, isBill, t, docNo, simpleBill } = ctx
  if (simpleBill || !(isBill && company?.upiId && t.balance > 0.001)) return null
  return (
    <div className="text-center">
      <UpiQr upiId={company.upiId} payeeName={company.payeeName || company.name} amount={t.balance} note={docNo} size={size} className="rounded border border-slate-300" />
      <p className="mt-0.5 text-[10px] text-slate-600">Scan to pay</p>
    </div>
  )
}

function PaymentInfo({ ctx }: { ctx: Ctx }) {
  const { company } = ctx
  return (
    <div className="space-y-2">
      {(company?.bankDetails || company?.upiId) && (
        <div>
          <p className="font-semibold text-slate-700">Payment details</p>
          {company?.bankDetails && <p className="text-slate-700">{company.bankDetails}</p>}
          {company?.upiId && <p className="text-slate-700">UPI (GPay/PhonePe): {company.upiId}</p>}
        </div>
      )}
      <div>
        <p className="font-semibold text-slate-700">Terms &amp; Conditions</p>
        <p className="text-slate-700">{company?.terms || 'Thank you for your business.'}</p>
      </div>
    </div>
  )
}

function FooterImage({ ctx }: { ctx: Ctx }) {
  const { company } = ctx
  if (!company?.footerImageDataUrl) return null
  const w = company.footerImageWidthMm ?? 190
  const h = company.footerImageHeightMm
  return (
    <div className="mt-3 flex justify-center">
      <img src={company.footerImageDataUrl} alt="" style={{ width: `${w}mm`, height: h ? `${h}mm` : 'auto' }} className="object-contain" />
    </div>
  )
}

/* ================================================================== */
/* TEMPLATE 1 — MODERN (accent band header, sans, filled net box)      */
/* ================================================================== */
function ModernTemplate({ ctx }: { ctx: Ctx }) {
  const { company, gst, accent, isBill, title, showHeader, settings, topMm } = ctx
  return (
    <div className="p-8 print:p-0">
      {showHeader ? (
        <div className="flex items-start justify-between border-b-4 pb-4" style={{ borderColor: accent }}>
          <div className="flex items-start gap-3">
            {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="h-16 w-16 object-contain" />}
            <div>
              <h1 className="text-2xl font-extrabold leading-tight" style={{ color: accent }}>{company?.name}</h1>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-700">{company?.address}</p>
              <p className="mt-1 text-xs text-slate-700">{company?.phone && <>☎ {company.phone}</>}{company?.email && <> · {company.email}</>}</p>
              {gst && <p className="mt-0.5 text-xs font-semibold text-slate-700">GSTIN: {company?.gstin}</p>}
            </div>
          </div>
          <div className="text-xl font-extrabold uppercase tracking-wide" style={{ color: accent }}>{title}</div>
        </div>
      ) : <LetterheadSpacer mm={topMm} />}

      <div className="mt-6 grid grid-cols-2 gap-6">
        <BillTo ctx={ctx} className="border-l-4 pl-3" />
        <MetaCol ctx={ctx} />
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead><ItemHead gst={gst} accent={accent} style="accent" /></thead>
        <tbody><ItemRows ctx={ctx} /></tbody>
      </table>

      <div className="mt-4 flex justify-end"><TotalsColumn ctx={ctx} /></div>
      {isBill && <AmountWords amount={ctx.t.net} />}
      <ModernFooter ctx={ctx} />
      <p className="mt-4 text-center text-[10px] text-slate-600">{settings.invoiceFooter}</p>
      <FooterImage ctx={ctx} />
    </div>
  )
}
function ModernFooter({ ctx }: { ctx: Ctx }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-6 border-t border-slate-300 pt-4 text-xs">
      <PaymentInfo ctx={ctx} />
      <div className="flex items-end justify-end gap-4"><PaymentQr ctx={ctx} /><SignatureBlock ctx={ctx} /></div>
    </div>
  )
}

/* ================================================================== */
/* TEMPLATE 2 — CLASSIC (centered serif, double rules)                 */
/* ================================================================== */
function ClassicTemplate({ ctx }: { ctx: Ctx }) {
  const { company, gst, accent, isBill, title, showHeader, settings, topMm } = ctx
  return (
    <div className="p-9 print:p-2">
      {showHeader ? (
        <div className="text-center">
          {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" />}
          <h1 className="text-2xl font-bold tracking-wide text-slate-900" style={{ letterSpacing: '0.04em' }}>{company?.name}</h1>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-700">{company?.address}</p>
          <p className="mt-0.5 text-xs text-slate-700">{company?.phone && <>☎ {company.phone}</>}{company?.email && <> · {company.email}</>}{gst && <> · GSTIN: {company?.gstin}</>}</p>
          <div className="mx-auto mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-16" style={{ background: accent }} />
            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-800">{title}</span>
            <span className="h-px w-16" style={{ background: accent }} />
          </div>
        </div>
      ) : (
        <>
          <LetterheadSpacer mm={topMm} />
          <div className="mx-auto mb-2 flex items-center justify-center gap-3">
            <span className="h-px w-16" style={{ background: accent }} />
            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-800">{title}</span>
            <span className="h-px w-16" style={{ background: accent }} />
          </div>
        </>
      )}

      <div className="mt-6 flex justify-between border-y-2 py-3 text-sm" style={{ borderColor: accent }}>
        <BillTo ctx={ctx} />
        <MetaCol ctx={ctx} />
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead><ItemHead gst={gst} accent={accent} style="accent" /></thead>
        <tbody><ItemRows ctx={ctx} /></tbody>
      </table>

      <div className="mt-4 flex justify-end"><TotalsColumn ctx={ctx} /></div>
      {isBill && (
        <div className="mt-3 flex items-start justify-between"><AmountWords amount={ctx.t.net} /></div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-slate-300 pt-4 text-xs">
        <PaymentInfo ctx={ctx} />
        <div className="flex items-end justify-end gap-4"><PaymentQr ctx={ctx} /><SignatureBlock ctx={ctx} /></div>
      </div>
      <p className="mt-4 text-center text-[10px] italic text-slate-600">{settings.invoiceFooter}</p>
      <FooterImage ctx={ctx} />
    </div>
  )
}

/* ================================================================== */
/* TEMPLATE 3 — MINIMAL (thin accent edge, big underline total)        */
/* ================================================================== */
function MinimalTemplate({ ctx }: { ctx: Ctx }) {
  const { company, gst, accent, isBill, title, docNo, doc, validUntil, showHeader, settings, topMm } = ctx
  return (
    <div className="border-l-[6px] p-8 print:p-2" style={{ borderColor: accent }}>
      {showHeader ? (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{company?.name}</h1>
            <p className="max-w-xs text-xs text-slate-700">{company?.address}</p>
            <p className="text-xs text-slate-700">{company?.phone}{gst && <> · GSTIN {company?.gstin}</>}</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-600">{title}</p>
              <p className="text-lg font-bold" style={{ color: accent }}>{docNo}</p>
              <p className="text-xs text-slate-700">{formatDate(doc.date)}</p>
            </div>
            {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="h-12 w-12 object-contain" />}
          </div>
        </div>
      ) : (
        <>
          <LetterheadSpacer mm={topMm} />
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-slate-600">{title}</p>
            <p className="text-sm font-bold text-slate-800">{docNo} · {formatDate(doc.date)}</p>
          </div>
        </>
      )}

      <div className="mt-5 flex items-start justify-between text-sm">
        <BillTo ctx={ctx} />
        {isBill && !ctx.simpleBill && <Stamp ctx={ctx} />}
        {validUntil && <p className="text-xs text-slate-700">Valid until {formatDate(validUntil)}</p>}
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead><ItemHead gst={gst} accent={accent} style="dark" /></thead>
        <tbody><ItemRows ctx={ctx} /></tbody>
      </table>

      <div className="mt-4 flex justify-end"><TotalsColumn ctx={ctx} /></div>
      {isBill && <AmountWords amount={ctx.t.net} />}
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-slate-300 pt-4 text-xs">
        <PaymentInfo ctx={ctx} />
        <div className="flex items-end justify-end gap-4"><PaymentQr ctx={ctx} /><SignatureBlock ctx={ctx} /></div>
      </div>
      <p className="mt-4 text-[10px] text-slate-600">{settings.invoiceFooter}</p>
      <FooterImage ctx={ctx} />
    </div>
  )
}

/* ================================================================== */
/* TEMPLATE 4 — ELEGANT (full frame, Playfair serif, centered total)   */
/* ================================================================== */
function ElegantTemplate({ ctx }: { ctx: Ctx }) {
  const { company, gst, accent, isBill, title, showHeader, settings, topMm } = ctx
  return (
    <div className="m-3 border p-6 print:m-1 print:p-4" style={{ borderColor: accent }}>
      {showHeader ? (
        <div className="border-b pb-4 text-center" style={{ borderColor: accent }}>
          {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" />}
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-600">{isBill ? 'Invoice' : 'Quotation'}</p>
          <h1 className="text-3xl font-bold text-slate-900">{company?.name}</h1>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-700">{company?.address}</p>
          <p className="mt-0.5 text-xs text-slate-700">{company?.phone}{company?.email && <> · {company.email}</>}{gst && <> · GSTIN: {company?.gstin}</>}</p>
        </div>
      ) : <LetterheadSpacer mm={topMm} />}

      <div className="mt-4 flex items-center justify-center">
        <span className="text-lg font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>{title}</span>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <BillTo ctx={ctx} />
        <MetaCol ctx={ctx} />
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead><ItemHead gst={gst} accent={accent} style="plain" /></thead>
        <tbody><ItemRows ctx={ctx} /></tbody>
      </table>

      <div className="mt-4 flex items-start justify-between gap-6">
        {isBill ? <AmountWords amount={ctx.t.net} /> : <div />}
        <TotalsColumn ctx={ctx} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 border-t pt-4 text-xs" style={{ borderColor: accent }}>
        <PaymentInfo ctx={ctx} />
        <div className="flex items-end justify-end gap-4"><PaymentQr ctx={ctx} /><SignatureBlock ctx={ctx} /></div>
      </div>
      <p className="mt-3 text-center text-[10px] tracking-wide text-slate-600">{settings.invoiceFooter}</p>
      <FooterImage ctx={ctx} />
    </div>
  )
}

/* ================================================================== */
/* TEMPLATE 5 — BOLD (heavy slab, thick rules, left-bar total)         */
/* ================================================================== */
function BoldTemplate({ ctx }: { ctx: Ctx }) {
  const { company, gst, accent, isBill, title, showHeader, settings, topMm } = ctx
  return (
    <div className="p-8 print:p-2">
      {showHeader ? (
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="h-14 w-14 object-contain" />}
              <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-900">{company?.name}</h1>
            </div>
            <div className="text-2xl font-extrabold uppercase" style={{ color: accent }}>{title}</div>
          </div>
          <div className="mt-2 h-1.5 w-full" style={{ background: accent }} />
          <p className="mt-2 text-xs text-slate-700">{company?.address}{company?.phone && <> · ☎ {company.phone}</>}{gst && <> · GSTIN {company?.gstin}</>}</p>
        </div>
      ) : <LetterheadSpacer mm={topMm} />}

      <div className="mt-5 grid grid-cols-2 gap-6">
        <BillTo ctx={ctx} />
        <MetaCol ctx={ctx} />
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-4" style={{ borderColor: accent }}>
            <th className="px-2 py-2 text-left text-xs font-extrabold uppercase text-slate-900">#</th>
            <th className="px-2 py-2 text-left text-xs font-extrabold uppercase text-slate-900">Description</th>
            {gst && <th className="px-2 py-2 text-left text-xs font-extrabold uppercase text-slate-900">HSN</th>}
            <th className="px-2 py-2 text-right text-xs font-extrabold uppercase text-slate-900">Qty</th>
            <th className="px-2 py-2 text-right text-xs font-extrabold uppercase text-slate-900">Rate</th>
            {gst && <th className="px-2 py-2 text-right text-xs font-extrabold uppercase text-slate-900">GST%</th>}
            <th className="px-2 py-2 text-right text-xs font-extrabold uppercase text-slate-900">Amount</th>
          </tr>
        </thead>
        <tbody><ItemRows ctx={ctx} /></tbody>
      </table>

      <div className="mt-4 flex justify-end"><TotalsColumn ctx={ctx} /></div>
      {isBill && <AmountWords amount={ctx.t.net} />}
      <div className="mt-6 grid grid-cols-2 gap-6 border-t-2 border-slate-800 pt-4 text-xs">
        <PaymentInfo ctx={ctx} />
        <div className="flex items-end justify-end gap-4"><PaymentQr ctx={ctx} /><SignatureBlock ctx={ctx} /></div>
      </div>
      <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600">{settings.invoiceFooter}</p>
      <FooterImage ctx={ctx} />
    </div>
  )
}

/* ================================================================== */
/* TEMPLATE 6 — GRID (bordered GST-style cells)                        */
/* ================================================================== */
function GridTemplate({ ctx }: { ctx: Ctx }) {
  const { company, gst, accent, isBill, title, docNo, doc, validUntil, interState, showHeader, settings, topMm, t } = ctx
  return (
    <div className="p-6 print:p-2">
      {showHeader ? (
        <div className="border-2" style={{ borderColor: accent }}>
          <div className="border-b-2 px-3 py-2 text-center text-sm font-bold uppercase tracking-widest" style={{ borderColor: accent, color: accent }}>{title}</div>
          <div className="grid grid-cols-2">
            <div className="border-r px-3 py-2" style={{ borderColor: accent }}>
              <p className="font-bold text-slate-900">{company?.name}</p>
              <p className="mt-1 text-xs text-slate-700">{company?.address}</p>
              <p className="text-xs text-slate-700">☎ {company?.phone}{gst && <> · GSTIN: {company?.gstin}</>}</p>
            </div>
            <div className="px-3 py-2 text-xs">
              {company?.logoDataUrl && <img src={company.logoDataUrl} alt="" className="ml-auto mb-1 h-10 w-10 object-contain" />}
              <div className="flex justify-between"><span className="text-slate-600">{isBill ? 'Invoice No' : 'Quote No'}</span><span className="font-bold text-slate-900">{docNo}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Date</span><span className="text-slate-800">{formatDate(doc.date)}</span></div>
              {validUntil && <div className="flex justify-between"><span className="text-slate-600">Valid Until</span><span className="text-slate-800">{formatDate(validUntil)}</span></div>}
              {gst && <div className="flex justify-between"><span className="text-slate-600">Supply</span><span className="text-slate-800">{interState ? 'IGST' : 'CGST+SGST'}</span></div>}
              {isBill && !ctx.simpleBill && <div className="mt-1 flex justify-end"><Stamp ctx={ctx} /></div>}
            </div>
          </div>
          <BillTo ctx={ctx} className="border-t px-3 py-2" />
        </div>
      ) : (
        <>
          <LetterheadSpacer mm={topMm} />
          <div className="border px-3 py-2" style={{ borderColor: accent }}><BillTo ctx={ctx} /></div>
        </>
      )}

      <table className="mt-0 w-full border-collapse border-2 text-sm" style={{ borderColor: accent }}>
        <thead>
          <tr className="border-b-2" style={{ borderColor: accent }}>
            <th className="border border-slate-300 px-2 py-1.5 text-left text-xs font-bold uppercase text-slate-800">#</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left text-xs font-bold uppercase text-slate-800">Description</th>
            {gst && <th className="border border-slate-300 px-2 py-1.5 text-left text-xs font-bold uppercase text-slate-800">HSN/SAC</th>}
            <th className="border border-slate-300 px-2 py-1.5 text-right text-xs font-bold uppercase text-slate-800">Qty</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right text-xs font-bold uppercase text-slate-800">Rate</th>
            {gst && <th className="border border-slate-300 px-2 py-1.5 text-right text-xs font-bold uppercase text-slate-800">GST%</th>}
            <th className="border border-slate-300 px-2 py-1.5 text-right text-xs font-bold uppercase text-slate-800">Amount</th>
          </tr>
        </thead>
        <tbody><ItemRows ctx={ctx} grid /></tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-72 border-2 border-t-0 text-sm" style={{ borderColor: accent }}>
          <div className="px-3 py-2"><TotalsRows ctx={ctx} /></div>
          <NetBox ctx={ctx} />
          {isBill && !ctx.simpleBill && (
            <div className="px-3 py-2">
              <TotalRow label="Received" value={formatINR(t.received)} />
              <TotalRow label="Balance Due" value={formatINR(t.balance)} strong />
            </div>
          )}
        </div>
      </div>
      {isBill && <AmountWords amount={t.net} />}
      <div className="mt-4 grid grid-cols-2 gap-6 border p-3 text-xs" style={{ borderColor: accent }}>
        <PaymentInfo ctx={ctx} />
        <div className="flex items-end justify-end gap-4"><PaymentQr ctx={ctx} /><SignatureBlock ctx={ctx} /></div>
      </div>
      <p className="mt-3 text-center text-[10px] text-slate-600">{settings.invoiceFooter}</p>
      <FooterImage ctx={ctx} />
    </div>
  )
}

const TEMPLATES: Record<DocTemplate, FC<{ ctx: Ctx }>> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
  elegant: ElegantTemplate,
  bold: BoldTemplate,
  grid: GridTemplate,
}
