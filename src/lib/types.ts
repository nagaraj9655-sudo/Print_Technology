// Domain types — derived directly from the NAGARAJ_BILL workbook spec (§4).
// Original Excel header names are preserved in comments for migration fidelity.

export type ID = string

export type Role = 'Admin' | 'Operator'

// Document design template — gives each company a distinct look.
export type DocTemplate = 'modern' | 'classic' | 'minimal'

export interface User {
  id: ID
  name: string
  email: string
  role: Role
  // NOTE: client-side demo auth only. A real deployment hashes passwords server-side.
  password: string
}

export interface Company {
  id: ID
  name: string // Company_Name
  address: string // Company_Address
  phone: string // Company_Phone (string to preserve leading zeros)
  email?: string // Company_Email
  gstin?: string // Company_GST — presence => GST/Tax-Invoice mode (§8)
  stateCode?: string // GST state code, drives intra/inter-state split
  logoDataUrl?: string // optional branded logo (data URL)
  bankDetails?: string // "Pay to" block
  invoicePrefix?: string // e.g. "PT/"
  quotePrefix?: string // e.g. "PT/Q/"
  accent?: string // per-company brand accent color
  accent2?: string // secondary accent for gradients / template detail
  template?: DocTemplate // document layout style (§ per-company design)
  fontFamily?: string // document font, e.g. 'Poppins', 'Libre Baskerville'
  terms?: string // invoice terms & footer
  isActive: boolean
}

export type CustomerType = 'Regular' | 'One_Time'

export interface Customer {
  id: ID
  name: string // Customer_Name
  address: string // Customer_Address
  phone: string // Customer_Phone
  gstin?: string // customer_gstin — recipient GSTIN on B2B invoices
  notes?: string
}

export interface LineItem {
  id: ID
  description: string // Service_Description
  qty: number // Qty
  rate: number // Per_Rate
  hsnSac?: string // hsn_sac (GST only)
  taxRate?: number // per-line GST % (GST only)
  // total is always derived: qty * rate
}

export type PaymentStatus = 'Paid' | 'Partial' | 'Pending'

export interface Payment {
  id: ID
  date: string // ISO date
  amount: number
  mode?: string
  note?: string
}

export type DocStatus = 'Draft' | 'Finalized'

export interface Bill {
  id: ID
  billNo: number // Bill_No — global running number, unique system-wide
  companyBillNo: string // Company_Bill_No — per-company number (prefix + FY + seq)
  date: string // Date (ISO)
  companyId: ID
  customerType: CustomerType // Customer_Type
  customerId?: ID // set when Regular
  customerName: string // snapshot
  customerAddress: string // snapshot
  customerPhone: string // snapshot
  customerGstin?: string // snapshot
  items: LineItem[]
  discountAmount: number // Discount_Amount
  discountIsPercent?: boolean
  receivedAmount: number // Received_Amount (kept in sync with payments)
  payments: Payment[]
  docStatus: DocStatus // Draft locks number only when Finalized
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt?: string // soft-delete / recycle bin
  // derived (computed, never hand-typed): gross, taxable, tax, net, balance, status
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted'

export interface Quotation {
  id: ID
  quoteNo: number // Quote_No — global
  companyQuoteNo: string // Company_Quote_No — per-company
  date: string
  companyId: ID
  customerType: CustomerType
  customerId?: ID
  customerName: string
  customerAddress: string
  customerPhone: string
  customerGstin?: string
  items: LineItem[]
  discountAmount: number
  discountIsPercent?: boolean
  status: QuoteStatus
  validUntil?: string
  convertedBillId?: ID
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Settings {
  currency: string // '₹'
  dateFormat: string // 'dd-MM-yyyy'
  defaultTaxRate: number // %
  fyStartMonth: number // 4 => April (Indian FY)
  invoiceFooter: string
  taxRates: number[] // configurable list of GST rates
}

export interface Database {
  users: User[]
  companies: Company[]
  customers: Customer[]
  bills: Bill[]
  quotations: Quotation[]
  settings: Settings
  counters: {
    billNo: number // global bill counter
    quoteNo: number // global quote counter
    // per-company/per-FY sequences keyed by `${companyId}:${fy}`
    companyBillSeq: Record<string, number>
    companyQuoteSeq: Record<string, number>
  }
}
