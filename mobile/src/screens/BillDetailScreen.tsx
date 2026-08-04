import React, { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { billTotals, lineTotal, docUsesGst, recipientInterState } from '../lib/calc'
import { amountInWords, formatDate, formatINR, todayISO } from '../lib/format'
import { colors, font, radius, shadow, spacing } from '../theme'
import { Button, Card, IconBadge, Input, SectionTitle, StatusPill, useConfirm, useToast } from '../components/ui'
import { GradientHeader } from '../components/Header'
import { UpiQr } from '../components/UpiQr'
import { PaymentReminder, type ReminderTarget } from '../components/PaymentReminder'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function BillDetailScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'BillDetail'>>()
  const { db, recordPayment, deleteBill, duplicateBill, updateBill, createBill } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()

  const bill = db.bills.find((b) => b.id === route.params.id)
  const company = db.companies.find((c) => c.id === bill?.companyId)
  const t = useMemo(() => (bill ? billTotals(bill, company) : null), [bill, company])

  const [payOpen, setPayOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [remind, setRemind] = useState<ReminderTarget | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('UPI')

  if (!bill || !t) {
    return (
      <View style={{ flex: 1 }}>
        <GradientHeader title="Bill" showCompany={false} onBack={() => nav.goBack()} />
        <Text style={{ padding: 24, color: colors.textMuted }}>This bill no longer exists.</Text>
      </View>
    )
  }

  const gst = docUsesGst(company, bill.gstEnabled)
  const inter = recipientInterState(company, bill.customerGstin)

  const finalize = async () => {
    if (bill.docStatus === 'Finalized') return
    if (await confirm('Finalize this bill? It will be assigned a permanent invoice number.')) {
      updateBill(bill.id, toDraft(bill), true)
      toast('Bill finalized')
    }
  }

  const savePayment = () => {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) return toast('Enter a valid amount', 'error')
    recordPayment(bill.id, { date: todayISO(), amount: amt, mode: payMode })
    setPayOpen(false); setPayAmount(''); toast('Payment recorded')
  }

  const shareText = async () => {
    const lines = bill.items.map((it) => `• ${it.description} — ${it.qty} × ${formatINR(it.rate)} = ${formatINR(lineTotal(it))}`).join('\n')
    const msg = `${company?.name}\nInvoice ${bill.companyBillNo} · ${formatDate(bill.date)}\nTo: ${bill.customerName}\n\n${lines}\n\nTotal: ${formatINR(t.net)}\nReceived: ${formatINR(t.received)}\nBalance: ${formatINR(t.balance)}\n\n${amountInWords(t.net)}`
    try { await Share.share({ message: msg }) } catch { /* cancelled */ }
  }

  const doDelete = async () => {
    if (await confirm('Move this bill to the recycle bin?', true)) { deleteBill(bill.id); toast('Bill deleted', 'info'); nav.goBack() }
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader
        title={bill.docStatus === 'Draft' ? 'Draft bill' : bill.companyBillNo}
        subtitle={company?.name}
        showCompany={false}
        onBack={() => nav.goBack()}
        right={<Pressable onPress={shareText} hitSlop={8} style={styles.headerBtn}><Ionicons name="share-social" size={18} color="#fff" /></Pressable>}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status + amount hero */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.heroLabel}>Total amount</Text>
              <Text style={styles.heroAmount}>{formatINR(t.net)}</Text>
              <Text style={styles.words}>{amountInWords(t.net)}</Text>
            </View>
            <StatusPill status={bill.docStatus === 'Draft' ? 'Draft' : t.status} />
          </View>
          {t.balance > 0.001 && (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceText}>Balance due: <Text style={{ fontWeight: '800' }}>{formatINR(t.balance)}</Text></Text>
            </View>
          )}
        </Card>

        {/* Customer */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconBadge icon="person" color={colors.cyan} bg={colors.tintCyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.custName}>{bill.customerName || 'No customer'}</Text>
              {!!bill.customerPhone && <Text style={styles.custMeta}>{bill.customerPhone}</Text>}
              {!!bill.customerAddress && <Text style={styles.custMeta}>{bill.customerAddress}</Text>}
              {!!bill.customerGstin && <Text style={styles.custMeta}>GSTIN: {bill.customerGstin}</Text>}
            </View>
          </View>
          <View style={styles.metaRow}>
            <Meta label="Date" value={formatDate(bill.date)} />
            <Meta label="Type" value={bill.billType ?? 'Online'} />
            {gst && <Meta label="GST" value={inter ? 'IGST' : 'CGST+SGST'} />}
          </View>
        </Card>

        {/* Items */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionTitle title={`Items (${bill.items.length})`} />
          <Card padded={false}>
            {bill.items.map((it, i) => (
              <View key={it.id} style={[styles.itemRow, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemDesc}>{it.description || '—'}</Text>
                  <Text style={styles.itemMeta}>{it.qty} × {formatINR(it.rate)}{gst && it.taxRate ? ` · ${it.taxRate}% GST${it.hsnSac ? ` · ${it.hsnSac}` : ''}` : ''}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatINR(lineTotal(it))}</Text>
              </View>
            ))}
          </Card>
        </View>

        {/* Totals */}
        <Card style={{ marginTop: spacing.lg }}>
          <TotalLine label="Gross" value={formatINR(t.gross)} />
          {t.discount > 0 && <TotalLine label="Discount" value={`- ${formatINR(t.discount)}`} />}
          <TotalLine label="Taxable" value={formatINR(t.taxable)} />
          {gst && !inter && (<><TotalLine label="CGST" value={formatINR(t.cgst)} /><TotalLine label="SGST" value={formatINR(t.sgst)} /></>)}
          {gst && inter && <TotalLine label="IGST" value={formatINR(t.igst)} />}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Net Total</Text>
            <Text style={styles.grandValue}>{formatINR(t.net)}</Text>
          </View>
          <TotalLine label="Received" value={formatINR(t.received)} valueColor={colors.success} />
          <TotalLine label="Balance" value={formatINR(t.balance)} valueColor={t.balance > 0.001 ? colors.danger : colors.success} bold />
        </Card>

        {/* Payments history */}
        {bill.payments.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle title="Payments" />
            <Card padded={false}>
              {bill.payments.map((p, i) => (
                <View key={p.id} style={[styles.itemRow, i > 0 && styles.rowBorder]}>
                  <IconBadge icon="wallet" color={colors.success} bg={colors.tintEmerald} size={34} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.itemDesc}>{formatINR(p.amount)}</Text>
                    <Text style={styles.itemMeta}>{p.mode} · {formatDate(p.date)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionGrid}>
          {bill.docStatus === 'Draft' && <Button title="Finalize" icon="checkmark-done" onPress={finalize} style={{ flex: 1, minWidth: 150 }} />}
          <Button title="Edit" icon="create-outline" variant="outline" onPress={() => nav.navigate('BillForm', { id: bill.id })} style={{ flex: 1, minWidth: 150 }} />
          {t.balance > 0.001 && <Button title="Record payment" icon="add-circle-outline" variant="success" onPress={() => setPayOpen(true)} style={{ flex: 1, minWidth: 150 }} />}
          {t.balance > 0.001 && company?.upiId && <Button title="Pay QR" icon="qr-code-outline" variant="outline" onPress={() => setQrOpen(true)} style={{ flex: 1, minWidth: 150 }} />}
          {t.balance > 0.001 && <Button title="Remind" icon="notifications-outline" variant="outline" onPress={() => setRemind({ customerId: bill.customerId, customerName: bill.customerName, customerPhone: bill.customerPhone })} style={{ flex: 1, minWidth: 150 }} />}
          <Button title="Duplicate" icon="copy-outline" variant="ghost" onPress={() => { const c = duplicateBill(bill.id); toast('Duplicated as draft'); nav.replace('BillDetail', { id: c.id }) }} style={{ flex: 1, minWidth: 150 }} />
          <Button title="Delete" icon="trash-outline" variant="danger" onPress={doDelete} style={{ flex: 1, minWidth: 150 }} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Record payment modal */}
      <Modal transparent visible={payOpen} animationType="fade" onRequestClose={() => setPayOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPayOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Record payment</Text>
            <Text style={styles.modalSub}>Balance due {formatINR(t.balance)}</Text>
            <View style={{ gap: 12, marginTop: 14 }}>
              <Input label="Amount" keyboardType="numeric" value={payAmount} onChangeText={setPayAmount} placeholder={String(t.balance)} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['UPI', 'Cash', 'Bank', 'Card'].map((m) => (
                  <Pressable key={m} onPress={() => setPayMode(m)} style={[styles.modeChip, payMode === m && styles.modeChipActive]}>
                    <Text style={[styles.modeText, payMode === m && { color: '#fff' }]}>{m}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setPayAmount(String(t.balance))}><Text style={styles.fullLink}>Pay full balance</Text></Pressable>
              <Button title="Save payment" icon="checkmark" onPress={savePayment} full />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pay QR modal */}
      <Modal transparent visible={qrOpen} animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setQrOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {company?.upiId && <UpiQr upiId={company.upiId} payeeName={company.payeeName ?? company.name} amount={t.balance} note={`Invoice ${bill.companyBillNo}`} />}
            <Button title="Close" variant="outline" onPress={() => setQrOpen(false)} full style={{ marginTop: 16 }} />
          </Pressable>
        </Pressable>
      </Modal>

      <PaymentReminder open={!!remind} onClose={() => setRemind(null)} target={remind} />
      {node}
    </View>
  )
}

// Build a BillDraft from a bill (for finalize/update).
function toDraft(b: NonNullable<ReturnType<typeof Object>> & any) {
  return {
    companyId: b.companyId, date: b.date, customerType: b.customerType, customerId: b.customerId,
    customerName: b.customerName, customerAddress: b.customerAddress, customerPhone: b.customerPhone, customerGstin: b.customerGstin,
    items: b.items, discountAmount: b.discountAmount, discountIsPercent: b.discountIsPercent, receivedAmount: b.receivedAmount,
    gstEnabled: b.gstEnabled, originalCost: b.originalCost, billType: b.billType, handbookId: b.handbookId, handBookNo: b.handBookNo, handBillNo: b.handBillNo,
  }
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}
function TotalLine({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <View style={styles.totalLine}>
      <Text style={[styles.totalLineLabel, bold && { fontWeight: '800', color: colors.text }]}>{label}</Text>
      <Text style={[styles.totalLineValue, valueColor ? { color: valueColor } : null, bold && { fontWeight: '800' }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md },
  headerBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { ...font.small, color: colors.textMuted },
  heroAmount: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 2 },
  words: { fontSize: 11.5, color: colors.textFaint, marginTop: 4, maxWidth: 220, fontStyle: 'italic' },
  balanceRow: { marginTop: 12, backgroundColor: colors.tintRose, borderRadius: radius.md, padding: 10 },
  balanceText: { color: colors.dangerDark, fontSize: 13, fontWeight: '600' },
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
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  grandLabel: { ...font.h3, color: colors.text },
  grandValue: { fontSize: 22, fontWeight: '800', color: colors.brand },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.xl },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 380, ...shadow.float },
  modalTitle: { ...font.h2, color: colors.text },
  modalSub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  modeChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  modeChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  modeText: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  fullLink: { ...font.small, color: colors.brand, fontWeight: '700', textAlign: 'right' },
})
