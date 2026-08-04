import React, { useMemo } from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatINR } from '../lib/format'
import { buildReminderMessage, smsLink, whatsappLink, type ReminderLine } from '../lib/payments'
import { colors, font, radius, shadow, spacing } from '../theme'
import { Button, useToast } from './ui'
import { UpiQr } from './UpiQr'

export interface ReminderTarget {
  customerId?: string
  customerName: string
  customerPhone: string
}

export function PaymentReminder({ open, onClose, target }: { open: boolean; onClose: () => void; target: ReminderTarget | null }) {
  const { db, activeCompanyId } = useStore()
  const toast = useToast()

  const info = useMemo(() => {
    if (!target) return null
    // Pending finalized bills for this customer, scoped to the active company.
    const bills = db.bills.filter((b) => {
      if (b.deletedAt || b.docStatus !== 'Finalized') return false
      if (activeCompanyId !== 'ALL' && b.companyId !== activeCompanyId) return false
      const sameCustomer = target.customerId ? b.customerId === target.customerId : b.customerName === target.customerName
      if (!sameCustomer) return false
      return billTotals(b, db.companies.find((c) => c.id === b.companyId)).balance > 0.001
    })
    const lines: ReminderLine[] = bills.map((b) => ({
      no: b.companyBillNo,
      date: b.date,
      balance: billTotals(b, db.companies.find((c) => c.id === b.companyId)).balance,
    }))
    const total = lines.reduce((s, l) => s + l.balance, 0)
    const company = db.companies.find((c) => c.id === (activeCompanyId !== 'ALL' ? activeCompanyId : bills[0]?.companyId))
    const message = buildReminderMessage({
      companyName: company?.name ?? 'Our company',
      customerName: target.customerName,
      lines, total,
      upiId: company?.upiId,
      bankDetails: company?.bankDetails,
      intro: db.settings.reminderTemplate,
    })
    return { lines, total, company, message }
  }, [target, db, activeCompanyId])

  if (!info) return null

  const openLink = async (url: string, label: string) => {
    try {
      const ok = await Linking.canOpenURL(url)
      if (!ok) return toast(`${label} not available on this device`, 'error')
      await Linking.openURL(url)
    } catch {
      toast(`Could not open ${label}`, 'error')
    }
  }

  return (
    <Modal transparent visible={open} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Payment reminder</Text>
              <Text style={styles.sub}>{target?.customerName} · {target?.customerPhone || 'no phone'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textFaint} /></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total outstanding</Text>
              <Text style={styles.totalValue}>{formatINR(info.total)}</Text>
              <Text style={styles.totalSub}>{info.lines.length} pending bill{info.lines.length === 1 ? '' : 's'}</Text>
            </View>

            {info.lines.map((l) => (
              <View key={l.no} style={styles.lineRow}>
                <Text style={styles.lineNo}>{l.no}</Text>
                <Text style={styles.lineBal}>{formatINR(l.balance)}</Text>
              </View>
            ))}

            {info.company?.upiId ? (
              <View style={styles.qrWrap}>
                <UpiQr upiId={info.company.upiId} payeeName={info.company.payeeName ?? info.company.name} amount={info.total} note={`Payment ${target?.customerName}`} size={170} />
              </View>
            ) : null}

            <Text style={styles.previewLabel}>Message preview</Text>
            <View style={styles.preview}><Text style={styles.previewText}>{info.message}</Text></View>
          </ScrollView>

          <View style={styles.actions}>
            <Button title="WhatsApp" icon="logo-whatsapp" variant="success" style={{ flex: 1 }} onPress={() => openLink(whatsappLink(target!.customerPhone, info.message), 'WhatsApp')} />
            <Button title="SMS" icon="chatbubble-ellipses" variant="outline" style={{ flex: 1 }} onPress={() => openLink(smsLink(target!.customerPhone, info.message), 'SMS')} />
            <Button title="Copy" icon="copy-outline" variant="ghost" onPress={async () => { await Clipboard.setStringAsync(info.message); toast('Message copied') }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 30, maxHeight: '92%', ...shadow.float },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { ...font.h2, color: colors.text },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  totalCard: { backgroundColor: colors.tintRose, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: 12 },
  totalLabel: { ...font.small, color: colors.dangerDark, fontWeight: '700' },
  totalValue: { fontSize: 30, fontWeight: '800', color: colors.dangerDark, marginTop: 2 },
  totalSub: { ...font.small, color: colors.danger },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#fff', borderRadius: radius.md, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  lineNo: { ...font.body, color: colors.text, fontWeight: '600' },
  lineBal: { ...font.body, color: colors.danger, fontWeight: '700' },
  qrWrap: { alignItems: 'center', marginVertical: 14, backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  previewLabel: { ...font.small, color: colors.textMuted, fontWeight: '700', marginTop: 6, marginBottom: 6 },
  preview: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: 12 },
  previewText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
})
