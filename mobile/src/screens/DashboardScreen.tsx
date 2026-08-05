import React, { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useScopedBills, useScopedQuotes, useStore } from '../lib/store'
import { billTotals, quoteTotals } from '../lib/calc'
import { daysBetween, formatDate, formatINR } from '../lib/format'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Card, EmptyState, IconBadge, KpiCard, SectionTitle, StatusPill } from '../components/ui'
import { GradientHeader } from '../components/Header'
import { PaymentReminder, type ReminderTarget } from '../components/PaymentReminder'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Metric = 'billed' | 'received' | 'outstanding' | 'quotes'

export function DashboardScreen() {
  const nav = useNavigation<Nav>()
  const { db, activeCompanyId, syncError } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const bills = useScopedBills()
  const quotes = useScopedQuotes()
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null)
  const [detail, setDetail] = useState<Metric | null>(null)

  const company = (id: string) => db.companies.find((c) => c.id === id)

  const data = useMemo(() => {
    const finalized = bills.filter((b) => b.docStatus === 'Finalized')
    let totalBilled = 0, totalReceived = 0, outstanding = 0
    const pending: { id: string; no: string; customer: string; balance: number; age: number; status: string }[] = []
    const billed: { id: string; no: string; customer: string; net: number; date: string }[] = []
    const payments: { id: string; no: string; customer: string; amount: number; mode: string; date: string }[] = []
    for (const b of finalized) {
      const t = billTotals(b, company(b.companyId))
      totalBilled += t.net; totalReceived += t.received; outstanding += t.balance
      billed.push({ id: b.id, no: b.companyBillNo, customer: b.customerName, net: t.net, date: b.date })
      for (const p of b.payments) payments.push({ id: `${b.id}-${p.id}`, no: b.companyBillNo, customer: b.customerName, amount: p.amount, mode: p.mode ?? '—', date: p.date })
      if (t.balance > 0.001) pending.push({ id: b.id, no: b.companyBillNo, customer: b.customerName, balance: t.balance, age: daysBetween(b.date), status: t.status })
    }
    pending.sort((a, b) => b.age - a.age)
    billed.sort((a, b) => (a.date < b.date ? 1 : -1))
    payments.sort((a, b) => (a.date < b.date ? 1 : -1))
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const p of pending) {
      if (p.age <= 30) buckets['0-30'] += p.balance
      else if (p.age <= 60) buckets['31-60'] += p.balance
      else if (p.age <= 90) buckets['61-90'] += p.balance
      else buckets['90+'] += p.balance
    }
    return { totalBilled, totalReceived, outstanding, pending, billed, payments, buckets }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, db.companies])

  const activeQuotesList = useMemo(
    () => quotes.filter((q) => q.status === 'Sent' || q.status === 'Draft')
      .map((q) => ({ id: q.id, no: q.companyQuoteNo, customer: q.customerName, net: quoteTotals(q, company(q.companyId)).net, status: q.status }))
      .sort((a, b) => (a.no < b.no ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes, db.companies],
  )

  const remindersDue = useMemo(() => {
    const map = new Map<string, { key: string; customerId?: string; name: string; phone: string; total: number; count: number; oldestAge: number }>()
    for (const b of bills) {
      if (b.docStatus !== 'Finalized') continue
      const t = billTotals(b, company(b.companyId))
      if (t.balance <= 0.001) continue
      const key = b.customerId ?? `${b.customerName}|${b.customerPhone}`
      const cur = map.get(key) ?? { key, customerId: b.customerId, name: b.customerName, phone: b.customerPhone, total: 0, count: 0, oldestAge: 0 }
      cur.total += t.balance; cur.count += 1; cur.oldestAge = Math.max(cur.oldestAge, daysBetween(b.date))
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.oldestAge - a.oldestAge)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, db.companies])

  const bucketMax = Math.max(1, ...Object.values(data.buckets))
  const bucketMeta = [
    { key: '0-30', label: '0–30d', color: colors.success },
    { key: '31-60', label: '31–60d', color: colors.warning },
    { key: '61-90', label: '61–90d', color: '#f97316' },
    { key: '90+', label: '90+d', color: colors.danger },
  ] as const

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Dashboard" subtitle={activeCompanyId === 'ALL' ? 'All companies · consolidated' : company(activeCompanyId)?.name} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {syncError ? (
          <View style={styles.syncBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.dangerDark} />
            <Text style={styles.syncText}>{syncError}</Text>
          </View>
        ) : null}

        <Text style={styles.hint}>Tap a card for a detailed breakdown</Text>
        <View style={styles.kpiRow}>
          <KpiCard label="Total Billed" value={formatINR(data.totalBilled)} icon="cash-outline" gradient={colors.gradBlue} onPress={() => setDetail('billed')} />
          <KpiCard label="Received" value={formatINR(data.totalReceived)} icon="wallet-outline" gradient={colors.gradEmerald} onPress={() => setDetail('received')} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard label="Outstanding" value={formatINR(data.outstanding)} sub={`${data.pending.length} pending`} icon="alert-circle-outline" gradient={colors.gradRose} onPress={() => setDetail('outstanding')} />
          <KpiCard label="Active Quotes" value={String(activeQuotesList.length)} sub={`${quotes.length} total`} icon="trending-up-outline" gradient={colors.gradViolet} onPress={() => setDetail('quotes')} />
        </View>

        {/* Aging buckets */}
        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle title="Outstanding by age" />
          {data.outstanding === 0 ? (
            <Text style={styles.allClear}>No outstanding balances 🎉</Text>
          ) : (
            <View style={{ gap: 10, marginTop: 4 }}>
              {bucketMeta.map((m) => {
                const v = data.buckets[m.key as keyof typeof data.buckets]
                return (
                  <View key={m.key} style={styles.bucketRow}>
                    <Text style={styles.bucketLabel}>{m.label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(v / bucketMax) * 100}%`, backgroundColor: m.color }]} />
                    </View>
                    <Text style={styles.bucketValue}>{formatINR(v)}</Text>
                  </View>
                )
              })}
            </View>
          )}
        </Card>

        {/* Pending bills */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionTitle title="Pending bills" action={<Pressable onPress={() => nav.navigate('Reports')}><Text style={styles.link}>Receivables →</Text></Pressable>} />
          <Card padded={false}>
            {data.pending.length === 0 ? (
              <EmptyState icon="checkmark-done-outline" title="All settled" subtitle="No pending bills right now." />
            ) : (
              data.pending.slice(0, 6).map((p, i) => (
                <Pressable key={p.id} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => nav.navigate('BillDetail', { id: p.id })}>
                  <IconBadge icon="receipt-outline" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{p.no}</Text>
                    <Text style={styles.rowSub}>{p.customer} · {p.age}d old</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.rowAmount}>{formatINR(p.balance)}</Text>
                    <StatusPill status={p.status} />
                  </View>
                </Pressable>
              ))
            )}
          </Card>
        </View>

        {/* Reminders due */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionTitle title="Reminders due" action={<Text style={styles.muted}>{remindersDue.length} owe</Text>} />
          <Card padded={false}>
            {remindersDue.length === 0 ? (
              <EmptyState icon="notifications-off-outline" title="Nothing to chase" subtitle="All bills settled. 🎉" />
            ) : (
              remindersDue.slice(0, 8).map((r, i) => (
                <View key={r.key} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <IconBadge icon="person-outline" color={colors.warning} bg={colors.tintAmber} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{r.name}</Text>
                    <Text style={styles.rowSub}>{r.count} bill{r.count === 1 ? '' : 's'} · {r.oldestAge}d · {formatINR(r.total)}</Text>
                  </View>
                  <Pressable style={styles.remindBtn} onPress={() => setReminderTarget({ customerId: r.customerId, customerName: r.name, customerPhone: r.phone })}>
                    <Ionicons name="notifications-outline" size={15} color={colors.warning} />
                    <Text style={styles.remindText}>Remind</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <DetailModal
        metric={detail}
        onClose={() => setDetail(null)}
        data={data}
        quotes={activeQuotesList}
        onOpenBill={(id) => { setDetail(null); nav.navigate('BillDetail', { id }) }}
        onOpenQuote={(id) => { setDetail(null); nav.navigate('QuoteDetail', { id }) }}
      />
      <PaymentReminder open={!!reminderTarget} onClose={() => setReminderTarget(null)} target={reminderTarget} />
    </View>
  )
}

/* --------------------------- KPI detail modal --------------------------- */
function DetailModal({ metric, onClose, data, quotes, onOpenBill, onOpenQuote }: {
  metric: Metric | null
  onClose: () => void
  data: { totalBilled: number; totalReceived: number; outstanding: number; billed: any[]; payments: any[]; pending: any[] }
  quotes: any[]
  onOpenBill: (id: string) => void
  onOpenQuote: (id: string) => void
}) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const meta = {
    billed: { title: 'Total Billed', total: data.totalBilled, icon: 'cash' as const },
    received: { title: 'Payments Received', total: data.totalReceived, icon: 'wallet' as const },
    outstanding: { title: 'Outstanding', total: data.outstanding, icon: 'alert-circle' as const },
    quotes: { title: 'Active Quotations', total: quotes.reduce((s, q) => s + q.net, 0), icon: 'trending-up' as const },
  }
  const m = metric ? meta[metric] : null

  return (
    <Modal transparent visible={!!metric} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          {m && (
            <>
              <View style={styles.sheetHead}>
                <IconBadge icon={m.icon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{m.title}</Text>
                  <Text style={styles.sheetTotal}>{formatINR(m.total)}</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textFaint} /></Pressable>
              </View>
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {metric === 'billed' && (data.billed.length ? data.billed.map((r) => (
                  <DRow key={r.id} onPress={() => onOpenBill(r.id)} title={r.no} sub={`${r.customer} · ${formatDate(r.date)}`} value={formatINR(r.net)} />
                )) : <Empty />)}
                {metric === 'received' && (data.payments.length ? data.payments.map((r) => (
                  <DRow key={r.id} title={r.no} sub={`${r.customer} · ${r.mode} · ${formatDate(r.date)}`} value={formatINR(r.amount)} valueColor={colors.success} />
                )) : <Empty />)}
                {metric === 'outstanding' && (data.pending.length ? data.pending.map((r) => (
                  <DRow key={r.id} onPress={() => onOpenBill(r.id)} title={r.no} sub={`${r.customer} · ${r.age}d old`} value={formatINR(r.balance)} valueColor={colors.danger} />
                )) : <Empty />)}
                {metric === 'quotes' && (quotes.length ? quotes.map((r) => (
                  <DRow key={r.id} onPress={() => onOpenQuote(r.id)} title={r.no} sub={`${r.customer} · ${r.status}`} value={formatINR(r.net)} />
                )) : <Empty />)}
                <View style={{ height: 16 }} />
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function DRow({ title, sub, value, valueColor, onPress }: { title: string; sub: string; value: string; valueColor?: string; onPress?: () => void }) {
  const styles = useStyles(makeStyles)
  const { colors } = useTheme()
  return (
    <Pressable style={styles.dRow} onPress={onPress} disabled={!onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.dTitle}>{title}</Text>
        <Text style={styles.dSub}>{sub}</Text>
      </View>
      <Text style={[styles.dValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} style={{ marginLeft: 6 }} /> : null}
    </Pressable>
  )
}
function Empty() {
  return <EmptyState icon="file-tray-outline" title="Nothing here yet" subtitle="Records will appear as you add bills." />
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: 96 },
  syncBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.tintRose, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  syncText: { flex: 1, color: colors.dangerDark, fontSize: 12.5, fontWeight: '600' },
  hint: { ...font.tiny, color: colors.textFaint, marginBottom: 8, marginLeft: 2 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  allClear: { ...font.body, color: colors.success, paddingVertical: 10 },
  bucketRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bucketLabel: { ...font.small, color: colors.textMuted, width: 52 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.bgDeep, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  bucketValue: { ...font.small, color: colors.text, fontWeight: '700', width: 78, textAlign: 'right' },
  link: { ...font.small, color: colors.brand, fontWeight: '700' },
  muted: { ...font.small, color: colors.textFaint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  rowSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
  rowAmount: { ...font.body, color: colors.danger, fontWeight: '800' },
  remindBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.tintAmber, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  remindText: { ...font.small, color: colors.warning, fontWeight: '700' },
  // detail modal
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 30, maxHeight: '88%', ...shadow.float },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  sheetTitle: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  sheetTotal: { ...font.h1, color: colors.text, fontSize: 24 },
  dRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  dSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
  dValue: { ...font.body, color: colors.text, fontWeight: '800' },
})
