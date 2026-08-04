import React, { useMemo } from 'react'
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { quoteTotals, lineTotal, docUsesGst, recipientInterState } from '../lib/calc'
import { amountInWords, formatDate, formatINR } from '../lib/format'
import type { QuoteStatus } from '../lib/types'
import { colors, font, radius, spacing } from '../theme'
import { Button, Card, IconBadge, SectionTitle, StatusPill, useConfirm, useToast } from '../components/ui'
import { Select } from '../components/Select'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
const STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired']

export function QuoteDetailScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'QuoteDetail'>>()
  const { db, setQuoteStatus, deleteQuote, convertQuoteToBill } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()

  const quote = db.quotations.find((q) => q.id === route.params.id)
  const company = db.companies.find((c) => c.id === quote?.companyId)
  const t = useMemo(() => (quote ? quoteTotals(quote, company) : null), [quote, company])

  if (!quote || !t) {
    return (
      <View style={{ flex: 1 }}>
        <GradientHeader title="Quotation" showCompany={false} onBack={() => nav.goBack()} />
        <Text style={{ padding: 24, color: colors.textMuted }}>This quotation no longer exists.</Text>
      </View>
    )
  }

  const gst = docUsesGst(company, quote.gstEnabled)
  const inter = recipientInterState(company, quote.customerGstin)

  const convert = async () => {
    if (quote.status === 'Converted') return toast('Already converted', 'info')
    if (await confirm('Convert this quotation into a finalized bill?')) {
      const bill = convertQuoteToBill(quote.id)
      toast('Converted to bill')
      nav.navigate('BillDetail', { id: bill.id })
    }
  }

  const shareText = async () => {
    const lines = quote.items.map((it) => `• ${it.description} — ${it.qty} × ${formatINR(it.rate)} = ${formatINR(lineTotal(it))}`).join('\n')
    const msg = `${company?.name}\nQuotation ${quote.companyQuoteNo} · ${formatDate(quote.date)}\nFor: ${quote.customerName}\n\n${lines}\n\nTotal: ${formatINR(t.net)}${quote.validUntil ? `\nValid until: ${formatDate(quote.validUntil)}` : ''}`
    try { await Share.share({ message: msg }) } catch { /* cancelled */ }
  }

  const doDelete = async () => {
    if (await confirm('Move this quotation to the recycle bin?', true)) { deleteQuote(quote.id); toast('Deleted', 'info'); nav.goBack() }
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title={quote.companyQuoteNo} subtitle={company?.name} showCompany={false} onBack={() => nav.goBack()}
        right={<Pressable onPress={shareText} hitSlop={8} style={styles.headerBtn}><Ionicons name="share-social" size={18} color="#fff" /></Pressable>} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.heroLabel}>Quotation total</Text>
              <Text style={styles.heroAmount}>{formatINR(t.net)}</Text>
              <Text style={styles.words}>{amountInWords(t.net)}</Text>
            </View>
            <StatusPill status={quote.status} />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconBadge icon="person" color={colors.cyan} bg={colors.tintCyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.custName}>{quote.customerName || 'No customer'}</Text>
              {!!quote.customerPhone && <Text style={styles.custMeta}>{quote.customerPhone}</Text>}
              {!!quote.customerAddress && <Text style={styles.custMeta}>{quote.customerAddress}</Text>}
            </View>
          </View>
          <View style={styles.metaRow}>
            <Meta label="Date" value={formatDate(quote.date)} />
            {quote.validUntil ? <Meta label="Valid until" value={formatDate(quote.validUntil)} /> : null}
          </View>
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <SectionTitle title={`Items (${quote.items.length})`} />
          <Card padded={false}>
            {quote.items.map((it, i) => (
              <View key={it.id} style={[styles.itemRow, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDesc}>{it.description || '—'}</Text>
                  <Text style={styles.itemMeta}>{it.qty} × {formatINR(it.rate)}{gst && it.taxRate ? ` · ${it.taxRate}% GST` : ''}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatINR(lineTotal(it))}</Text>
              </View>
            ))}
          </Card>
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <Row label="Gross" value={formatINR(t.gross)} />
          {t.discount > 0 && <Row label="Discount" value={`- ${formatINR(t.discount)}`} />}
          {gst && <Row label={inter ? 'IGST' : 'CGST+SGST'} value={formatINR(t.tax)} />}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{formatINR(t.net)}</Text>
          </View>
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <SectionTitle title="Status" />
          <Select value={quote.status} options={STATUSES.map((s) => ({ label: s, value: s }))} onChange={(s) => { setQuoteStatus(quote.id, s as QuoteStatus); toast(`Marked ${s}`) }} />
        </View>

        <View style={styles.actionGrid}>
          {quote.status !== 'Converted' && <Button title="Convert to bill" icon="swap-horizontal" onPress={convert} style={{ flex: 1, minWidth: 150 }} />}
          <Button title="Edit" icon="create-outline" variant="outline" onPress={() => nav.navigate('QuoteForm', { id: quote.id })} style={{ flex: 1, minWidth: 150 }} />
          <Button title="Delete" icon="trash-outline" variant="danger" onPress={doDelete} style={{ flex: 1, minWidth: 150 }} />
        </View>
        {quote.convertedBillId ? (
          <Pressable style={styles.convertedLink} onPress={() => nav.navigate('BillDetail', { id: quote.convertedBillId! })}>
            <Ionicons name="link" size={15} color={colors.brand} />
            <Text style={styles.convertedText}>View the bill created from this quote →</Text>
          </Pressable>
        ) : null}
        <View style={{ height: 40 }} />
      </ScrollView>
      {node}
    </View>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1 }}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{value}</Text></View>
}
function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.totalLine}><Text style={styles.totalLineLabel}>{label}</Text><Text style={styles.totalLineValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md },
  headerBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { ...font.small, color: colors.textMuted },
  heroAmount: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 2 },
  words: { fontSize: 11.5, color: colors.textFaint, marginTop: 4, maxWidth: 220, fontStyle: 'italic' },
  custName: { ...font.h3, color: colors.text },
  custMeta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', marginTop: 14, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  metaLabel: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  metaValue: { ...font.small, color: colors.text, fontWeight: '700', marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemDesc: { ...font.body, color: colors.text, fontWeight: '600' },
  itemMeta: { ...font.small, color: colors.textFaint, marginTop: 2 },
  itemTotal: { ...font.body, color: colors.text, fontWeight: '800' },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLineLabel: { ...font.body, color: colors.textMuted },
  totalLineValue: { ...font.body, color: colors.text, fontWeight: '600' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  grandLabel: { ...font.h3, color: colors.text },
  grandValue: { fontSize: 22, fontWeight: '800', color: colors.violet },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.xl },
  convertedLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, backgroundColor: colors.tintIndigo, padding: 12, borderRadius: radius.md },
  convertedText: { ...font.small, color: colors.brand, fontWeight: '700' },
})
