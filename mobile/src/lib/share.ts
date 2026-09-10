// Document sharing — PDF generation + WhatsApp / SMS / Email / system share.
//
// PDFs are rendered from an HTML template via expo-print, then handed to the OS
// share sheet (expo-sharing) or attached to an email (expo-mail-composer). Text
// summaries go out over WhatsApp (wa.me / whatsapp://) and SMS.

import { Linking, Platform, Share } from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as MailComposer from 'expo-mail-composer'
import type { Bill, Company, Quotation, Settings } from './types'
import { billTotals, quoteTotals, lineTotal, docUsesGst, recipientInterState, round2 } from './calc'
import { amountInWords, formatDate, formatINR } from './format'
import { normalizePhone } from './payments'

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const money = (n: number) => formatINR(n).replace('₹', 'Rs. ')

interface DocMeta {
  isQuote: boolean
  no: string
  date: string
  validUntil?: string
}

// Shared HTML invoice / quotation template. Kept self-contained (inline CSS) so
// expo-print renders it identically on every device.
export function buildDocHtml(opts: {
  company?: Company
  meta: DocMeta
  customer: { name: string; address?: string; phone?: string; gstin?: string }
  items: Bill['items']
  totals: { gross: number; discount: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number; net: number; received?: number; balance?: number }
  gst: boolean
  interState: boolean
  footer?: string
  simple?: boolean
  taxFormat?: boolean // force the formal GST tax-invoice layout for this document
}): string {
  const { company, meta, customer, items, totals, gst, interState, footer, simple, taxFormat } = opts
  const accent = company?.accent || '#4f46e5'
  const title = meta.isQuote ? 'QUOTATION' : (gst ? 'TAX INVOICE' : 'INVOICE')

  // Formal Tally/Busy-style GST tax invoice (per-line CGST/SGST columns) — chosen
  // per bill (taxFormat) or as the company's default template.
  if (taxFormat || company?.template === 'tax') return buildTaxInvoiceHtml(opts, title, accent)

  const itemRows = items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${esc(it.description)}${it.hsnSac ? `<div class="hsn">HSN/SAC: ${esc(it.hsnSac)}</div>` : ''}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${money(it.rate)}</td>
      ${gst ? `<td style="text-align:center">${it.taxRate ?? 0}%</td>` : ''}
      <td style="text-align:right">${money(lineTotal(it))}</td>
    </tr>`).join('')

  const taxRows = gst
    ? (interState
        ? `<tr><td>IGST</td><td style="text-align:right">${money(totals.igst)}</td></tr>`
        : `<tr><td>CGST</td><td style="text-align:right">${money(totals.cgst)}</td></tr>
           <tr><td>SGST</td><td style="text-align:right">${money(totals.sgst)}</td></tr>`)
    : ''

  const payRows = !meta.isQuote && !simple && totals.received != null
    ? `<tr><td>Received</td><td style="text-align:right">${money(totals.received)}</td></tr>
       <tr class="bal"><td>Balance Due</td><td style="text-align:right">${money(totals.balance ?? 0)}</td></tr>`
    : ''

  const logo = company?.logoDataUrl ? `<img src="${company.logoDataUrl}" style="max-height:56px;max-width:180px;margin-bottom:8px" />` : ''
  const signImg = company?.signatureDataUrl ? `<img src="${company.signatureDataUrl}" style="max-height:52px;max-width:170px;display:block;margin-left:auto" />` : ''
  const footerImg = company?.footerImageDataUrl
    ? `<div style="margin-top:18px;text-align:center"><img src="${company.footerImageDataUrl}" style="${company.footerImageWidthMm ? `width:${company.footerImageWidthMm}mm;` : 'max-width:100%;'}${company.footerImageHeightMm ? `height:${company.footerImageHeightMm}mm;` : ''}" /></div>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px; font-size: 12px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accent}; padding-bottom: 14px; }
    .cname { font-size: 22px; font-weight: 800; color: ${accent}; }
    .cmeta { color: #475569; font-size: 11px; margin-top: 3px; line-height: 1.5; max-width: 320px; }
    .doctitle { text-align: right; }
    .doctitle .t { font-size: 20px; font-weight: 800; letter-spacing: 1px; color: #0f172a; }
    .doctitle .n { color: #475569; margin-top: 4px; font-size: 12px; }
    .parties { display: flex; justify-content: space-between; margin: 18px 0 10px; }
    .box { font-size: 11px; }
    .box .lbl { color: #94a3b8; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; margin-bottom: 3px; }
    .box .v { font-weight: 700; font-size: 13px; }
    .box .m { color: #475569; line-height: 1.5; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { background: ${accent}; color: #fff; font-size: 10px; text-transform: uppercase; padding: 8px 6px; text-align: left; }
    table.items td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; vertical-align: top; }
    .hsn { color: #94a3b8; font-size: 9.5px; margin-top: 2px; }
    .totals { width: 46%; margin-left: auto; margin-top: 12px; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 5px 4px; font-size: 12px; }
    .totals tr.net td { border-top: 2px solid ${accent}; border-bottom: 2px solid ${accent}; font-weight: 800; font-size: 14px; color: ${accent}; }
    .totals tr.bal td { color: #b91c1c; font-weight: 800; }
    .words { margin-top: 14px; font-style: italic; color: #475569; font-size: 11px; }
    .foot { margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 10px; color: #64748b; font-size: 10.5px; line-height: 1.6; white-space: pre-line; }
    .pay { margin-top: 10px; font-size: 11px; color: #0f172a; }
    .sign { margin-top: 40px; text-align: right; font-size: 11px; color: #475569; }
  </style></head><body>
    <div class="head">
      <div>
        ${logo}
        <div class="cname">${esc(company?.name ?? 'Company')}</div>
        <div class="cmeta">${esc(company?.address ?? '')}${company?.phone ? `<br/>Phone: ${esc(company.phone)}` : ''}${company?.email ? ` · ${esc(company.email)}` : ''}${company?.gstin ? `<br/>GSTIN: ${esc(company.gstin)}` : ''}</div>
      </div>
      <div class="doctitle">
        <div class="t">${title}</div>
        <div class="n">No: <b>${esc(meta.no)}</b><br/>Date: ${esc(formatDate(meta.date))}${meta.validUntil ? `<br/>Valid until: ${esc(formatDate(meta.validUntil))}` : ''}</div>
      </div>
    </div>

    <div class="parties">
      <div class="box">
        <div class="lbl">${meta.isQuote ? 'Quotation For' : 'Bill To'}</div>
        <div class="v">${esc(customer.name || '—')}</div>
        <div class="m">${esc(customer.address ?? '')}${customer.phone ? `<br/>${esc(customer.phone)}` : ''}${customer.gstin ? `<br/>GSTIN: ${esc(customer.gstin)}` : ''}</div>
      </div>
    </div>

    <table class="items">
      <thead><tr>
        <th style="width:6%;text-align:center">#</th>
        <th>Description</th>
        <th style="width:9%;text-align:center">Qty</th>
        <th style="width:16%;text-align:right">Rate</th>
        ${gst ? '<th style="width:9%;text-align:center">GST</th>' : ''}
        <th style="width:18%;text-align:right">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals"><table>
      <tr><td>Subtotal</td><td style="text-align:right">${money(totals.gross)}</td></tr>
      ${totals.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- ${money(totals.discount)}</td></tr>` : ''}
      ${gst ? `<tr><td>Taxable</td><td style="text-align:right">${money(totals.taxable)}</td></tr>` : ''}
      ${taxRows}
      <tr class="net"><td>${meta.isQuote ? 'Total' : 'Net Total'}</td><td style="text-align:right">${money(totals.net)}</td></tr>
      ${payRows}
    </table></div>

    <div class="words">${esc(amountInWords(totals.net))}</div>
    ${company?.upiId ? `<div class="pay"><b>Pay via UPI:</b> ${esc(company.upiId)}${company.payeeName ? ` (${esc(company.payeeName)})` : ''}</div>` : ''}
    ${company?.bankDetails ? `<div class="pay"><b>Bank:</b> ${esc(company.bankDetails)}</div>` : ''}
    ${footer || company?.terms ? `<div class="foot">${esc(footer || company?.terms || '')}</div>` : ''}
    <div class="sign">For ${esc(company?.name ?? '')}${signImg || '<br/><br/>'}${company?.signatoryName ? `<div style="font-weight:700;color:#0f172a">${esc(company.signatoryName)}</div>` : ''}<div>Authorised Signatory</div></div>
    ${footerImg}
  </body></html>`
}

// ---- Tax Invoice (GST tabular) HTML — per-line CGST/SGST split ----
function buildTaxInvoiceHtml(
  opts: Parameters<typeof buildDocHtml>[0],
  title: string,
  accent: string,
): string {
  const { company, meta, customer, items, totals, gst, interState, footer } = opts
  const gross = items.reduce((s, it) => s + lineTotal(it), 0)
  const ratio = gross > 0 ? totals.discount / gross : 0
  // Inclusive detection: taxable materially below (gross − discount) ⇒ tax was backed out.
  const inclusive = gst && totals.taxable < round2(gross - totals.discount) - 0.01

  const line = items.map((it, i) => {
    const rate = it.taxRate ?? 0
    const lt = lineTotal(it)
    let taxable: number
    let tax: number
    if (!gst) { taxable = round2(lt * (1 - ratio)); tax = 0 }
    else if (inclusive) {
      const incl = round2(lt * (1 - ratio))
      taxable = round2(incl / (1 + rate / 100))
      tax = round2(incl - taxable)
    } else {
      taxable = round2(lt * (1 - ratio))
      tax = round2((taxable * rate) / 100)
    }
    const cgst = interState ? 0 : round2(tax / 2)
    const sgst = interState ? 0 : round2(tax - cgst)
    const igst = interState ? tax : 0
    // Inclusive pricing: show ex-GST unit rate so Qty × Rate = Taxable Value on the invoice.
    const displayRate = gst && inclusive && it.qty ? round2(taxable / it.qty) : it.rate
    return `<tr>
      <td class="c">${i + 1}</td>
      <td class="l">${esc(it.description)}</td>
      ${gst ? `<td class="c">${esc(it.hsnSac || '—')}</td>` : ''}
      <td class="r">${it.qty}</td>
      <td class="c">nos</td>
      <td class="r">${money(displayRate)}</td>
      <td class="r b">${money(gst ? taxable : lt)}</td>
      ${gst && !interState ? `<td class="r">${rate / 2}%</td><td class="r">${money(cgst)}</td><td class="r">${rate / 2}%</td><td class="r">${money(sgst)}</td>` : ''}
      ${gst && interState ? `<td class="r">${rate}%</td><td class="r">${money(igst)}</td>` : ''}
    </tr>`
  }).join('')

  // Blank filler rows — keep the ruled table a fixed minimum height (10 rows), like a printed tax-invoice book.
  const bodyCols = gst ? (interState ? 9 : 11) : 6
  const fillerRows = Array.from({ length: Math.max(0, 10 - items.length) })
    .map(() => `<tr>${'<td>&nbsp;</td>'.repeat(bodyCols)}</tr>`)
    .join('')

  const grand = Math.round(totals.net)
  const roundoff = round2(grand - totals.net)
  const totalQty = items.reduce((s, it) => s + (it.qty || 0), 0)
  const cols = interState ? 9 : 11
  const taxHead = gst
    ? (!interState
        ? `<th class="c" colspan="2">CGST</th><th class="c" colspan="2">SGST</th>`
        : `<th class="c" colspan="2">IGST</th>`)
    : ''
  const taxSubHead = gst
    ? (!interState
        ? `<th class="r">Rate</th><th class="r">Amt</th><th class="r">Rate</th><th class="r">Amt</th>`
        : `<th class="r">Rate</th><th class="r">Amt</th>`)
    : ''
  const subCells = gst
    ? (!interState
        ? `<td></td><td class="r b">${money(totals.cgst)}</td><td></td><td class="r b">${money(totals.sgst)}</td>`
        : `<td></td><td class="r b">${money(totals.igst)}</td>`)
    : ''

  const logo = company?.logoDataUrl ? `<img src="${company.logoDataUrl}" style="max-height:44px;max-width:150px;margin-bottom:4px" />` : ''
  const signImg = company?.signatureDataUrl ? `<img src="${company.signatureDataUrl}" style="max-height:44px;max-width:150px;display:block;margin-left:auto" />` : ''
  const footerImg = company?.footerImageDataUrl
    ? `<div style="margin-top:12px;text-align:center"><img src="${company.footerImageDataUrl}" style="${company.footerImageWidthMm ? `width:${company.footerImageWidthMm}mm;` : 'max-width:100%;'}${company.footerImageHeightMm ? `height:${company.footerImageHeightMm}mm;` : ''}" /></div>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 18px; font-size: 10.5px; }
    .title { text-align: center; font-size: 14px; font-weight: 800; letter-spacing: 4px; color: ${accent}; text-transform: uppercase; }
    .frame { border: 1px solid #475569; margin-top: 4px; }
    .frame .split { display: flex; }
    .frame .split > div { flex: 1; padding: 7px; }
    .frame .split > div:first-child { border-right: 1px solid #475569; }
    .cname { font-size: 13px; font-weight: 800; }
    .muted { color: #475569; line-height: 1.45; white-space: pre-line; }
    .meta div { display: flex; justify-content: space-between; padding: 1px 0; }
    .meta .k { color: #64748b; }
    .buyer { border-top: 1px solid #475569; padding: 7px; }
    .lbl { color: #94a3b8; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.5px; }
    table.items { width: 100%; border-collapse: collapse; }
    table.items th, table.items td { border: 1px solid #475569; padding: 3px 4px; font-size: 9.5px; }
    table.items th { color: ${accent}; text-transform: uppercase; font-size: 8.5px; }
    table.items td.r, table.items th.r { text-align: right; }
    table.items td.c, table.items th.c { text-align: center; }
    table.items td.l { text-align: left; }
    table.items td.b { font-weight: 700; }
    table.sum { width: 100%; border-collapse: collapse; }
    table.sum td { border: 1px solid #475569; border-top: 0; padding: 3px 6px; }
    .grand td { font-weight: 800; font-size: 12px; color: ${accent}; }
    .words { border: 1px solid #475569; border-top: 0; padding: 5px 6px; }
    .foot { display: flex; border: 1px solid #475569; border-top: 0; }
    .foot > div { flex: 1; padding: 7px; }
    .foot > div:first-child { border-right: 1px solid #475569; }
    .sign { text-align: right; margin-top: 26px; }
    .gen { text-align: center; color: #64748b; font-size: 8.5px; margin-top: 4px; }
  </style></head><body>
    <div class="title">${title}</div>
    <div class="frame">
      <div class="split">
        <div>
          ${logo}
          <div class="cname">${esc(company?.name ?? 'Company')}</div>
          <div class="muted">${esc(company?.address ?? '')}</div>
          ${company?.gstin ? `<div><span class="k">GSTIN/UIN:</span> <b>${esc(company.gstin)}</b></div>` : ''}
          ${company?.email ? `<div><span class="k">E-mail:</span> ${esc(company.email)}</div>` : ''}
          ${company?.phone ? `<div><span class="k">Cell:</span> ${esc(company.phone)}</div>` : ''}
        </div>
        <div class="meta">
          <div><span class="k">${meta.isQuote ? 'Quote No.' : 'Invoice No.'}</span><b>${esc(meta.no)}</b></div>
          <div><span class="k">Date</span><span>${esc(formatDate(meta.date))}</span></div>
          ${meta.validUntil ? `<div><span class="k">Valid Until</span><span>${esc(formatDate(meta.validUntil))}</span></div>` : ''}
          ${gst ? `<div><span class="k">Supply</span><span>${interState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</span></div>` : ''}
        </div>
      </div>
      <div class="buyer">
        <div class="lbl">Buyer (Bill To)</div>
        <div class="cname">${esc(customer.name || '—')}</div>
        <div class="muted">${esc(customer.address ?? '')}${customer.phone ? `\n☎ ${esc(customer.phone)}` : ''}</div>
        ${customer.gstin ? `<div><span class="k">GSTIN/UIN:</span> <b>${esc(customer.gstin)}</b></div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c" rowspan="2">S.No</th>
          <th class="l" rowspan="2">Description of Goods</th>
          ${gst ? '<th class="c" rowspan="2">HSN/SAC</th>' : ''}
          <th class="r" rowspan="2">Qty</th>
          <th class="c" rowspan="2">per</th>
          <th class="r" rowspan="2">Rate</th>
          <th class="r" rowspan="2">${gst ? 'Taxable Value' : 'Amount'}</th>
          ${taxHead}
        </tr>
        ${gst ? `<tr>${taxSubHead}</tr>` : ''}
      </thead>
      <tbody>
        ${line}
        ${fillerRows}
        <tr class="b">
          <td class="l" colspan="${gst ? 3 : 2}"><b>Subtotal</b></td>
          <td class="r"><b>${totalQty}</b></td>
          <td class="c"></td>
          <td class="r"></td>
          <td class="r b">${money(gst ? totals.taxable : totals.gross)}</td>
          ${subCells}
        </tr>
      </tbody>
    </table>

    <table class="sum">
      ${totals.discount > 0 ? `<tr><td class="r" colspan="${cols - 1}">Discount</td><td class="r">- ${money(totals.discount)}</td></tr>` : ''}
      ${gst ? `<tr><td class="r" colspan="${cols - 1}"><b>Total Tax Amount</b></td><td class="r"><b>${money(totals.tax)}</b></td></tr>` : ''}
      ${roundoff !== 0 ? `<tr><td class="r" colspan="${cols - 1}">Round Off</td><td class="r">${money(roundoff)}</td></tr>` : ''}
      <tr class="grand"><td class="r" colspan="${cols - 1}">Grand Total</td><td class="r">${money(grand)}</td></tr>
    </table>

    <div class="words"><span class="k">Amount Chargeable (in words):</span> <b>${esc(amountInWords(grand))}</b></div>

    <div class="foot">
      <div>
        ${company?.bankDetails ? `<div><b>Bank Details</b><br/><span class="muted">${esc(company.bankDetails)}</span></div>` : ''}
        ${company?.upiId ? `<div style="margin-top:4px">UPI: ${esc(company.upiId)}</div>` : ''}
        <div style="margin-top:6px"><b>Declaration</b><br/><span class="muted">${esc(footer || company?.terms || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.')}</span></div>
      </div>
      <div>
        <div class="sign">For ${esc(company?.name ?? '')}${signImg || '<br/><br/>'}${company?.signatoryName ? `<div style="font-weight:700">${esc(company.signatoryName)}</div>` : ''}<div>Authorised Signatory</div></div>
      </div>
    </div>
    <div class="gen">This is a Computer Generated Invoice.</div>
    ${footerImg}
  </body></html>`
}

export function billHtml(bill: Bill, company: Company | undefined, settings?: Settings): string {
  const t = billTotals(bill, company)
  const gst = docUsesGst(company, bill.gstEnabled)
  return buildDocHtml({
    company,
    meta: { isQuote: false, no: bill.companyBillNo, date: bill.date },
    customer: { name: bill.customerName, address: bill.customerAddress, phone: bill.customerPhone, gstin: bill.customerGstin },
    items: bill.items,
    totals: { ...t, received: t.received, balance: t.balance },
    gst,
    interState: recipientInterState(company, bill.customerGstin),
    footer: settings?.invoiceFooter,
    simple: bill.simpleBill,
    taxFormat: bill.taxInvoice,
  })
}

export function quoteHtml(quote: Quotation, company: Company | undefined, settings?: Settings): string {
  const t = quoteTotals(quote, company)
  const gst = docUsesGst(company, quote.gstEnabled)
  return buildDocHtml({
    company,
    meta: { isQuote: true, no: quote.companyQuoteNo, date: quote.date, validUntil: quote.validUntil },
    customer: { name: quote.customerName, address: quote.customerAddress, phone: quote.customerPhone, gstin: quote.customerGstin },
    items: quote.items,
    totals: t,
    gst,
    interState: recipientInterState(company, quote.customerGstin),
    footer: settings?.invoiceFooter,
  })
}

/** Render the HTML to a PDF file and return its local uri. */
export async function makePdf(html: string, _fileName?: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  return uri
}

/**
 * Web-only PDF path. expo-print's printToFileAsync/printAsync on web operate on
 * the *current* document (they'd print the app screen with the share sheet, not
 * the invoice), so instead we open the rendered doc HTML in its own window and
 * let the browser's print dialog "Save as PDF" it. Returns false if the popup
 * was blocked. Native uses makePdf + expo-print, which render the HTML directly.
 */
export function webPrintDoc(html: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const w = window.open('', '_blank', 'width=820,height=1040')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  const fire = () => { try { w.focus(); w.print() } catch {} }
  // Logo/signature are inline data URLs (no network), but give layout a beat.
  if (w.document.readyState === 'complete') setTimeout(fire, 300)
  else w.onload = () => setTimeout(fire, 300)
  return true
}

/** Open the OS share sheet for a PDF (user can pick WhatsApp, Drive, etc.). */
export async function sharePdf(uri: string, dialogTitle = 'Share document'): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' })
  return true
}

/** Email the document with the PDF attached (falls back to no-attachment). */
export async function emailPdf(opts: { to?: string; subject: string; body: string; uri?: string }): Promise<'sent' | 'unavailable' | 'cancelled'> {
  const available = await MailComposer.isAvailableAsync().catch(() => false)
  if (!available) return 'unavailable'
  const res = await MailComposer.composeAsync({
    recipients: opts.to ? [opts.to] : undefined,
    subject: opts.subject,
    body: opts.body,
    attachments: opts.uri ? [opts.uri] : undefined,
  })
  return res.status === 'sent' ? 'sent' : 'cancelled'
}

/** Open a WhatsApp chat with prefilled text. Uses the buyer's number when given. */
export async function openWhatsApp(phone: string | undefined, text: string): Promise<boolean> {
  const num = phone ? normalizePhone(phone) : ''
  // Prefer the native whatsapp:// scheme (works when WhatsApp is installed).
  // On Android 11+ the scheme query is now declared in AndroidManifest so
  // canOpenURL will correctly return true when WhatsApp is present.
  const nativeUrl = num
    ? `whatsapp://send?phone=${num}&text=${encodeURIComponent(text)}`
    : `whatsapp://send?text=${encodeURIComponent(text)}`
  const webUrl = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`
  try {
    if (await Linking.canOpenURL(nativeUrl)) {
      await Linking.openURL(nativeUrl)
      return true
    }
    // Fallback: use the wa.me web URL which Android will still route to WhatsApp
    // if installed, or open in the browser as a fallback.
    await Linking.openURL(webUrl)
    return true
  } catch {
    try { await Linking.openURL(webUrl); return true } catch { return false }
  }
}

export async function openSms(phone: string | undefined, text: string): Promise<boolean> {
  const p = (phone || '').replace(/[^\d+]/g, '')
  const sep = Platform.OS === 'ios' ? '&' : '?'
  const url = `sms:${p}${sep}body=${encodeURIComponent(text)}`
  try { await Linking.openURL(url); return true } catch { return false }
}

/** Plain-text summary used for WhatsApp / SMS bodies. */
export function docSummary(opts: { companyName?: string; isQuote: boolean; no: string; date: string; net: number; balance?: number }): string {
  const kind = opts.isQuote ? 'Quotation' : 'Invoice'
  const lines = [
    `${opts.companyName ?? ''}`.trim(),
    `${kind}: ${opts.no}`,
    `Date: ${formatDate(opts.date)}`,
    `Amount: ${formatINR(opts.net)}`,
  ]
  if (!opts.isQuote && opts.balance != null && opts.balance > 0.001) lines.push(`Balance due: ${formatINR(opts.balance)}`)
  lines.push('', 'Please find the attached document. Thank you!')
  return lines.filter(Boolean).join('\n')
}

export { Share }
