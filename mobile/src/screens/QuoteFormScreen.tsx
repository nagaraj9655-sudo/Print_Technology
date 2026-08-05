import React, { useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useStore, type QuoteDraft } from '../lib/store'
import { computeTotals, isGstCompany, recipientInterState } from '../lib/calc'
import { formatINR, todayISO } from '../lib/format'
import { uid } from '../lib/db'
import type { Customer, GstMode, LineItem, QuoteStatus } from '../lib/types'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Button, Card, Input, SectionTitle, useToast } from '../components/ui'
import { Select } from '../components/Select'
import { LineItemEditor } from '../components/LineItemEditor'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
const STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired']

export function QuoteFormScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'QuoteForm'>>()
  const editId = route.params?.id
  const { db, activeCompanyId, createQuote, updateQuote, saveCustomer } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const toast = useToast()

  const existing = editId ? db.quotations.find((q) => q.id === editId) : undefined
  const defaultCompany = existing?.companyId ?? (activeCompanyId !== 'ALL' ? activeCompanyId : db.companies[0]?.id) ?? ''

  const [companyId, setCompanyId] = useState(defaultCompany)
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? '')
  const [status, setStatus] = useState<QuoteStatus>(existing?.status ?? 'Draft')
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
  const [numberOverride, setNumberOverride] = useState(existing?.companyQuoteNo ?? '')
  const [saving, setSaving] = useState(false)

  const company = db.companies.find((c) => c.id === companyId)
  const gstCompany = isGstCompany(company)
  const gstEnabled = taxMode !== 'none'
  const gstInclusive = taxMode === 'inclusive'
  const gstMode = gstCompany && gstEnabled
  const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

  useEffect(() => {
    if (existing || !company?.defaultGstMode) return
    setTaxMode(company.defaultGstMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const totals = useMemo(() => computeTotals({
    items, discountAmount: num(discountAmount), discountIsPercent, company,
    interState: recipientInterState(company, customerGstin), gstEnabled, gstInclusive,
  }), [items, discountAmount, discountIsPercent, company, customerGstin, gstEnabled, gstInclusive])

  const pickCustomer = (id: string) => {
    const c = db.customers.find((x) => x.id === id)
    if (!c) return
    setCustomerId(c.id); setCustomerName(c.name); setCustomerAddress(c.address); setCustomerPhone(c.phone); setCustomerGstin(c.gstin ?? '')
  }

  const save = () => {
    if (!companyId) return toast('Select a company', 'error')
    if (!customerName.trim()) return toast('Enter customer name', 'error')
    if (items.every((it) => !it.description.trim())) return toast('Add at least one item', 'error')
    let cid = customerId
    if (customerType === 'Regular' && !cid && customerName.trim()) {
      const saved: Customer = saveCustomer({ name: customerName.trim(), address: customerAddress, phone: customerPhone, gstin: customerGstin })
      cid = saved.id
    }
    const draft: QuoteDraft = {
      companyId, date, customerType, customerId: customerType === 'Regular' ? cid : undefined,
      customerName: customerName.trim(), customerAddress, customerPhone, customerGstin,
      items: items.filter((it) => it.description.trim()), discountAmount: num(discountAmount), discountIsPercent,
      validUntil: validUntil || undefined, status, gstEnabled, gstInclusive,
      companyQuoteNoOverride: numberOverride.trim() || undefined,
    }
    setSaving(true)
    try {
      const q = editId ? updateQuote(editId, draft) : createQuote(draft)
      toast(editId ? 'Quotation updated' : 'Quotation created')
      nav.replace('QuoteDetail', { id: q.id })
    } finally { setSaving(false) }
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title={editId ? 'Edit quote' : 'New quotation'} showCompany={false} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 14 }}>
            <Select label="Company" value={companyId} options={db.companies.map((c) => ({ label: c.name, value: c.id }))} onChange={setCompanyId} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Input label="Date" value={date} onChangeText={setDate} autoCapitalize="none" /></View>
              <View style={{ flex: 1 }}><Input label="Valid until" value={validUntil} onChangeText={setValidUntil} placeholder="YYYY-MM-DD" autoCapitalize="none" /></View>
            </View>
            <Select label="Status" value={status} options={STATUSES.map((s) => ({ label: s, value: s }))} onChange={(s) => setStatus(s as QuoteStatus)} />
            <Input label="Quotation number (optional)" value={numberOverride} onChangeText={setNumberOverride} autoCapitalize="characters" placeholder="Auto — leave blank" hint="Blank = auto-number. Editing resets the series." />
          </Card>

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
              <Input label="Name" value={customerName} onChangeText={(t) => { setCustomerName(t); setCustomerId(undefined) }} />
              <Input label="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
              <Input label="Address" value={customerAddress} onChangeText={setCustomerAddress} multiline />
              {gstCompany && <Input label="Customer GSTIN (optional)" value={customerGstin} onChangeText={setCustomerGstin} autoCapitalize="characters" />}
            </Card>
          </View>

          {gstCompany && (
            <Card style={{ marginTop: spacing.lg, gap: 8 }}>
              <Text style={styles.toggleLabel}>Tax mode</Text>
              <View style={styles.segment}>
                {([['Exclusive', 'exclusive'], ['Inclusive', 'inclusive'], ['No GST', 'none']] as const).map(([lbl, val]) => (
                  <Pressable key={val} onPress={() => setTaxMode(val)} style={[styles.segmentBtn, taxMode === val && styles.segmentActive]}>
                    <Text style={[styles.segmentText, taxMode === val && styles.segmentTextActive]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}

          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle title="Items" />
            <LineItemEditor items={items} onChange={setItems} gstMode={gstMode} taxRates={db.settings.taxRates} showCost={false} />
          </View>

          <Card style={{ marginTop: spacing.lg, gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Input label={`Discount ${discountIsPercent ? '(%)' : '(₹)'}`} value={discountAmount} onChangeText={setDiscountAmount} keyboardType="numeric" placeholder="0" /></View>
              <Pressable onPress={() => setDiscountIsPercent((v) => !v)} style={[styles.pctToggle, discountIsPercent && styles.pctToggleActive]}>
                <Text style={[styles.pctText, discountIsPercent && { color: '#fff' }]}>{discountIsPercent ? '%' : '₹'}</Text>
              </Pressable>
            </View>
          </Card>

          <Card style={[styles.totalsCard, { marginTop: spacing.lg }]}>
            <Row label="Gross" value={formatINR(totals.gross)} />
            {totals.discount > 0 && <Row label="Discount" value={`- ${formatINR(totals.discount)}`} />}
            {gstMode && <Row label="Tax" value={formatINR(totals.tax)} />}
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Total</Text>
              <Text style={styles.netValue}>{formatINR(totals.net)}</Text>
            </View>
          </Card>

          <Button title={editId ? 'Update quotation' : 'Create quotation'} icon="checkmark-done" onPress={save} loading={saving} full style={{ marginTop: spacing.xl }} />
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
  segmentActive: { backgroundColor: colors.violet },
  segmentText: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggleLabel: { ...font.body, color: colors.text, fontWeight: '700' },
  toggleSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
  pctToggle: { width: 48, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pctToggleActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  pctText: { ...font.h3, color: colors.textMuted },
  totalsCard: { backgroundColor: colors.tintViolet, borderColor: 'transparent' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { ...font.body, color: colors.textMuted },
  rowValue: { ...font.body, color: colors.text, fontWeight: '700' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderStrong },
  netLabel: { ...font.h3, color: colors.text },
  netValue: { fontSize: 22, fontWeight: '800', color: colors.violet },
})
