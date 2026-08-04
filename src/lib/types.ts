// Domain types — derived directly from the NAGARAJ_BILL workbook spec (§4).
// Original Excel header names are preserved in comments for migration fidelity.

export type ID = string

export type Role = 'Admin' | 'Operator'

// Document design template — gives each company a distinct look.
// Six visually distinct layouts (font, header, lines, status stamp, net box all differ).
export type DocTemplate = 'modern' | 'classic' | 'minimal' | 'elegant' | 'bold' | 'grid'

export interface User {
  id: ID
  name: string
  email: string
  role: Role
  // NOTE: client-side demo auth only. A real deployment hashes passwords server-side.
  password: string
  // Menu keys an Operator may access (undefined = full access). Admins ignore this.
  allowedMenus?: string[]
}

// A physical manual bill book: pre-printed, serially numbered receipts a worker
// carries. Bills issued from it are recorded as "Handbill" bills.
export interface Handbook {
  id: ID
  name: string // e.g. "Counter book" or the worker's name
  bookNo: string // book number printed on the cover
  billsPerBook: number // how many receipts the book holds (total receipts)
  startNo: number // first receipt number (usually 1)
  assignedTo?: string // worker this book belongs to
  damagedReceipts?: number[] // spoiled/void receipt numbers to skip
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
  upiId?: string // UPI / VPA for GPay / PhonePe (drives payment QR + reminders)
  payeeName?: string // name shown in the UPI app (defaults to company name)
  signatoryName?: string // printed under the signature line
  signatureDataUrl?: string // uploaded digital signature image (data URL)
  invoicePrefix?: string // e.g. "PT/"
  quotePrefix?: string // e.g. "PT/Q/"
  accent?: string // per-company brand accent color
  accent2?: string // secondary accent for gradients / template detail
  template?: DocTemplate // document layout style (§ per-company design)
  fontFamily?: string // document font, e.g. 'Poppins', 'Libre Baskerville'
  terms?: string // invoice terms & footer
  handbooks?: Handbook[] // manual bill books configured for this company
  defaultGstMode?: GstMode // default tax mode preselected when billing this company
  defaultBillType?: BillType // default Online / Handbill preselected for this company
  isActive: boolean
}

// Tax mode chosen per document (default configurable per company).
export type GstMode = 'inclusive' | 'exclusive' | 'none'

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
  rate: number // Per_Rate (selling rate, printed)
  cost?: number // Original/cost price per unit — NEVER printed; profit report only
  hsnSac?: string // hsn_sac (GST only)
  taxRate?: number // per-line GST % (GST only)
  // total is always derived: qty * rate
}

export type BillType = 'Online' | 'Handbill'

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
  gstEnabled?: boolean // per-document GST switch (only applies if company is GST-registered)
  gstInclusive?: boolean // when GST on: true = entered rates already include GST (extract it)
  originalCost?: number // whole-document manual cost — NEVER printed; profit report only
  billType?: BillType // Online (system-numbered) | Handbill (manual paper book)
  handbookId?: ID // which manual book (Handbill)
  handBookNo?: string // editable book number on the receipt (Handbill)
  handBillNo?: string // editable receipt/bill number within the book (Handbill)
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
  gstEnabled?: boolean // per-document GST switch (only applies if company is GST-registered)
  gstInclusive?: boolean // when GST on: true = entered rates already include GST (extract it)
  originalCost?: number // whole-document manual cost — NEVER printed; profit report only
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
  letterpadBillTopMm?: number // top space (mm) before content in letter-pad bill mode
  letterpadQuoteTopMm?: number // top space (mm) before content in letter-pad quote mode
  reminderTemplate?: string // optional custom reminder message intro
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
