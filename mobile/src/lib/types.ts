// Domain types — ported verbatim from the Magizhini web app (src/lib/types.ts).

export type ID = string

export type Role = 'Admin' | 'Operator'

export type DocTemplate = 'modern' | 'classic' | 'minimal'

export interface User {
  id: ID
  name: string
  email: string
  role: Role
  password: string
  allowedMenus?: string[]
}

export interface Handbook {
  id: ID
  name: string
  bookNo: string
  billsPerBook: number
  startNo: number
  assignedTo?: string
  damagedReceipts?: number[]
}

export interface Company {
  id: ID
  name: string
  address: string
  phone: string
  email?: string
  gstin?: string
  stateCode?: string
  logoDataUrl?: string
  bankDetails?: string
  upiId?: string
  payeeName?: string
  invoicePrefix?: string
  quotePrefix?: string
  accent?: string
  accent2?: string
  template?: DocTemplate
  fontFamily?: string
  terms?: string
  handbooks?: Handbook[]
  isActive: boolean
}

export type CustomerType = 'Regular' | 'One_Time'

export interface Customer {
  id: ID
  name: string
  address: string
  phone: string
  gstin?: string
  notes?: string
}

export interface LineItem {
  id: ID
  description: string
  qty: number
  rate: number
  cost?: number
  hsnSac?: string
  taxRate?: number
}

export type BillType = 'Online' | 'Handbill'

export type PaymentStatus = 'Paid' | 'Partial' | 'Pending'

export interface Payment {
  id: ID
  date: string
  amount: number
  mode?: string
  note?: string
}

export type DocStatus = 'Draft' | 'Finalized'

export interface Bill {
  id: ID
  billNo: number
  companyBillNo: string
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
  gstEnabled?: boolean
  originalCost?: number
  billType?: BillType
  handbookId?: ID
  handBookNo?: string
  handBillNo?: string
  receivedAmount: number
  payments: Payment[]
  docStatus: DocStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted'

export interface Quotation {
  id: ID
  quoteNo: number
  companyQuoteNo: string
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
  gstEnabled?: boolean
  originalCost?: number
  status: QuoteStatus
  validUntil?: string
  convertedBillId?: ID
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Settings {
  currency: string
  dateFormat: string
  defaultTaxRate: number
  fyStartMonth: number
  invoiceFooter: string
  taxRates: number[]
  letterpadBillTopMm?: number
  letterpadQuoteTopMm?: number
  reminderTemplate?: string
}

export interface Database {
  users: User[]
  companies: Company[]
  customers: Customer[]
  bills: Bill[]
  quotations: Quotation[]
  settings: Settings
  counters: {
    billNo: number
    quoteNo: number
    companyBillSeq: Record<string, number>
    companyQuoteSeq: Record<string, number>
  }
}
