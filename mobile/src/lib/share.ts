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
import { billTotals, quoteTotals, lineTotal, docUsesGst, recipientInterState } from './calc'
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
}): string {
  const { company, meta, customer, items, totals, gst, interState, footer, simple } = opts
  const accent = company?.accent || '#4f46e5'
  const title = meta.isQuote ? 'QUOTATION' : (gst ? 'TAX INVOICE' : 'INVOICE')

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
  const url = num
    ? `whatsapp://send?phone=${num}&text=${encodeURIComponent(text)}`
    : `whatsapp://send?text=${encodeURIComponent(text)}`
  const web = num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
  try {
    if (await Linking.canOpenURL(url)) { await Linking.openURL(url); return true }
    await Linking.openURL(web); return true
  } catch {
    try { await Linking.openURL(web); return true } catch { return false }
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
