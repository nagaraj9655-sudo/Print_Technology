import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useScopedBills, useScopedQuotes, useStore } from '../lib/store'
import { billTotals, costBasis, quoteTotals } from '../lib/calc'
import { daysBetween, formatDate, formatINR } from '../lib/format'
import { colors, font, radius, shadow, spacing } from '../theme'
import { Card, EmptyState } from '../components/ui'
import { Select } from '../components/Select'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Tab = 'sales' | 'receivables' | 'payments' | 'profit' | 'quotes' | 'statement' | 'company' | 'gst'
const TABS: { key: Tab; label: string }[] = [
  { key: 'sales', label: 'Sales' }, { key: 'receivables', label: 'Receivables' }, { key: 'payments', label: 'Payments' },
  { key: 'profit', label: 'Profit' }, { key: 'quotes', label: 'Quotes' }, { key: 'statement', label: 'Statement' },
  { key: 'company', label: 'Company' }, { key: 'gst', label: 'GST' },
]

export function ReportsScreen() {
  const nav = useNavigation<Nav>()
  const { db, activeCompanyId } = useStore()
  const bills = useScopedBills()
  const quotes = useScopedQuotes()
  const [tab, setTab] = useState<Tab>('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [customerId, setCustomerId] = useState('')

  const company = (id: string) => db.companies.find((c) => c.id === id)
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to)
  const finalized = bills.filter((b) => b.docStatus === 'Finalized' && inRange(b.date))

  const share = async (title: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c)}"`).join(','))].join('\n')
    try { await Share.share({ message: `${title}\n\n${csv}` }) } catch { /* cancelled */ }
  }

  const scopeLabel = activeCompanyId === 'ALL' ? 'All companies' : company(activeCompanyId)?.name

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Reports" subtitle={scopeLabel} onBack={() => nav.goBack()} />

      <View style={styles.tabsWrap}>
        <FlatList
          data={TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(t) => t.key}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>From</Text>
            <TextInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textFaint} style={styles.filterInput} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>To</Text>
            <TextInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textFaint} style={styles.filterInput} autoCapitalize="none" />
          </View>
        </View>

        {tab === 'statement' && (
          <View style={{ marginBottom: spacing.md }}>
            <Select label="Customer" value={customerId} placeholder="Select customer…" options={db.customers.map((c) => ({ label: c.name, value: c.id }))} onChange={setCustomerId} />
          </View>
        )}

        {tab === 'sales' && <Sales rows={finalized.map((b) => ({ b, t: billTotals(b, company(b.companyId)) }))} onShare={share} companyName={(id) => company(id)?.name ?? ''} />}
        {tab === 'receivables' && <Receivables rows={finalized.map((b) => ({ b, t: billTotals(b, company(b.companyId)), age: daysBetween(b.date) })).filter((r) => r.t.balance > 0.001).sort((a, b) => b.age - a.age)} onShare={share} />}
        {tab === 'payments' && <Payments bills={finalized} companyName={(id) => company(id)?.name ?? ''} onShare={share} />}
        {tab === 'profit' && <Profit bills={finalized} company={company} onShare={share} />}
        {tab === 'quotes' && <Quotes quotes={quotes.filter((q) => inRange(q.date))} company={company} onShare={share} />}
        {tab === 'statement' && <Statement bills={bills.filter((b) => b.docStatus === 'Finalized')} customerId={customerId} company={company} customer={db.customers.find((c) => c.id === customerId)} onShare={share} />}
        {tab === 'company' && <CompanySummary companies={db.companies} finalized={finalized} onShare={share} />}
        {tab === 'gst' && <Gst companies={db.companies} finalized={finalized} onShare={share} />}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

type ShareFn = (title: string, headers: string[], rows: (string | number)[][]) => void

function TableCard({ title, total, onShare, children }: { title: string; total?: string; onShare?: () => void; children: React.ReactNode }) {
  return (
    <Card padded={false} style={{ marginBottom: spacing.md }}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {onShare && <Pressable onPress={onShare} style={styles.shareBtn}><Ionicons name="share-outline" size={14} color={colors.brand} /><Text style={styles.shareText}>Share</Text></Pressable>}
      </View>
      {children}
      {total ? <View style={styles.totalFoot}><Text style={styles.totalFootLabel}>Total</Text><Text style={styles.totalFootValue}>{total}</Text></View> : null}
    </Card>
  )
}
function LineRow({ a, b, c, danger, good }: { a: string; b: string; c: string; danger?: boolean; good?: boolean }) {
  return (
    <View style={styles.lineRow}>
      <View style={{ flex: 1 }}><Text style={styles.lineA}>{a}</Text><Text style={styles.lineB}>{b}</Text></View>
      <Text style={[styles.lineC, danger && { color: colors.danger }, good && { color: colors.success }]}>{c}</Text>
    </View>
  )
}
const empty = <EmptyState icon="analytics-outline" title="No data" subtitle="Nothing matches this filter." />

function Sales({ rows, onShare, companyName }: { rows: { b: any; t: any }[]; onShare: ShareFn; companyName: (id: string) => string }) {
  const total = rows.reduce((s, r) => s + r.t.net, 0)
  if (!rows.length) return empty
  return (
    <TableCard title="Sales register" total={formatINR(total)} onShare={() => onShare('Sales Register', ['Invoice', 'Date', 'Customer', 'Net'], rows.map((r) => [r.b.companyBillNo, r.b.date, r.b.customerName, r.t.net]))}>
      {rows.map((r) => <LineRow key={r.b.id} a={r.b.companyBillNo} b={`${formatDate(r.b.date)} · ${r.b.customerName}`} c={formatINR(r.t.net)} />)}
    </TableCard>
  )
}
function Receivables({ rows, onShare }: { rows: { b: any; t: any; age: number }[]; onShare: ShareFn }) {
  const total = rows.reduce((s, r) => s + r.t.balance, 0)
  if (!rows.length) return empty
  return (
    <TableCard title="Outstanding / receivables" total={formatINR(total)} onShare={() => onShare('Receivables', ['Invoice', 'Customer', 'Balance', 'Age'], rows.map((r) => [r.b.companyBillNo, r.b.customerName, r.t.balance, r.age]))}>
      {rows.map((r) => <LineRow key={r.b.id} a={r.b.companyBillNo} b={`${r.b.customerName} · ${r.age}d`} c={formatINR(r.t.balance)} danger />)}
    </TableCard>
  )
}
function Payments({ bills, companyName, onShare }: { bills: any[]; companyName: (id: string) => string; onShare: ShareFn }) {
  const rows = bills.flatMap((b) => b.payments.map((p: any) => ({ b, p }))).sort((a, b) => (a.p.date < b.p.date ? 1 : -1))
  const total = rows.reduce((s, r) => s + r.p.amount, 0)
  if (!rows.length) return empty
  return (
    <TableCard title="Payments received" total={formatINR(total)} onShare={() => onShare('Payments', ['Date', 'Invoice', 'Customer', 'Mode', 'Amount'], rows.map((r) => [r.p.date, r.b.companyBillNo, r.b.customerName, r.p.mode ?? '', r.p.amount]))}>
      {rows.map((r, i) => <LineRow key={i} a={r.b.companyBillNo} b={`${formatDate(r.p.date)} · ${r.p.mode ?? ''}`} c={formatINR(r.p.amount)} good />)}
    </TableCard>
  )
}
function Profit({ bills, company, onShare }: { bills: any[]; company: (id: string) => any; onShare: ShareFn }) {
  const rows = bills.map((b) => { const t = billTotals(b, company(b.companyId)); const cost = costBasis(b.items, b.originalCost); return { b, selling: t.taxable, cost, profit: t.taxable - cost } })
    .filter((r) => r.cost > 0).sort((a, b) => b.profit - a.profit)
  const totProfit = rows.reduce((s, r) => s + r.profit, 0)
  if (!rows.length) return <EmptyState icon="trending-up-outline" title="No cost data" subtitle="Enter a cost on bills to see profit." />
  return (
    <TableCard title="Profit / margin" total={formatINR(totProfit)} onShare={() => onShare('Profit', ['Invoice', 'Selling', 'Cost', 'Profit'], rows.map((r) => [r.b.companyBillNo, r.selling, r.cost, r.profit]))}>
      {rows.map((r) => <LineRow key={r.b.id} a={r.b.companyBillNo} b={`${r.b.customerName} · ${r.selling ? Math.round((r.profit / r.selling) * 100) : 0}%`} c={formatINR(r.profit)} good={r.profit >= 0} danger={r.profit < 0} />)}
    </TableCard>
  )
}
function Quotes({ quotes, company, onShare }: { quotes: any[]; company: (id: string) => any; onShare: ShareFn }) {
  if (!quotes.length) return empty
  const accepted = quotes.filter((q) => q.status === 'Accepted' || q.status === 'Converted').length
  const conv = Math.round((accepted / quotes.length) * 100)
  return (
    <TableCard title={`Quotations · ${conv}% conversion`} onShare={() => onShare('Quotations', ['Quote', 'Date', 'Customer', 'Total', 'Status'], quotes.map((q) => [q.companyQuoteNo, q.date, q.customerName, quoteTotals(q, company(q.companyId)).net, q.status]))}>
      {quotes.map((q) => <LineRow key={q.id} a={q.companyQuoteNo} b={`${q.customerName} · ${q.status}`} c={formatINR(quoteTotals(q, company(q.companyId)).net)} />)}
    </TableCard>
  )
}
function Statement({ bills, customerId, company, customer, onShare }: { bills: any[]; customerId: string; company: (id: string) => any; customer: any; onShare: ShareFn }) {
  const rows = useMemo(() => {
    if (!customerId) return []
    let running = 0
    return bills.filter((b) => b.customerId === customerId).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => {
      const t = billTotals(b, company(b.companyId)); running += t.balance; return { b, t, running }
    })
  }, [bills, customerId])
  if (!customerId) return <EmptyState icon="person-outline" title="Pick a customer" subtitle="Select a customer above to view their statement." />
  if (!rows.length) return empty
  return (
    <TableCard title={`Statement — ${customer?.name}`} onShare={() => onShare(`Statement ${customer?.name}`, ['Invoice', 'Date', 'Net', 'Received', 'Balance', 'Running'], rows.map((r) => [r.b.companyBillNo, r.b.date, r.t.net, r.t.received, r.t.balance, r.running]))}>
      {rows.map((r) => <LineRow key={r.b.id} a={r.b.companyBillNo} b={`${formatDate(r.b.date)} · bal ${formatINR(r.t.balance)}`} c={formatINR(r.running)} />)}
    </TableCard>
  )
}
function CompanySummary({ companies, finalized, onShare }: { companies: any[]; finalized: any[]; onShare: ShareFn }) {
  const rows = companies.map((c) => {
    const cb = finalized.filter((b) => b.companyId === c.id)
    const billed = cb.reduce((s, b) => s + billTotals(b, c).net, 0)
    const outstanding = cb.reduce((s, b) => s + billTotals(b, c).balance, 0)
    return { name: c.name, count: cb.length, billed, outstanding }
  })
  return (
    <TableCard title="Company summary" onShare={() => onShare('Company Summary', ['Company', 'Bills', 'Billed', 'Outstanding'], rows.map((r) => [r.name, r.count, r.billed, r.outstanding]))}>
      {rows.map((r) => <LineRow key={r.name} a={r.name} b={`${r.count} bills · out ${formatINR(r.outstanding)}`} c={formatINR(r.billed)} />)}
    </TableCard>
  )
}
function Gst({ companies, finalized, onShare }: { companies: any[]; finalized: any[]; onShare: ShareFn }) {
  const rows = companies.filter((c) => c.gstin).map((c) => {
    const cb = finalized.filter((b) => b.companyId === c.id)
    let taxable = 0, cgst = 0, sgst = 0, igst = 0
    for (const b of cb) { const t = billTotals(b, c); taxable += t.taxable; cgst += t.cgst; sgst += t.sgst; igst += t.igst }
    return { name: c.name, gstin: c.gstin, taxable, tax: cgst + sgst + igst }
  })
  if (!rows.length) return <EmptyState icon="document-outline" title="No GST companies" subtitle="No GST-registered companies in scope." />
  return (
    <View>
      <View style={styles.warn}><Ionicons name="warning-outline" size={15} color="#b45309" /><Text style={styles.warnText}>Working figure only — not a filed GST return.</Text></View>
      <TableCard title="GST summary" onShare={() => onShare('GST Summary', ['Company', 'GSTIN', 'Taxable', 'Tax'], rows.map((r) => [r.name, r.gstin, r.taxable, r.tax]))}>
        {rows.map((r) => <LineRow key={r.name} a={r.name} b={`Taxable ${formatINR(r.taxable)}`} c={formatINR(r.tax)} />)}
      </TableCard>
    </View>
  )
}

const styles = StyleSheet.create({
  tabsWrap: { paddingVertical: spacing.md },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  content: { paddingHorizontal: spacing.lg },
  filterRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  filterLabel: { ...font.tiny, color: colors.textMuted, marginBottom: 5 },
  filterInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cardTitle: { ...font.h3, color: colors.text, flex: 1 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.tintIndigo, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  shareText: { ...font.tiny, color: colors.brand, fontWeight: '800' },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceAlt },
  lineA: { ...font.body, color: colors.text, fontWeight: '700' },
  lineB: { ...font.small, color: colors.textFaint, marginTop: 2 },
  lineC: { ...font.body, color: colors.text, fontWeight: '800' },
  totalFoot: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surfaceAlt },
  totalFootLabel: { ...font.body, color: colors.textMuted, fontWeight: '700' },
  totalFootValue: { ...font.h3, color: colors.brand },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tintAmber, borderRadius: radius.md, padding: 10, marginBottom: spacing.md },
  warnText: { flex: 1, fontSize: 12, color: '#b45309', fontWeight: '600' },
})
