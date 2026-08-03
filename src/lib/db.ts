// Persistence layer — the single seam between the app and its storage.
// Today it reads/writes localStorage. To move to a real backend later, replace
// the body of load()/save() with API calls; the rest of the app is untouched.

import type { Database } from './types'
import { PRINT_TECHNOLOGY_LOGO, SHRAVAN_INFOTECH_LOGO } from './logos'

const STORAGE_KEY = 'magizhini.db.v5'

export function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2, 11)
}

// An empty database with sane defaults — used as the initial state in Supabase
// mode before the cloud data has loaded.
export function emptyDatabase(): Database {
  return {
    users: [],
    companies: [],
    customers: [],
    bills: [],
    quotations: [],
    settings: {
      currency: '₹',
      dateFormat: 'dd-MM-yyyy',
      defaultTaxRate: 18,
      fyStartMonth: 4,
      invoiceFooter: 'This is a computer-generated document.',
      taxRates: [0, 5, 12, 18, 28],
      letterpadBillTopMm: 40,
      letterpadQuoteTopMm: 40,
    },
    counters: { billNo: 0, quoteNo: 0, companyBillSeq: {}, companyQuoteSeq: {} },
  }
}

export function seedDatabase(): Database {
  const now = new Date().toISOString()
  const ptId = uid()
  const siId = uid()
  const adminId = uid()

  const db: Database = {
    users: [
      { id: adminId, name: 'Nagaraj', email: 'admin@magizhini.app', role: 'Admin', password: 'admin123' },
      { id: uid(), name: 'Operator', email: 'operator@magizhini.app', role: 'Operator', password: 'operator123' },
    ],
    companies: [
      {
        id: ptId,
        name: 'Print Technology',
        address: '12, Industrial Estate, SIDCO Road, Coimbatore, Tamil Nadu 641021',
        phone: '9876543210',
        email: 'accounts@printtechnology.in',
        gstin: '33ABCDE1234F1Z5',
        stateCode: '33',
        logoDataUrl: PRINT_TECHNOLOGY_LOGO,
        bankDetails: 'A/c: Print Technology · A/c No: 003411100004567 · IFSC: HDFC0000341',
        upiId: 'printtech@hdfcbank',
        payeeName: 'Print Technology',
        invoicePrefix: 'PT/',
        quotePrefix: 'PT/',
        accent: '#2563eb',
        accent2: '#7c3aed',
        template: 'modern',
        fontFamily: 'Poppins',
        terms: 'Payment due within 15 days. Goods once sold will not be taken back.',
        handbooks: [
          { id: uid(), name: 'Counter Book', bookNo: '1', billsPerBook: 50, startNo: 1, assignedTo: 'Front desk' },
          { id: uid(), name: 'Field Book', bookNo: '2', billsPerBook: 50, startNo: 1, assignedTo: 'Ravi (delivery)' },
        ],
        isActive: true,
      },
      {
        id: siId,
        name: 'Shravan Infotech',
        address: '4/210, Gandhi Nagar, Trichy Road, Coimbatore, Tamil Nadu 641045',
        phone: '9843012345',
        email: 'hello@shravaninfotech.in',
        gstin: '', // no GST registration -> plain invoice, no tax (§8)
        stateCode: '33',
        logoDataUrl: SHRAVAN_INFOTECH_LOGO,
        bankDetails: 'A/c: Shravan Infotech',
        upiId: 'shravan@okicici',
        payeeName: 'Shravan Infotech',
        invoicePrefix: 'SI/',
        quotePrefix: 'SI/',
        accent: '#0d9488',
        accent2: '#0284c7',
        template: 'classic',
        fontFamily: 'Libre Baskerville',
        terms: 'Thank you for your business.',
        isActive: true,
      },
    ],
    customers: [
      {
        id: uid(),
        name: 'Anand Enterprises',
        address: '55 RS Puram, Coimbatore 641002',
        phone: '9791234567',
        gstin: '33AAACA1111A1Z2',
        notes: 'Regular monthly printing orders',
      },
      {
        id: uid(),
        name: 'Meera Textiles',
        address: 'Avinashi Road, Tirupur 641603',
        phone: '9865412300',
        gstin: '33AABCM2222B1Z8',
      },
      {
        id: uid(),
        name: 'Kumar Traders',
        address: 'Town Hall, Coimbatore 641001',
        phone: '9600011122',
      },
    ],
    bills: [],
    quotations: [],
    settings: {
      currency: '₹',
      dateFormat: 'dd-MM-yyyy',
      defaultTaxRate: 18,
      fyStartMonth: 4,
      invoiceFooter: 'This is a computer-generated document.',
      taxRates: [0, 5, 12, 18, 28],
      letterpadBillTopMm: 40,
      letterpadQuoteTopMm: 40,
    },
    counters: {
      billNo: 0,
      quoteNo: 0,
      companyBillSeq: {},
      companyQuoteSeq: {},
    },
  }

  return withSampleDocuments(db, ptId, siId, adminId, now)
}

// A few realistic bills & quotations so the dashboard/reports aren't empty on first run.
function withSampleDocuments(db: Database, ptId: string, siId: string, _adminId: string, now: string): Database {
  const cust = db.customers
  const mk = (i: number) => `2025-0${i}` // helper unused placeholder
  void mk

  const sampleBills = [
    { companyId: ptId, date: '2025-04-08', cust: 0, items: [['Flex Banner Printing (6x4 ft)', 8, 450, '4911', 18], ['Vinyl Sticker', 20, 60, '3919', 18]], discount: 200, received: 4500 },
    { companyId: ptId, date: '2025-05-15', cust: 1, items: [['Brochure Design & Print (A4)', 500, 12, '4901', 18]], discount: 0, received: 0 },
    { companyId: ptId, date: '2025-06-02', cust: 2, items: [['Visiting Cards (Box of 100)', 10, 150, '4909', 18], ['Letterhead Printing', 200, 8, '4909', 18]], discount: 100, received: 1500 },
    { companyId: siId, date: '2025-05-20', cust: 0, items: [['Website Development (Static)', 1, 18000, '', 0], ['Domain + Hosting (1 yr)', 1, 3500, '', 0]], discount: 1000, received: 20500 },
    { companyId: siId, date: '2025-06-25', cust: 2, items: [['Annual Maintenance Contract', 1, 12000, '', 0]], discount: 0, received: 6000 },
    { companyId: ptId, date: '2025-06-28', cust: 1, items: [['Poster Printing (A2)', 50, 45, '4911', 18]], discount: 0, received: 0 },
  ]

  let billNo = 0
  const fySeq: Record<string, number> = {}
  for (const s of sampleBills) {
    billNo++
    const fy = '2025-26'
    const key = `${s.companyId}:${fy}`
    fySeq[key] = (fySeq[key] || 0) + 1
    const company = db.companies.find((c) => c.id === s.companyId)!
    const c = cust[s.cust]
    db.bills.push({
      id: uid(),
      billNo,
      companyBillNo: `${company.invoicePrefix}${fy}/${String(fySeq[key]).padStart(3, '0')}`,
      date: s.date,
      companyId: s.companyId,
      customerType: 'Regular',
      customerId: c.id,
      customerName: c.name,
      customerAddress: c.address,
      customerPhone: c.phone,
      customerGstin: c.gstin,
      items: s.items.map((it) => ({
        id: uid(),
        description: it[0] as string,
        qty: it[1] as number,
        rate: it[2] as number,
        hsnSac: (it[3] as string) || undefined,
        taxRate: it[4] as number,
      })),
      discountAmount: s.discount,
      receivedAmount: s.received,
      payments: s.received > 0 ? [{ id: uid(), date: s.date, amount: s.received, mode: 'UPI' }] : [],
      docStatus: 'Finalized',
      createdBy: 'Nagaraj',
      createdAt: now,
      updatedAt: now,
    })
  }
  db.counters.billNo = billNo
  db.counters.companyBillSeq = fySeq

  // A couple of quotations
  const qSeq: Record<string, number> = {}
  const sampleQuotes = [
    { companyId: ptId, date: '2025-06-10', cust: 0, items: [['Exhibition Standee (Roll-up)', 4, 1200, '4911', 18]], discount: 0, status: 'Sent' as const, valid: '2025-07-10' },
    { companyId: siId, date: '2025-06-18', cust: 1, items: [['E-commerce Website', 1, 65000, '', 0], ['Payment Gateway Integration', 1, 8000, '', 0]], discount: 3000, status: 'Accepted' as const, valid: '2025-07-31' },
  ]
  let quoteNo = 0
  for (const q of sampleQuotes) {
    quoteNo++
    const fy = '2025-26'
    const key = `${q.companyId}:${fy}`
    qSeq[key] = (qSeq[key] || 0) + 1
    const company = db.companies.find((c) => c.id === q.companyId)!
    const c = cust[q.cust]
    db.quotations.push({
      id: uid(),
      quoteNo,
      companyQuoteNo: `${company.quotePrefix}Q/${fy}/${String(qSeq[key]).padStart(3, '0')}`,
      date: q.date,
      companyId: q.companyId,
      customerType: 'Regular',
      customerId: c.id,
      customerName: c.name,
      customerAddress: c.address,
      customerPhone: c.phone,
      customerGstin: c.gstin,
      items: q.items.map((it) => ({
        id: uid(),
        description: it[0] as string,
        qty: it[1] as number,
        rate: it[2] as number,
        hsnSac: (it[3] as string) || undefined,
        taxRate: it[4] as number,
      })),
      discountAmount: q.discount,
      status: q.status,
      validUntil: q.valid,
      createdBy: 'Nagaraj',
      createdAt: now,
      updatedAt: now,
    })
  }
  db.counters.quoteNo = quoteNo
  db.counters.companyQuoteSeq = qSeq

  return db
}

export function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = seedDatabase()
      save(seeded)
      return seeded
    }
    return JSON.parse(raw) as Database
  } catch {
    const seeded = seedDatabase()
    save(seeded)
    return seeded
  }
}

export function save(db: Database): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

export function resetDatabase(): Database {
  const seeded = seedDatabase()
  save(seeded)
  return seeded
}

export function exportRaw(): string {
  return localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(seedDatabase())
}
