import React, { useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore, type BillDraft } from '../lib/store'
import { computeTotals, costBasis, isGstCompany, recipientInterState } from '../lib/calc'
import { formatINR, todayISO } from '../lib/format'
import { handbookUsage } from '../lib/handbooks'
import { uid } from '../lib/db'
import { nextBillNumbers } from '../lib/numbering'
import type { Customer, GstMode, LineItem } from '../lib/types'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Button, Card, Input, SectionTitle, useToast } from '../components/ui'
import { Select } from '../components/Select'
import { LineItemEditor } from '../components/LineItemEditor'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function BillFormScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'BillForm'>>()
  const editId = route.params?.id
  const { db, activeCompanyId, createBill, updateBill, saveCustomer } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const toast = useToast()

  const existing = editId ? db.bills.find((b) => b.id === editId) : undefined
  const defaultCompany = existing?.companyId ?? (activeCompanyId !== 'ALL' ? activeCompanyId : db.companies[0]?.id) ?? ''

  const [companyId, setCompanyId] = useState(defaultCompany)
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [customerType, setCustomerType] = useState<'Regular' | 'One_Time'>(existing?.customerType ?? 'Regular')
  const [customerId, setCustomerId] = useState<string | undefined>(existing?.customerId)
  const [customerName, setCustomerName] = useState(existing?.customerName ?? '')
  const [customerAddress, setCustomerAddress] = useState(existing?.customerAddress ?? '')
  const [customerPhone, setCustomerPhone] = useState(existing?.customerPhone ?? '')
  const [customerGstin, setCustomerGstin] = useState(existing?.customerGstin ?? '')
  const [items, setItems] = useState<LineItem[]>(existing?.items ?? [{ id: uid(), description: '', qty: 1, rate: 0 }])
  const [discountAmount, setDiscountAmount] = useState(String(existing?.discountAmount ?? ''))
  const [discountIsPercent, setDiscountIsPercent] = useState(existing?.discountIsPercent ?? false)
  const [taxMode, setTaxMode] = useState<GstMode>(
    existing ? (existing.gstEnabled === false ? 'none' : existing.gstInclusive ? 'inclusive' : 'exclusive') : 'exclusive',
  )
  const [simpleBill, setSimpleBill] = useState(existing?.simpleBill ?? false)
  const [receivedAmount, setReceivedAmount] = useState(String(existing?.receivedAmount ?? ''))
  const [billType, setBillType] = useState<'Online' | 'Handbill'>(existing?.billType ?? 'Online')
  const [handbookId, setHandbookId] = useState<string | undefined>(existing?.handbookId)
  const [handBookNo, setHandBookNo] = useState(existing?.handBookNo ?? '')
  const [handBillNo, setHandBillNo] = useState(existing?.handBillNo ?? '')
  const [numberOverride, setNumberOverride] = useState(
    existing && existing.docStatus === 'Finalized' && existing.billType !== 'Handbill' ? existing.companyBillNo : '',
  )
  // Cost tracking for the profit report (never printed on the bill).
  const [originalCost, setOriginalCost] = useState(existing?.originalCost ?? 0)
  const [saving, setSaving] = useState(false)

  const company = db.companies.find((c) => c.id === companyId)
  const gstCompany = isGstCompany(company)
  const gstEnabled = taxMode !== 'none'
  const gstInclusive = taxMode === 'inclusive'
  const gstMode = gstCompany && gstEnabled
  const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

  // Apply the company's billing defaults when starting a NEW bill or switching company.
  const firstRun = useRef(true)
  useEffect(() => {
    if (existing) return
    if (firstRun.current) { firstRun.current = false }
    if (!company) return
    if (company.defaultGstMode) setTaxMode(company.defaultGstMode)
    if (company.defaultBillType) setBillType(company.defaultBillType)
    setSimpleBill(!!company.defaultSimpleBill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Keep the editable invoice number in sync with the auto series for new/draft bills.
  // Mirrors the web app's BillForm.tsx useEffect at lines 94-100.
  useEffect(() => {
    if (billType !== 'Online') return
    if (existing && existing.docStatus === 'Finalized') return
    const { companyBillNo } = nextBillNumbers(db, companyId, date)
    setNumberOverride(companyBillNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, date, billType])

  const totals = useMemo(() => computeTotals({
    items, discountAmount: num(discountAmount), discountIsPercent, receivedAmount: num(receivedAmount),
    company, interState: recipientInterState(company, customerGstin), gstEnabled, gstInclusive,
  }), [items, discountAmount, discountIsPercent, receivedAmount, company, customerGstin, gstEnabled, gstInclusive])

  // Profit calculation (internal — never printed).
  const cost = costBasis(items, originalCost)
  const sellingBase = totals.taxable
  const profit = sellingBase - cost

  const pickCustomer = (id: string) => {
    const c = db.customers.find((x) => x.id === id)
    if (!c) return
    setCustomerId(c.id); setCustomerName(c.name); setCustomerAddress(c.address); setCustomerPhone(c.phone); setCustomerGstin(c.gstin ?? '')
  }

  const handbooks = company?.handbooks ?? []

  const buildDraft = (): BillDraft | null => {
    if (!companyId) { toast('Select a company', 'error'); return null }
    if (!customerName.trim()) { toast('Enter customer name', 'error'); return null }
    if (items.length === 0 || items.every((it) => !it.description.trim())) { toast('Add at least one item', 'error'); return null }
    if (billType === 'Handbill' && (!handBookNo.trim() || !handBillNo.trim())) { toast('Enter handbill book & receipt no', 'error'); return null }

    // Persist a new Regular customer so it's reusable.
    let cid = customerId
    if (customerType === 'Regular' && !cid && customerName.trim()) {
      const saved: Customer = saveCustomer({ name: customerName.trim(), address: customerAddress, phone: customerPhone, gstin: customerGstin })
      cid = saved.id
    }
    return {
      companyId, date, customerType, customerId: customerType === 'Regular' ? cid : undefined,
      customerName: customerName.trim(), customerAddress, customerPhone, customerGstin,
      items: items.filter((it) => it.description.trim()), discountAmount: num(discountAmount), discountIsPercent,
      // simpleBill is a print-only flag — payment tracking is always independent (matches web app).
      receivedAmount: num(receivedAmount),
      gstEnabled, gstInclusive, simpleBill, originalCost: originalCost || undefined,
      billType, handbookId, handBookNo, handBillNo,
      companyBillNoOverride: billType !== 'Handbill' && numberOverride.trim() ? numberOverride.trim() : undefined,
    }
  }

  const save = (finalize: boolean) => {
    const draft = buildDraft()
    if (!draft) return
    setSaving(true)
    try {
      const bill = editId ? updateBill(editId, draft, finalize || existing?.docStatus === 'Finalized') : createBill(draft, finalize)
      toast(finalize ? 'Bill finalized' : 'Draft saved')
      nav.replace('BillDetail', { id: bill.id })
    } finally { setSaving(false) }
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title={editId ? 'Edit bill' : 'New bill'} showCompany={false} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 14 }}>
            <Select label="Company" value={companyId} options={db.companies.map((c) => ({ label: c.name, value: c.id, sub: c.gstin ? 'GST' : 'Non-GST' }))} onChange={setCompanyId} />
            <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-08-03" autoCapitalize="none" />
            <View style={styles.segment}>
              {(['Online', 'Handbill'] as const).map((bt) => (
                <Pressable key={bt} onPress={() => setBillType(bt)} style={[styles.segmentBtn, billType === bt && styles.segmentActive]}>
                  <Text style={[styles.segmentText, billType === bt && styles.segmentTextActive]}>{bt}</Text>
                </Pressable>
              ))}
            </View>
            {billType === 'Handbill' && (
              <View style={{ gap: 12 }}>
                {handbooks.length > 0 && (
                  <Select label="Handbook" value={handbookId} placeholder="Select book…" options={handbooks.map((h) => {
                    const u = handbookUsage(h, db.bills)
                    return { label: h.name, value: h.id, sub: `Book ${h.bookNo} · ${u.remaining} left${u.nextAvailable ? ` · next #${u.nextAvailable}` : ''}` }
                  })} onChange={(id) => {
                    setHandbookId(id)
                    const h = handbooks.find((x) => x.id === id)
                    if (h) { setHandBookNo(h.bookNo); const u = handbookUsage(h, db.bills); if (u.nextAvailable) setHandBillNo(String(u.nextAvailable)) }
                  }} />
                )}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="Book no" value={handBookNo} onChangeText={setHandBookNo} /></View>
                  <View style={{ flex: 1 }}><Input label="Receipt no" value={handBillNo} onChangeText={setHandBillNo} keyboardType="numeric" /></View>
                </View>
              </View>
            )}
            {billType === 'Online' && (
              <Input label="Invoice number (optional)" value={numberOverride} onChangeText={setNumberOverride} autoCapitalize="characters" placeholder="Auto — leave blank" hint="Blank = auto-number. Editing resets the series to this + 1." />
            )}
            <View>
              <Text style={styles.fieldLabel}>Bill format</Text>
              <View style={styles.segment}>
                {([['Standard', false], ['Simple (cash)', true]] as const).map(([lbl, val]) => (
                  <Pressable key={lbl} onPress={() => setSimpleBill(val)} style={[styles.segmentBtn, simpleBill === val && styles.segmentActive]}>
                    <Text style={[styles.segmentText, simpleBill === val && styles.segmentTextActive]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>

          {/* Customer */}
          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle title="Customer" />
            <Card style={{ gap: 14 }}>
              <View style={styles.segment}>
                {(['Regular', 'One_Time'] as const).map((ct) => (
                  <Pressable key={ct} onPress={() => setCustomerType(ct)} style={[styles.segmentBtn, customerType === ct && styles.segmentActive]}>
                    <Text style={[styles.segmentText, customerType === ct && styles.segmentTextActive]}>{ct === 'One_Time' ? 'One-time' : 'Regular'}</Text>
                  </Pressable>
                ))}
              </View>
              {customerType === 'Regular' && db.customers.length > 0 && (
                <Select label="Pick saved customer" value={customerId} placeholder="Select or type below…" options={db.customers.map((c) => ({ label: c.name, value: c.id, sub: c.phone }))} onChange={pickCustomer} />
              )}
              <Input label="Name" value={customerName} onChangeText={(t) => { setCustomerName(t); setCustomerId(undefined) }} placeholder="Customer name" />
              <Input label="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder="10-digit mobile" />
              <Input label="Address" value={customerAddress} onChangeText={setCustomerAddress} multiline />
              {gstCompany && <Input label="Customer GSTIN (optional)" value={customerGstin} onChangeText={setCustomerGstin} autoCapitalize="characters" placeholder="For B2B invoices" />}
            </Card>
          </View>

          {/* Tax mode */}
          {gstCompany && (
            <Card style={{ marginTop: spacing.lg, gap: 8 }}>
              <Text style={styles.fieldLabel}>Tax mode</Text>
              <View style={styles.segment}>
                {([['Exclusive', 'exclusive'], ['Inclusive', 'inclusive'], ['No GST', 'none']] as const).map(([lbl, val]) => (
                  <Pressable key={val} onPress={() => setTaxMode(val)} style={[styles.segmentBtn, taxMode === val && styles.segmentActive]}>
                    <Text style={[styles.segmentText, taxMode === val && styles.segmentTextActive]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.toggleSub}>
                {taxMode === 'inclusive' ? 'Entered rates already include GST — tax is extracted.' : taxMode === 'none' ? 'No tax applied to this bill.' : 'GST added on top of the entered rates.'}
              </Text>
            </Card>
          )}

          {/* Items */}
          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle title="Items" />
            <LineItemEditor items={items} onChange={setItems} gstMode={gstMode} taxRates={db.settings.taxRates} />
          </View>

          {/* Discount + received */}
          <Card style={{ marginTop: spacing.lg, gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Input label={`Discount ${discountIsPercent ? '(%)' : '(₹)'}`} value={discountAmount} onChangeText={setDiscountAmount} keyboardType="numeric" placeholder="0" /></View>
              <Pressable onPress={() => setDiscountIsPercent((v) => !v)} style={[styles.pctToggle, discountIsPercent && styles.pctToggleActive]}>
                <Text style={[styles.pctText, discountIsPercent && { color: '#fff' }]}>{discountIsPercent ? '%' : '₹'}</Text>
              </Pressable>
            </View>
            {simpleBill
              ? <>
                  <Input
                    label="Received now (₹)"
                    value={receivedAmount}
                    onChangeText={setReceivedAmount}
                    keyboardType="numeric"
                    placeholder={String(Math.round(totals.net))}
                    hint="Simple bill — payment is tracked here but not printed on the bill."
                  />
                </>
              : <Input label="Received now (₹)" value={receivedAmount} onChangeText={setReceivedAmount} keyboardType="numeric" placeholder="0" hint="Recorded as an initial payment" />}
          </Card>

          {/* Live totals */}
          <Card style={[styles.totalsCard, { marginTop: spacing.lg }]}>
            <Row label="Gross" value={formatINR(totals.gross)} />
            {totals.discount > 0 && <Row label="Discount" value={`- ${formatINR(totals.discount)}`} />}
            {gstMode && <Row label={gstInclusive ? 'Tax (incl.)' : 'Tax'} value={formatINR(totals.tax)} />}
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>{simpleBill ? 'Total' : 'Net total'}</Text>
              <Text style={styles.netValue}>{formatINR(totals.net)}</Text>
            </View>
            {num(receivedAmount) > 0 && <Row label="Balance" value={formatINR(totals.balance)} />}
          </Card>

          {/* Original cost / profit (internal — never printed on the bill) */}
          <Card style={[styles.profitCard, { marginTop: spacing.lg }]}>
            <Text style={styles.profitTitle}>Profit (internal)</Text>
            <Text style={styles.profitSub}>Original cost is never printed on the bill.</Text>
            <View style={{ gap: 12, marginTop: 10 }}>
              <Input
                label="Total original cost (₹, optional)"
                value={originalCost ? String(originalCost) : ''}
                onChangeText={(t) => setOriginalCost(parseFloat(t) || 0)}
                keyboardType="numeric"
                placeholder="0.00"
                hint="Overrides per-item costs if set."
              />
              <Row label="Cost basis" value={formatINR(cost)} />
              <Row label="Selling (ex-tax)" value={formatINR(sellingBase)} />
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>Profit</Text>
                <Text style={[styles.profitValue, { color: profit >= 0 ? '#10b981' : '#ef4444' }]}>
                  {formatINR(profit)}
                  {sellingBase > 0 && <Text style={styles.profitPct}>  ({Math.round((profit / sellingBase) * 100)}%)</Text>}
                </Text>
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.xl }}>
            <Button title="Save draft" icon="save-outline" variant="outline" onPress={() => save(false)} loading={saving} style={{ flex: 1 }} />
            <Button title="Finalize" icon="checkmark-done" onPress={() => save(true)} loading={saving} style={{ flex: 1 }} />
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles(makeStyles)
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.brand },
  segmentText: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  fieldLabel: { ...font.small, color: colors.textMuted, fontWeight: '600', marginBottom: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggleLabel: { ...font.body, color: colors.text, fontWeight: '700' },
  toggleSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
  pctToggle: { width: 48, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pctToggleActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pctText: { ...font.h3, color: colors.textMuted },
  totalsCard: { backgroundColor: colors.tintIndigo, borderColor: 'transparent' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { ...font.body, color: colors.textMuted },
  rowValue: { ...font.body, color: colors.text, fontWeight: '700' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderStrong },
  netLabel: { ...font.h3, color: colors.text },
  netValue: { fontSize: 22, fontWeight: '800', color: colors.brand },
  profitCard: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  profitTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  profitSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
  profitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  profitLabel: { ...font.body, color: colors.text, fontWeight: '600' },
  profitValue: { ...font.body, fontWeight: '800' },
  profitPct: { fontSize: 11, fontWeight: '500', color: colors.textFaint },
})
