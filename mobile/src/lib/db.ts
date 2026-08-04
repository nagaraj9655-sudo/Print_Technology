// Seed + id helpers. Adapted for React Native: no localStorage (the mobile app is
// Supabase-backed), and uid() uses a self-contained UUID v4 generator because
// Hermes may not expose crypto.randomUUID. Postgres uuid columns require valid v4s.

import type { Database } from './types'
import { PRINT_TECHNOLOGY_LOGO, SHRAVAN_INFOTECH_LOGO } from './logos'

export function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const DEFAULT_SETTINGS: Database['settings'] = {
  currency: '₹',
  dateFormat: 'dd-MM-yyyy',
  defaultTaxRate: 18,
  fyStartMonth: 4,
  invoiceFooter: 'This is a computer-generated document.',
  taxRates: [0, 5, 12, 18, 28],
  letterpadBillTopMm: 40,
  letterpadQuoteTopMm: 40,
}

export function emptyDatabase(): Database {
  return {
    users: [],
    companies: [],
    customers: [],
    bills: [],
    quotations: [],
    settings: { ...DEFAULT_SETTINGS },
    counters: { billNo: 0, quoteNo: 0, companyBillSeq: {}, companyQuoteSeq: {} },
  }
}

// Used by remote.seedIfEmpty() on a brand-new project, and as a settings fallback.
export function seedDatabase(): Database {
  const ptId = uid()
  const siId = uid()
  const adminId = uid()

  return {
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
        gstin: '',
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
      { id: uid(), name: 'Anand Enterprises', address: '55 RS Puram, Coimbatore 641002', phone: '9791234567', gstin: '33AAACA1111A1Z2', notes: 'Regular monthly printing orders' },
      { id: uid(), name: 'Meera Textiles', address: 'Avinashi Road, Tirupur 641603', phone: '9865412300', gstin: '33AABCM2222B1Z8' },
      { id: uid(), name: 'Kumar Traders', address: 'Town Hall, Coimbatore 641001', phone: '9600011122' },
    ],
    bills: [],
    quotations: [],
    settings: { ...DEFAULT_SETTINGS },
    counters: { billNo: 0, quoteNo: 0, companyBillSeq: {}, companyQuoteSeq: {} },
  }
}
