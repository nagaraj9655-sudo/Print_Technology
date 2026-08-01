import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  Bill,
  Company,
  Customer,
  Database,
  Payment,
  Quotation,
  Settings,
  User,
} from './types'
import { load, save, resetDatabase, uid } from './db'
import { commitBillNumbers, commitQuoteNumbers } from './numbering'
import { billTotals } from './calc'
import { todayISO } from './format'

const ACTIVE_COMPANY_KEY = 'billflow.activeCompany'
const SESSION_KEY = 'billflow.session'

interface StoreValue {
  db: Database
  currentUser: User | null
  activeCompanyId: string | 'ALL'
  setActiveCompanyId: (id: string | 'ALL') => void
  activeCompany: Company | undefined

  // auth
  login: (email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void

  // users (Admin)
  saveUser: (u: Partial<User> & { id?: string }) => { ok: boolean; error?: string }
  deleteUser: (id: string) => { ok: boolean; error?: string }

  // companies
  saveCompany: (c: Partial<Company> & { id?: string }) => Company
  deleteCompany: (id: string) => void

  // customers
  saveCustomer: (c: Partial<Customer> & { id?: string }) => Customer
  deleteCustomer: (id: string) => void

  // bills
  createBill: (draft: BillDraft, finalize: boolean) => Bill
  updateBill: (id: string, draft: BillDraft, finalize: boolean) => Bill
  recordPayment: (billId: string, payment: Omit<Payment, 'id'>) => void
  deleteBill: (id: string) => void
  restoreBill: (id: string) => void
  duplicateBill: (id: string) => Bill

  // quotations
  createQuote: (draft: QuoteDraft) => Quotation
  updateQuote: (id: string, draft: QuoteDraft) => Quotation
  setQuoteStatus: (id: string, status: Quotation['status']) => void
  deleteQuote: (id: string) => void
  convertQuoteToBill: (id: string) => Bill

  // settings
  saveSettings: (s: Partial<Settings>) => void

  reset: () => void
  reload: () => void
}

export interface BillDraft {
  companyId: string
  date: string
  customerType: Bill['customerType']
  customerId?: string
  customerName: string
  customerAddress: string
  customerPhone: string
  customerGstin?: string
  items: Bill['items']
  discountAmount: number
  discountIsPercent?: boolean
  receivedAmount: number
}

export interface QuoteDraft {
  companyId: string
  date: string
  customerType: Quotation['customerType']
  customerId?: string
  customerName: string
  customerAddress: string
  customerPhone: string
  customerGstin?: string
  items: Quotation['items']
  discountAmount: number
  discountIsPercent?: boolean
  validUntil?: string
  status: Quotation['status']
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(() => load())
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | 'ALL'>(() => {
    const stored = localStorage.getItem(ACTIVE_COMPANY_KEY)
    if (stored === 'ALL') return 'ALL'
    // Guard against a stale id (e.g. after a re-seed) that no longer exists.
    if (stored && db.companies.some((c) => c.id === stored)) return stored
    return db.companies[0]?.id || 'ALL'
  })

  // Persist whenever db changes.
  useEffect(() => {
    save(db)
  }, [db])

  const setActiveCompanyId = useCallback((id: string | 'ALL') => {
    setActiveCompanyIdState(id)
    localStorage.setItem(ACTIVE_COMPANY_KEY, id)
  }, [])

  const activeCompany = useMemo(
    () => (activeCompanyId === 'ALL' ? undefined : db.companies.find((c) => c.id === activeCompanyId)),
    [db.companies, activeCompanyId],
  )

  // Mutation helper — always operates on a fresh clone so React re-renders.
  const mutate = useCallback((fn: (draft: Database) => void) => {
    setDb((prev) => {
      const next: Database = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  // ---- Auth ----
  const login: StoreValue['login'] = useCallback(
    (email, password) => {
      const user = db.users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
      )
      if (!user) return { ok: false, error: 'Invalid email or password' }
      setCurrentUser(user)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
      return { ok: true }
    },
    [db.users],
  )

  const logout = useCallback(() => {
    setCurrentUser(null)
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  // ---- Users (Admin) ----
  const saveUser: StoreValue['saveUser'] = useCallback(
    (u) => {
      const email = (u.email ?? '').trim().toLowerCase()
      if (!u.name?.trim()) return { ok: false, error: 'Name is required' }
      if (!email) return { ok: false, error: 'Email is required' }
      const clash = db.users.find((x) => x.email.toLowerCase() === email && x.id !== u.id)
      if (clash) return { ok: false, error: 'That email is already in use' }
      if (!u.id && !u.password?.trim()) return { ok: false, error: 'Password is required for a new user' }
      mutate((d) => {
        const idx = d.users.findIndex((x) => x.id === u.id)
        if (idx >= 0) {
          d.users[idx] = {
            ...d.users[idx],
            name: u.name!.trim(),
            email,
            role: u.role ?? d.users[idx].role,
            // keep existing password when the field is left blank on edit
            password: u.password?.trim() ? u.password : d.users[idx].password,
          }
        } else {
          d.users.push({ id: uid(), name: u.name!.trim(), email, role: u.role ?? 'Operator', password: u.password!.trim() })
        }
      })
      return { ok: true }
    },
    [mutate, db.users],
  )

  const deleteUser: StoreValue['deleteUser'] = useCallback(
    (id) => {
      if (id === currentUser?.id) return { ok: false, error: 'You cannot delete the account you are signed in with' }
      const target = db.users.find((u) => u.id === id)
      if (target?.role === 'Admin' && db.users.filter((u) => u.role === 'Admin').length <= 1)
        return { ok: false, error: 'At least one Admin must remain' }
      mutate((d) => {
        d.users = d.users.filter((u) => u.id !== id)
      })
      return { ok: true }
    },
    [mutate, db.users, currentUser],
  )

  // ---- Companies ----
  const saveCompany: StoreValue['saveCompany'] = useCallback(
    (c) => {
      const id = c.id ?? uid()
      const record: Company = {
        id,
        name: c.name ?? '',
        address: c.address ?? '',
        phone: c.phone ?? '',
        email: c.email,
        gstin: c.gstin?.trim() || undefined,
        stateCode: c.stateCode || c.gstin?.slice(0, 2),
        logoDataUrl: c.logoDataUrl,
        bankDetails: c.bankDetails,
        invoicePrefix: c.invoicePrefix,
        quotePrefix: c.quotePrefix,
        accent: c.accent || '#1f47f5',
        accent2: c.accent2 || c.accent || '#1f47f5',
        template: c.template ?? 'modern',
        fontFamily: c.fontFamily ?? 'Inter',
        terms: c.terms,
        isActive: c.isActive ?? true,
      }
      mutate((d) => {
        const idx = d.companies.findIndex((x) => x.id === id)
        if (idx >= 0) d.companies[idx] = record
        else d.companies.push(record)
      })
      return record
    },
    [mutate],
  )

  const deleteCompany: StoreValue['deleteCompany'] = useCallback(
    (id) => {
      mutate((d) => {
        d.companies = d.companies.filter((c) => c.id !== id)
      })
      if (activeCompanyId === id) setActiveCompanyId(db.companies.find((c) => c.id !== id)?.id || 'ALL')
    },
    [mutate, activeCompanyId, db.companies, setActiveCompanyId],
  )

  // ---- Customers ----
  const saveCustomer: StoreValue['saveCustomer'] = useCallback(
    (c) => {
      const id = c.id ?? uid()
      const record: Customer = {
        id,
        name: c.name ?? '',
        address: c.address ?? '',
        phone: c.phone ?? '',
        gstin: c.gstin?.trim() || undefined,
        notes: c.notes,
      }
      mutate((d) => {
        const idx = d.customers.findIndex((x) => x.id === id)
        if (idx >= 0) d.customers[idx] = record
        else d.customers.push(record)
      })
      return record
    },
    [mutate],
  )

  const deleteCustomer: StoreValue['deleteCustomer'] = useCallback(
    (id) => mutate((d) => { d.customers = d.customers.filter((c) => c.id !== id) }),
    [mutate],
  )

  // ---- Bills ----
  const buildBillBase = (draft: BillDraft): Omit<Bill, 'id' | 'billNo' | 'companyBillNo' | 'createdAt'> => ({
    date: draft.date,
    companyId: draft.companyId,
    customerType: draft.customerType,
    customerId: draft.customerId,
    customerName: draft.customerName,
    customerAddress: draft.customerAddress,
    customerPhone: draft.customerPhone,
    customerGstin: draft.customerGstin?.trim() || undefined,
    items: draft.items,
    discountAmount: draft.discountAmount || 0,
    discountIsPercent: draft.discountIsPercent,
    receivedAmount: draft.receivedAmount || 0,
    payments:
      draft.receivedAmount > 0
        ? [{ id: uid(), date: draft.date, amount: draft.receivedAmount, mode: 'Cash/other' }]
        : [],
    docStatus: 'Draft',
    createdBy: currentUser?.name ?? 'system',
    updatedAt: new Date().toISOString(),
  })

  const createBill: StoreValue['createBill'] = useCallback(
    (draft, finalize) => {
      let created!: Bill
      mutate((d) => {
        const base = buildBillBase(draft)
        const nums = finalize
          ? commitBillNumbers(d, draft.companyId, draft.date)
          : { billNo: 0, companyBillNo: 'DRAFT' }
        created = {
          ...base,
          id: uid(),
          billNo: nums.billNo,
          companyBillNo: nums.companyBillNo,
          docStatus: finalize ? 'Finalized' : 'Draft',
          createdAt: new Date().toISOString(),
        }
        d.bills.push(created)
      })
      return created
    },
    [mutate, currentUser],
  )

  const updateBill: StoreValue['updateBill'] = useCallback(
    (id, draft, finalize) => {
      let updated!: Bill
      mutate((d) => {
        const idx = d.bills.findIndex((b) => b.id === id)
        if (idx < 0) return
        const prev = d.bills[idx]
        const base = buildBillBase(draft)
        // Assign numbers only when transitioning Draft -> Finalized (locks the number).
        let billNo = prev.billNo
        let companyBillNo = prev.companyBillNo
        if (finalize && prev.docStatus === 'Draft') {
          const nums = commitBillNumbers(d, draft.companyId, draft.date)
          billNo = nums.billNo
          companyBillNo = nums.companyBillNo
        }
        updated = {
          ...prev,
          ...base,
          id: prev.id,
          billNo,
          companyBillNo,
          payments: prev.payments.length ? prev.payments : base.payments,
          receivedAmount: prev.payments.length ? prev.receivedAmount : base.receivedAmount,
          docStatus: finalize ? 'Finalized' : prev.docStatus,
          createdAt: prev.createdAt,
        }
        d.bills[idx] = updated
      })
      return updated
    },
    [mutate, currentUser],
  )

  const recordPayment: StoreValue['recordPayment'] = useCallback(
    (billId, payment) => {
      mutate((d) => {
        const bill = d.bills.find((b) => b.id === billId)
        if (!bill) return
        bill.payments.push({ ...payment, id: uid() })
        bill.receivedAmount = bill.payments.reduce((s, p) => s + p.amount, 0)
        bill.updatedAt = new Date().toISOString()
      })
    },
    [mutate],
  )

  const deleteBill: StoreValue['deleteBill'] = useCallback(
    (id) => mutate((d) => {
      const b = d.bills.find((x) => x.id === id)
      if (b) b.deletedAt = new Date().toISOString()
    }),
    [mutate],
  )

  const restoreBill: StoreValue['restoreBill'] = useCallback(
    (id) => mutate((d) => {
      const b = d.bills.find((x) => x.id === id)
      if (b) delete b.deletedAt
    }),
    [mutate],
  )

  const duplicateBill: StoreValue['duplicateBill'] = useCallback(
    (id) => {
      let created!: Bill
      mutate((d) => {
        const src = d.bills.find((b) => b.id === id)
        if (!src) return
        created = {
          ...structuredClone(src),
          id: uid(),
          billNo: 0,
          companyBillNo: 'DRAFT',
          date: todayISO(),
          docStatus: 'Draft',
          receivedAmount: 0,
          payments: [],
          createdBy: currentUser?.name ?? 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: undefined,
        }
        created.items = created.items.map((it) => ({ ...it, id: uid() }))
        d.bills.push(created)
      })
      return created
    },
    [mutate, currentUser],
  )

  // ---- Quotations ----
  const createQuote: StoreValue['createQuote'] = useCallback(
    (draft) => {
      let created!: Quotation
      mutate((d) => {
        const nums = commitQuoteNumbers(d, draft.companyId, draft.date)
        created = {
          id: uid(),
          quoteNo: nums.quoteNo,
          companyQuoteNo: nums.companyQuoteNo,
          date: draft.date,
          companyId: draft.companyId,
          customerType: draft.customerType,
          customerId: draft.customerId,
          customerName: draft.customerName,
          customerAddress: draft.customerAddress,
          customerPhone: draft.customerPhone,
          customerGstin: draft.customerGstin?.trim() || undefined,
          items: draft.items,
          discountAmount: draft.discountAmount || 0,
          discountIsPercent: draft.discountIsPercent,
          status: draft.status,
          validUntil: draft.validUntil,
          createdBy: currentUser?.name ?? 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        d.quotations.push(created)
      })
      return created
    },
    [mutate, currentUser],
  )

  const updateQuote: StoreValue['updateQuote'] = useCallback(
    (id, draft) => {
      let updated!: Quotation
      mutate((d) => {
        const idx = d.quotations.findIndex((q) => q.id === id)
        if (idx < 0) return
        const prev = d.quotations[idx]
        updated = {
          ...prev,
          date: draft.date,
          companyId: draft.companyId,
          customerType: draft.customerType,
          customerId: draft.customerId,
          customerName: draft.customerName,
          customerAddress: draft.customerAddress,
          customerPhone: draft.customerPhone,
          customerGstin: draft.customerGstin?.trim() || undefined,
          items: draft.items,
          discountAmount: draft.discountAmount || 0,
          discountIsPercent: draft.discountIsPercent,
          status: draft.status,
          validUntil: draft.validUntil,
          updatedAt: new Date().toISOString(),
        }
        d.quotations[idx] = updated
      })
      return updated
    },
    [mutate],
  )

  const setQuoteStatus: StoreValue['setQuoteStatus'] = useCallback(
    (id, status) => mutate((d) => {
      const q = d.quotations.find((x) => x.id === id)
      if (q) { q.status = status; q.updatedAt = new Date().toISOString() }
    }),
    [mutate],
  )

  const deleteQuote: StoreValue['deleteQuote'] = useCallback(
    (id) => mutate((d) => {
      const q = d.quotations.find((x) => x.id === id)
      if (q) q.deletedAt = new Date().toISOString()
    }),
    [mutate],
  )

  const convertQuoteToBill: StoreValue['convertQuoteToBill'] = useCallback(
    (id) => {
      let created!: Bill
      mutate((d) => {
        const q = d.quotations.find((x) => x.id === id)
        if (!q) return
        const nums = commitBillNumbers(d, q.companyId, todayISO())
        created = {
          id: uid(),
          billNo: nums.billNo,
          companyBillNo: nums.companyBillNo,
          date: todayISO(),
          companyId: q.companyId,
          customerType: q.customerType,
          customerId: q.customerId,
          customerName: q.customerName,
          customerAddress: q.customerAddress,
          customerPhone: q.customerPhone,
          customerGstin: q.customerGstin,
          items: q.items.map((it) => ({ ...it, id: uid() })),
          discountAmount: q.discountAmount,
          discountIsPercent: q.discountIsPercent,
          receivedAmount: 0,
          payments: [],
          docStatus: 'Finalized',
          createdBy: currentUser?.name ?? 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        d.bills.push(created)
        q.status = 'Converted'
        q.convertedBillId = created.id
        q.updatedAt = new Date().toISOString()
      })
      return created
    },
    [mutate, currentUser],
  )

  const saveSettings: StoreValue['saveSettings'] = useCallback(
    (s) => mutate((d) => { d.settings = { ...d.settings, ...s } }),
    [mutate],
  )

  const reset = useCallback(() => {
    const fresh = resetDatabase()
    setDb(fresh)
    setActiveCompanyId(fresh.companies[0]?.id || 'ALL')
  }, [setActiveCompanyId])

  const reload = useCallback(() => setDb(load()), [])

  const value: StoreValue = {
    db,
    currentUser,
    activeCompanyId,
    setActiveCompanyId,
    activeCompany,
    login,
    logout,
    saveUser,
    deleteUser,
    saveCompany,
    deleteCompany,
    saveCustomer,
    deleteCustomer,
    createBill,
    updateBill,
    recordPayment,
    deleteBill,
    restoreBill,
    duplicateBill,
    createQuote,
    updateQuote,
    setQuoteStatus,
    deleteQuote,
    convertQuoteToBill,
    saveSettings,
    reset,
    reload,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// Convenience selectors -------------------------------------------------------

export function useCompanyById(id?: string): Company | undefined {
  const { db } = useStore()
  return db.companies.find((c) => c.id === id)
}

export function useScopedBills(includeDeleted = false): Bill[] {
  const { db, activeCompanyId } = useStore()
  return db.bills
    .filter((b) => (includeDeleted ? true : !b.deletedAt))
    .filter((b) => (activeCompanyId === 'ALL' ? true : b.companyId === activeCompanyId))
}

export function useScopedQuotes(includeDeleted = false): Quotation[] {
  const { db, activeCompanyId } = useStore()
  return db.quotations
    .filter((q) => (includeDeleted ? true : !q.deletedAt))
    .filter((q) => (activeCompanyId === 'ALL' ? true : q.companyId === activeCompanyId))
}

// Outstanding across (optionally) all companies.
export function outstandingFor(bills: Bill[], companies: Company[]): number {
  return bills.reduce((sum, b) => {
    const company = companies.find((c) => c.id === b.companyId)
    return sum + billTotals(b, company).balance
  }, 0)
}
