import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Bill, Company, Customer, Database, Payment, Quotation, Settings, User } from './types'
import { emptyDatabase, uid } from './db'
import { commitBillNumbers, commitQuoteNumbers } from './numbering'
import { billTotals } from './calc'
import { todayISO } from './format'
import { supabase } from './supabase'
import * as remote from './remote'

const ACTIVE_COMPANY_KEY = 'magizhini.activeCompany'
const CACHE_KEY = 'magizhini.cache.v1'

// structuredClone isn't guaranteed on Hermes — fall back to JSON (data is JSON-safe).
const clone = <T,>(x: T): T =>
  typeof (globalThis as any).structuredClone === 'function'
    ? (globalThis as any).structuredClone(x)
    : JSON.parse(JSON.stringify(x))

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
  gstEnabled?: boolean
  originalCost?: number
  billType?: Bill['billType']
  handbookId?: string
  handBookNo?: string
  handBillNo?: string
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
  gstEnabled?: boolean
  originalCost?: number
}

interface StoreValue {
  db: Database
  currentUser: User | null
  ready: boolean
  syncError: string | null
  activeCompanyId: string | 'ALL'
  setActiveCompanyId: (id: string | 'ALL') => void
  activeCompany: Company | undefined

  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>

  saveUser: (u: Partial<User> & { id?: string }) => Promise<{ ok: boolean; error?: string }>
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>

  saveCompany: (c: Partial<Company> & { id?: string }) => Company
  deleteCompany: (id: string) => void

  saveCustomer: (c: Partial<Customer> & { id?: string }) => Customer
  deleteCustomer: (id: string) => void

  createBill: (draft: BillDraft, finalize: boolean) => Bill
  updateBill: (id: string, draft: BillDraft, finalize: boolean) => Bill
  recordPayment: (billId: string, payment: Omit<Payment, 'id'>) => void
  deleteBill: (id: string) => void
  restoreBill: (id: string) => void
  duplicateBill: (id: string) => Bill

  createQuote: (draft: QuoteDraft) => Quotation
  updateQuote: (id: string, draft: QuoteDraft) => Quotation
  setQuoteStatus: (id: string, status: Quotation['status']) => void
  deleteQuote: (id: string) => void
  convertQuoteToBill: (id: string) => Bill

  saveSettings: (s: Partial<Settings>) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(() => emptyDatabase())
  const [ready, setReady] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | 'ALL'>('ALL')
  const skipSync = useRef(true)

  const setActiveCompanyId = useCallback((id: string | 'ALL') => {
    setActiveCompanyIdState(id)
    void AsyncStorage.setItem(ACTIVE_COMPANY_KEY, id)
  }, [])

  const activeCompany = useMemo(
    () => (activeCompanyId === 'ALL' ? undefined : db.companies.find((c) => c.id === activeCompanyId)),
    [db.companies, activeCompanyId],
  )

  const mutate = useCallback((fn: (draft: Database) => void) => {
    setDb((prev) => {
      const next: Database = clone(prev)
      fn(next)
      return next
    })
  }, [])

  // Cloud load — seed on first run, pull everything, resolve the signed-in profile.
  const loadCloud = useCallback(async (authUser: { id: string; email?: string }) => {
    try {
      await remote.seedIfEmpty()
      const data = await remote.fetchAll()
      skipSync.current = true
      setDb(data)
      void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data))
      const profile = data.users.find((u) => u.id === authUser.id)
      setCurrentUser(profile ?? { id: authUser.id, name: authUser.email ?? 'User', email: authUser.email ?? '', role: 'Operator', password: '' })
      setSyncError(null)
    } catch (e) {
      console.error('Cloud load failed', e)
      setSyncError(`Load failed: ${(e as Error)?.message ?? e}`)
    } finally {
      setReady(true)
    }
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) await loadCloud(data.session.user)
  }, [loadCloud])

  // Boot: restore active company + cached db, then check the session.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [savedCompany, cached] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_COMPANY_KEY),
          AsyncStorage.getItem(CACHE_KEY),
        ])
        if (active && savedCompany) setActiveCompanyIdState(savedCompany)
        if (active && cached) {
          try { setDb(JSON.parse(cached) as Database) } catch { /* ignore */ }
        }
      } catch { /* ignore */ }

      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (data.session?.user) await loadCloud(data.session.user)
      else setReady(true)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCurrentUser(null)
        setDb(emptyDatabase())
      }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadCloud])

  // Once companies exist, keep the active company pointing at a real one.
  useEffect(() => {
    if (activeCompanyId !== 'ALL' && db.companies.length && !db.companies.some((c) => c.id === activeCompanyId)) {
      setActiveCompanyId(db.companies[0].id)
    }
  }, [db.companies, activeCompanyId, setActiveCompanyId])

  // Debounced full sync on change (skips the first render after a cloud load).
  useEffect(() => {
    if (!ready || !currentUser) return
    if (skipSync.current) { skipSync.current = false; return }
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(db))
    const handle = setTimeout(() => {
      remote.syncAll(db)
        .then(() => setSyncError(null))
        .catch((e) => {
          console.error('Sync failed', e)
          setSyncError(`Sync failed: ${(e as Error)?.message ?? e}`)
        })
    }, 600)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  // ---- Auth ----
  const login: StoreValue['login'] = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error || !data.user) return { ok: false, error: error?.message ?? 'Login failed' }
    await loadCloud(data.user)
    return { ok: true }
  }, [loadCloud])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setDb(emptyDatabase())
    void AsyncStorage.removeItem(CACHE_KEY)
  }, [])

  // ---- Users (Admin) ----
  const saveUser: StoreValue['saveUser'] = useCallback(async (u) => {
    const email = (u.email ?? '').trim().toLowerCase()
    if (!u.name?.trim()) return { ok: false, error: 'Name is required' }
    if (!email) return { ok: false, error: 'Email is required' }
    const clash = db.users.find((x) => x.email.toLowerCase() === email && x.id !== u.id)
    if (clash) return { ok: false, error: 'That email is already in use' }
    if (!u.id && !u.password?.trim()) return { ok: false, error: 'Password is required for a new user' }
    try {
      if (u.id) await remote.updateProfileRole(u.id, u.role ?? 'Operator', u.name.trim(), u.allowedMenus)
      else await remote.adminCreateUser({ name: u.name.trim(), email, password: u.password!.trim(), role: u.role ?? 'Operator' })
      const users = await remote.fetchUsers()
      skipSync.current = true
      mutate((d) => { d.users = users })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }, [mutate, db.users])

  const deleteUser: StoreValue['deleteUser'] = useCallback(async (id) => {
    if (id === currentUser?.id) return { ok: false, error: 'You cannot delete the account you are signed in with' }
    const target = db.users.find((u) => u.id === id)
    if (target?.role === 'Admin' && db.users.filter((u) => u.role === 'Admin').length <= 1)
      return { ok: false, error: 'At least one Admin must remain' }
    try {
      await remote.adminDeleteUser(id)
      skipSync.current = true
      mutate((d) => { d.users = d.users.filter((u) => u.id !== id) })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }, [mutate, db.users, currentUser])

  // ---- Companies ----
  const saveCompany: StoreValue['saveCompany'] = useCallback((c) => {
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
      upiId: c.upiId?.trim() || undefined,
      payeeName: c.payeeName,
      invoicePrefix: c.invoicePrefix,
      quotePrefix: c.quotePrefix,
      accent: c.accent || '#4f46e5',
      accent2: c.accent2 || c.accent || '#7c3aed',
      template: c.template ?? 'modern',
      fontFamily: c.fontFamily ?? 'Inter',
      terms: c.terms,
      handbooks: c.handbooks ?? [],
      isActive: c.isActive ?? true,
    }
    mutate((d) => {
      const idx = d.companies.findIndex((x) => x.id === id)
      if (idx >= 0) d.companies[idx] = record
      else d.companies.push(record)
    })
    return record
  }, [mutate])

  const deleteCompany: StoreValue['deleteCompany'] = useCallback((id) => {
    mutate((d) => { d.companies = d.companies.filter((c) => c.id !== id) })
    void remote.deleteRow('companies', id).catch((e) => console.error(e))
    if (activeCompanyId === id) setActiveCompanyId(db.companies.find((c) => c.id !== id)?.id || 'ALL')
  }, [mutate, activeCompanyId, db.companies, setActiveCompanyId])

  // ---- Customers ----
  const saveCustomer: StoreValue['saveCustomer'] = useCallback((c) => {
    const id = c.id ?? uid()
    const record: Customer = {
      id, name: c.name ?? '', address: c.address ?? '', phone: c.phone ?? '',
      gstin: c.gstin?.trim() || undefined, notes: c.notes,
    }
    mutate((d) => {
      const idx = d.customers.findIndex((x) => x.id === id)
      if (idx >= 0) d.customers[idx] = record
      else d.customers.push(record)
    })
    return record
  }, [mutate])

  const deleteCustomer: StoreValue['deleteCustomer'] = useCallback((id) => {
    mutate((d) => { d.customers = d.customers.filter((c) => c.id !== id) })
    void remote.deleteRow('customers', id).catch((e) => console.error(e))
  }, [mutate])

  // ---- Bills ----
  const buildBillBase = useCallback((draft: BillDraft): Omit<Bill, 'id' | 'billNo' | 'companyBillNo' | 'createdAt'> => ({
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
    gstEnabled: draft.gstEnabled,
    originalCost: draft.originalCost,
    billType: draft.billType ?? 'Online',
    handbookId: draft.handbookId,
    handBookNo: draft.handBookNo,
    handBillNo: draft.handBillNo,
    receivedAmount: draft.receivedAmount || 0,
    payments: draft.receivedAmount > 0 ? [{ id: uid(), date: draft.date, amount: draft.receivedAmount, mode: 'Cash/other' }] : [],
    docStatus: 'Draft',
    createdBy: currentUser?.name ?? 'system',
    updatedAt: new Date().toISOString(),
  }), [currentUser])

  const assignBillNumbers = (d: Database, draft: BillDraft) => {
    if (draft.billType === 'Handbill') {
      return {
        billNo: (d.counters.billNo = (d.counters.billNo || 0) + 1),
        companyBillNo: `${draft.handBookNo || '?'}/${draft.handBillNo || '?'}`,
      }
    }
    return commitBillNumbers(d, draft.companyId, draft.date)
  }

  const createBill: StoreValue['createBill'] = useCallback((draft, finalize) => {
    let created!: Bill
    mutate((d) => {
      const base = buildBillBase(draft)
      const nums = finalize ? assignBillNumbers(d, draft) : { billNo: 0, companyBillNo: 'DRAFT' }
      created = { ...base, id: uid(), billNo: nums.billNo, companyBillNo: nums.companyBillNo, docStatus: finalize ? 'Finalized' : 'Draft', createdAt: new Date().toISOString() }
      d.bills.push(created)
    })
    return created
  }, [mutate, buildBillBase])

  const updateBill: StoreValue['updateBill'] = useCallback((id, draft, finalize) => {
    let updated!: Bill
    mutate((d) => {
      const idx = d.bills.findIndex((b) => b.id === id)
      if (idx < 0) return
      const prev = d.bills[idx]
      const base = buildBillBase(draft)
      let billNo = prev.billNo
      let companyBillNo = prev.companyBillNo
      if (finalize && prev.docStatus === 'Draft') {
        const nums = assignBillNumbers(d, draft)
        billNo = nums.billNo
        companyBillNo = nums.companyBillNo
      } else if (draft.billType === 'Handbill' && prev.docStatus === 'Finalized') {
        companyBillNo = `${draft.handBookNo || '?'}/${draft.handBillNo || '?'}`
      }
      updated = {
        ...prev, ...base, id: prev.id, billNo, companyBillNo,
        payments: prev.payments.length ? prev.payments : base.payments,
        receivedAmount: prev.payments.length ? prev.receivedAmount : base.receivedAmount,
        docStatus: finalize ? 'Finalized' : prev.docStatus,
        createdAt: prev.createdAt,
      }
      d.bills[idx] = updated
    })
    return updated
  }, [mutate, buildBillBase])

  const recordPayment: StoreValue['recordPayment'] = useCallback((billId, payment) => {
    mutate((d) => {
      const bill = d.bills.find((b) => b.id === billId)
      if (!bill) return
      bill.payments.push({ ...payment, id: uid() })
      bill.receivedAmount = bill.payments.reduce((s, p) => s + p.amount, 0)
      bill.updatedAt = new Date().toISOString()
    })
  }, [mutate])

  const deleteBill: StoreValue['deleteBill'] = useCallback((id) => mutate((d) => {
    const b = d.bills.find((x) => x.id === id)
    if (b) b.deletedAt = new Date().toISOString()
  }), [mutate])

  const restoreBill: StoreValue['restoreBill'] = useCallback((id) => mutate((d) => {
    const b = d.bills.find((x) => x.id === id)
    if (b) delete b.deletedAt
  }), [mutate])

  const duplicateBill: StoreValue['duplicateBill'] = useCallback((id) => {
    let created!: Bill
    mutate((d) => {
      const src = d.bills.find((b) => b.id === id)
      if (!src) return
      created = {
        ...clone(src), id: uid(), billNo: 0, companyBillNo: 'DRAFT', date: todayISO(),
        docStatus: 'Draft', receivedAmount: 0, payments: [],
        createdBy: currentUser?.name ?? 'system', createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), deletedAt: undefined,
      }
      created.items = created.items.map((it) => ({ ...it, id: uid() }))
      d.bills.push(created)
    })
    return created
  }, [mutate, currentUser])

  // ---- Quotations ----
  const createQuote: StoreValue['createQuote'] = useCallback((draft) => {
    let created!: Quotation
    mutate((d) => {
      const nums = commitQuoteNumbers(d, draft.companyId, draft.date)
      created = {
        id: uid(), quoteNo: nums.quoteNo, companyQuoteNo: nums.companyQuoteNo, date: draft.date, companyId: draft.companyId,
        customerType: draft.customerType, customerId: draft.customerId, customerName: draft.customerName,
        customerAddress: draft.customerAddress, customerPhone: draft.customerPhone, customerGstin: draft.customerGstin?.trim() || undefined,
        items: draft.items, discountAmount: draft.discountAmount || 0, discountIsPercent: draft.discountIsPercent,
        gstEnabled: draft.gstEnabled, originalCost: draft.originalCost, status: draft.status, validUntil: draft.validUntil,
        createdBy: currentUser?.name ?? 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      d.quotations.push(created)
    })
    return created
  }, [mutate, currentUser])

  const updateQuote: StoreValue['updateQuote'] = useCallback((id, draft) => {
    let updated!: Quotation
    mutate((d) => {
      const idx = d.quotations.findIndex((q) => q.id === id)
      if (idx < 0) return
      const prev = d.quotations[idx]
      updated = {
        ...prev, date: draft.date, companyId: draft.companyId, customerType: draft.customerType, customerId: draft.customerId,
        customerName: draft.customerName, customerAddress: draft.customerAddress, customerPhone: draft.customerPhone,
        customerGstin: draft.customerGstin?.trim() || undefined, items: draft.items, discountAmount: draft.discountAmount || 0,
        discountIsPercent: draft.discountIsPercent, gstEnabled: draft.gstEnabled, originalCost: draft.originalCost,
        status: draft.status, validUntil: draft.validUntil, updatedAt: new Date().toISOString(),
      }
      d.quotations[idx] = updated
    })
    return updated
  }, [mutate])

  const setQuoteStatus: StoreValue['setQuoteStatus'] = useCallback((id, status) => mutate((d) => {
    const q = d.quotations.find((x) => x.id === id)
    if (q) { q.status = status; q.updatedAt = new Date().toISOString() }
  }), [mutate])

  const deleteQuote: StoreValue['deleteQuote'] = useCallback((id) => mutate((d) => {
    const q = d.quotations.find((x) => x.id === id)
    if (q) q.deletedAt = new Date().toISOString()
  }), [mutate])

  const convertQuoteToBill: StoreValue['convertQuoteToBill'] = useCallback((id) => {
    let created!: Bill
    mutate((d) => {
      const q = d.quotations.find((x) => x.id === id)
      if (!q) return
      const nums = commitBillNumbers(d, q.companyId, todayISO())
      created = {
        id: uid(), billNo: nums.billNo, companyBillNo: nums.companyBillNo, date: todayISO(), companyId: q.companyId,
        customerType: q.customerType, customerId: q.customerId, customerName: q.customerName, customerAddress: q.customerAddress,
        customerPhone: q.customerPhone, customerGstin: q.customerGstin, items: q.items.map((it) => ({ ...it, id: uid() })),
        discountAmount: q.discountAmount, discountIsPercent: q.discountIsPercent, gstEnabled: q.gstEnabled, originalCost: q.originalCost,
        billType: 'Online', receivedAmount: 0, payments: [], docStatus: 'Finalized',
        createdBy: currentUser?.name ?? 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      d.bills.push(created)
      q.status = 'Converted'
      q.convertedBillId = created.id
      q.updatedAt = new Date().toISOString()
    })
    return created
  }, [mutate, currentUser])

  const saveSettings: StoreValue['saveSettings'] = useCallback((s) => mutate((d) => { d.settings = { ...d.settings, ...s } }), [mutate])

  const value: StoreValue = {
    db, currentUser, ready, syncError, activeCompanyId, setActiveCompanyId, activeCompany,
    login, logout, refresh, saveUser, deleteUser, saveCompany, deleteCompany, saveCustomer, deleteCustomer,
    createBill, updateBill, recordPayment, deleteBill, restoreBill, duplicateBill,
    createQuote, updateQuote, setQuoteStatus, deleteQuote, convertQuoteToBill, saveSettings,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// Convenience selectors -------------------------------------------------------
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

export function outstandingFor(bills: Bill[], companies: Company[]): number {
  return bills.reduce((sum, b) => {
    const company = companies.find((c) => c.id === b.companyId)
    return sum + billTotals(b, company).balance
  }, 0)
}
