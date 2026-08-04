// Supabase persistence. Mirrors the in-memory `Database` used by the store to
// real Postgres tables. The store keeps its synchronous, in-memory model; this
// module loads everything on login and writes changes back (upserts + deletes).

import { createClient } from '@supabase/supabase-js'
import type { Bill, Company, Customer, Database, Quotation, Settings, User } from './types'
import { supabase } from './supabase'
import { seedDatabase } from './db'

function db() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

/* ---------------- mappers (row <-> app object) ---------------- */

function companyToRow(c: Company) {
  return {
    id: c.id, name: c.name, address: c.address, phone: c.phone, email: c.email ?? null,
    gstin: c.gstin ?? null, state_code: c.stateCode ?? null, logo_data_url: c.logoDataUrl ?? null,
    bank_details: c.bankDetails ?? null, upi_id: c.upiId ?? null, payee_name: c.payeeName ?? null,
    signatory_name: c.signatoryName ?? null, signature_data_url: c.signatureDataUrl ?? null,
    invoice_prefix: c.invoicePrefix ?? null, quote_prefix: c.quotePrefix ?? null,
    accent: c.accent ?? null, accent2: c.accent2 ?? null, template: c.template ?? null,
    font_family: c.fontFamily ?? null, terms: c.terms ?? null, handbooks: c.handbooks ?? [],
    default_gst_mode: c.defaultGstMode ?? null, default_bill_type: c.defaultBillType ?? null,
    is_active: c.isActive, updated_at: new Date().toISOString(),
  }
}
function rowToCompany(r: any): Company {
  return {
    id: r.id, name: r.name, address: r.address ?? '', phone: r.phone ?? '', email: r.email ?? undefined,
    gstin: r.gstin ?? undefined, stateCode: r.state_code ?? undefined, logoDataUrl: r.logo_data_url ?? undefined,
    bankDetails: r.bank_details ?? undefined, upiId: r.upi_id ?? undefined, payeeName: r.payee_name ?? undefined,
    signatoryName: r.signatory_name ?? undefined, signatureDataUrl: r.signature_data_url ?? undefined,
    invoicePrefix: r.invoice_prefix ?? undefined, quotePrefix: r.quote_prefix ?? undefined,
    accent: r.accent ?? undefined, accent2: r.accent2 ?? undefined, template: r.template ?? undefined,
    fontFamily: r.font_family ?? undefined, terms: r.terms ?? undefined, handbooks: r.handbooks ?? [],
    defaultGstMode: r.default_gst_mode ?? undefined, defaultBillType: r.default_bill_type ?? undefined,
    isActive: r.is_active ?? true,
  }
}

function customerToRow(c: Customer) {
  return { id: c.id, name: c.name, address: c.address, phone: c.phone, gstin: c.gstin ?? null, notes: c.notes ?? null, updated_at: new Date().toISOString() }
}
function rowToCustomer(r: any): Customer {
  return { id: r.id, name: r.name, address: r.address ?? '', phone: r.phone ?? '', gstin: r.gstin ?? undefined, notes: r.notes ?? undefined }
}

function billToRow(b: Bill) {
  return {
    id: b.id, bill_no: b.billNo, company_bill_no: b.companyBillNo, date: b.date, company_id: b.companyId,
    customer_type: b.customerType, customer_id: b.customerId ?? null, customer_name: b.customerName,
    customer_address: b.customerAddress, customer_phone: b.customerPhone, customer_gstin: b.customerGstin ?? null,
    items: b.items, discount_amount: b.discountAmount, discount_is_percent: b.discountIsPercent ?? false,
    gst_enabled: b.gstEnabled ?? null, gst_inclusive: b.gstInclusive ?? null, original_cost: b.originalCost ?? null, bill_type: b.billType ?? 'Online',
    handbook_id: b.handbookId ?? null, hand_book_no: b.handBookNo ?? null, hand_bill_no: b.handBillNo ?? null,
    received_amount: b.receivedAmount, payments: b.payments, doc_status: b.docStatus,
    created_by: b.createdBy, created_at: b.createdAt, updated_at: b.updatedAt, deleted_at: b.deletedAt ?? null,
  }
}
function rowToBill(r: any): Bill {
  return {
    id: r.id, billNo: r.bill_no, companyBillNo: r.company_bill_no, date: r.date, companyId: r.company_id,
    customerType: r.customer_type, customerId: r.customer_id ?? undefined, customerName: r.customer_name ?? '',
    customerAddress: r.customer_address ?? '', customerPhone: r.customer_phone ?? '', customerGstin: r.customer_gstin ?? undefined,
    items: r.items ?? [], discountAmount: Number(r.discount_amount) || 0, discountIsPercent: r.discount_is_percent ?? false,
    gstEnabled: r.gst_enabled ?? undefined, gstInclusive: r.gst_inclusive ?? undefined, originalCost: r.original_cost ?? undefined, billType: r.bill_type ?? 'Online',
    handbookId: r.handbook_id ?? undefined, handBookNo: r.hand_book_no ?? undefined, handBillNo: r.hand_bill_no ?? undefined,
    receivedAmount: Number(r.received_amount) || 0, payments: r.payments ?? [], docStatus: r.doc_status,
    createdBy: r.created_by ?? '', createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? undefined,
  }
}

function quoteToRow(q: Quotation) {
  return {
    id: q.id, quote_no: q.quoteNo, company_quote_no: q.companyQuoteNo, date: q.date, company_id: q.companyId,
    customer_type: q.customerType, customer_id: q.customerId ?? null, customer_name: q.customerName,
    customer_address: q.customerAddress, customer_phone: q.customerPhone, customer_gstin: q.customerGstin ?? null,
    items: q.items, discount_amount: q.discountAmount, discount_is_percent: q.discountIsPercent ?? false,
    gst_enabled: q.gstEnabled ?? null, gst_inclusive: q.gstInclusive ?? null, original_cost: q.originalCost ?? null,
    status: q.status, valid_until: q.validUntil ?? null, converted_bill_id: q.convertedBillId ?? null,
    created_by: q.createdBy, created_at: q.createdAt, updated_at: q.updatedAt, deleted_at: q.deletedAt ?? null,
  }
}
function rowToQuote(r: any): Quotation {
  return {
    id: r.id, quoteNo: r.quote_no, companyQuoteNo: r.company_quote_no, date: r.date, companyId: r.company_id,
    customerType: r.customer_type, customerId: r.customer_id ?? undefined, customerName: r.customer_name ?? '',
    customerAddress: r.customer_address ?? '', customerPhone: r.customer_phone ?? '', customerGstin: r.customer_gstin ?? undefined,
    items: r.items ?? [], discountAmount: Number(r.discount_amount) || 0, discountIsPercent: r.discount_is_percent ?? false,
    gstEnabled: r.gst_enabled ?? undefined, gstInclusive: r.gst_inclusive ?? undefined, originalCost: r.original_cost ?? undefined,
    status: r.status, validUntil: r.valid_until ?? undefined, convertedBillId: r.converted_bill_id ?? undefined,
    createdBy: r.created_by ?? '', createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? undefined,
  }
}

/* ---------------- profiles (users) ---------------- */

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await db().from('profiles').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, email: r.email, role: r.role, password: '',
    allowedMenus: r.allowed_menus ?? undefined,
  }))
}

export async function updateProfileRole(id: string, role: User['role'], name: string, allowedMenus?: string[]): Promise<void> {
  const { error } = await db().from('profiles').update({ role, name, allowed_menus: allowedMenus ?? null }).eq('id', id)
  if (error) throw error
}

// Create a real login account. Prefers the admin Edge Function (auto-confirms the
// email). If that isn't deployed, falls back to a normal sign-up performed on a
// throwaway client so the current Admin's session is never replaced.
export async function adminCreateUser(input: { name: string; email: string; password: string; role: User['role'] }) {
  const res = await db()
    .functions.invoke('admin-create-user', { body: input })
    .catch((e) => ({ data: null as any, error: e }))

  if (!res.error && !(res.data as any)?.error) return // Edge Function succeeded

  // Fallback: sign the user up via a secondary client (does not touch the admin session).
  await signUpFallback(input)
}

async function signUpFallback(input: { name: string; email: string; password: string; role: User['role'] }) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase is not configured')
  const tmp = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'mgz-signup-tmp' },
  })
  const { error } = await tmp.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name, role: input.role } },
  })
  if (error) throw new Error(error.message)
}

export async function adminDeleteUser(id: string) {
  const { data, error } = await db().functions.invoke('admin-create-user', { body: { action: 'delete', id } })
  if (error) throw new Error(readFnError(error) || 'Could not delete user')
  if ((data as any)?.error) throw new Error((data as any).error)
}

function readFnError(error: unknown): string {
  const ctx = (error as { context?: { status?: number } })?.context
  if (ctx?.status === 404) return 'The admin-create-user function is not deployed yet (see README).'
  return (error as Error)?.message ?? ''
}

/* ---------------- bulk load + first-run seed ---------------- */

export async function fetchAll(): Promise<Omit<Database, 'users'> & { users: User[] }> {
  const s = db()
  const [companies, customers, bills, quotations, settingsRes, countersRes, users] = await Promise.all([
    s.from('companies').select('*'),
    s.from('customers').select('*'),
    s.from('bills').select('*'),
    s.from('quotations').select('*'),
    s.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    s.from('counters').select('*').eq('id', 1).maybeSingle(),
    fetchUsers(),
  ])
  for (const r of [companies, customers, bills, quotations]) if (r.error) throw r.error

  const seed = seedDatabase()
  const settings: Settings = (settingsRes.data?.data as Settings) ?? seed.settings
  const counters = countersRes.data
    ? {
        billNo: countersRes.data.bill_no ?? 0,
        quoteNo: countersRes.data.quote_no ?? 0,
        companyBillSeq: countersRes.data.company_bill_seq ?? {},
        companyQuoteSeq: countersRes.data.company_quote_seq ?? {},
      }
    : { billNo: 0, quoteNo: 0, companyBillSeq: {}, companyQuoteSeq: {} }

  return {
    users,
    companies: (companies.data ?? []).map(rowToCompany),
    customers: (customers.data ?? []).map(rowToCustomer),
    bills: (bills.data ?? []).map(rowToBill),
    quotations: (quotations.data ?? []).map(rowToQuote),
    settings,
    counters,
  }
}

// On a brand-new project (no companies yet) seed the two starter companies,
// settings and counters — but not the sample bills/quotes (real data only).
export async function seedIfEmpty(): Promise<boolean> {
  const s = db()
  const { count, error } = await s.from('companies').select('id', { count: 'exact', head: true })
  if (error) throw error
  if ((count ?? 0) > 0) return false

  const seed = seedDatabase()
  await s.from('companies').upsert(seed.companies.map(companyToRow))
  await s.from('customers').upsert(seed.customers.map(customerToRow))
  await s.from('app_settings').upsert({ id: 1, data: seed.settings })
  await s.from('counters').upsert({ id: 1, bill_no: 0, quote_no: 0, company_bill_seq: {}, company_quote_seq: {} })
  return true
}

/* ---------------- writes ---------------- */

export async function syncAll(data: Database): Promise<void> {
  const s = db()
  const ops: PromiseLike<{ error: unknown }>[] = [
    s.from('companies').upsert(data.companies.map(companyToRow)),
    s.from('customers').upsert(data.customers.map(customerToRow)),
    s.from('app_settings').upsert({ id: 1, data: data.settings }),
    s.from('counters').upsert({
      id: 1, bill_no: data.counters.billNo, quote_no: data.counters.quoteNo,
      company_bill_seq: data.counters.companyBillSeq, company_quote_seq: data.counters.companyQuoteSeq,
    }),
  ]
  if (data.bills.length) ops.push(s.from('bills').upsert(data.bills.map(billToRow)))
  if (data.quotations.length) ops.push(s.from('quotations').upsert(data.quotations.map(quoteToRow)))
  const results = await Promise.all(ops)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

export async function deleteRow(table: 'companies' | 'customers', id: string): Promise<void> {
  const { error } = await db().from(table).delete().eq('id', id)
  if (error) throw error
}
