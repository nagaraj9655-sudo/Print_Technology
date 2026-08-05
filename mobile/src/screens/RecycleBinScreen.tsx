import React, { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatDate, formatINR } from '../lib/format'
import type { Bill } from '../lib/types'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Button, EmptyState, IconBadge, Input, useConfirm, useToast } from '../components/ui'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

// Matches the web app's recycle-bin purge password.
const DELETE_PASSWORD = 'arul@123'

export function RecycleBinScreen() {
  const nav = useNavigation<Nav>()
  const { db, restoreBill, permanentlyDeleteBill } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { confirm, node } = useConfirm()

  const [purgeTarget, setPurgeTarget] = useState<Bill | null>(null)
  const [password, setPassword] = useState('')

  const deleted = useMemo(
    () => db.bills.filter((b) => b.deletedAt).sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1)),
    [db.bills],
  )

  const restore = async (b: Bill) => {
    if (await confirm(`Restore bill ${b.companyBillNo === 'DRAFT' ? '(draft)' : b.companyBillNo}?`)) {
      restoreBill(b.id); toast('Bill restored')
    }
  }

  const confirmPurge = () => {
    if (!purgeTarget) return
    if (password !== DELETE_PASSWORD) { toast('Incorrect password', 'error'); return }
    permanentlyDeleteBill(purgeTarget.id)
    setPurgeTarget(null); setPassword(''); toast('Permanently deleted', 'info')
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Recycle Bin" subtitle={`${deleted.length} deleted bill${deleted.length === 1 ? '' : 's'}`} showCompany={false} onBack={() => nav.goBack()} />
      <FlatList
        data={deleted}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="trash-outline" title="Recycle bin is empty" subtitle="Deleted bills appear here and can be restored." />}
        renderItem={({ item: b }) => {
          const t = billTotals(b, db.companies.find((c) => c.id === b.companyId))
          return (
            <View style={styles.card}>
              <IconBadge icon="receipt-outline" color={colors.danger} bg={colors.tintRose} />
              <View style={{ flex: 1 }}>
                <Text style={styles.no}>{b.companyBillNo === 'DRAFT' ? 'Draft bill' : b.companyBillNo}</Text>
                <Text style={styles.meta}>{b.customerName || 'No customer'} · {formatINR(t.net)}</Text>
                <Text style={styles.deleted}>Deleted {formatDate((b.deletedAt || '').slice(0, 10))}</Text>
              </View>
              <View style={{ gap: 8 }}>
                <Button title="Restore" icon="refresh" variant="outline" small onPress={() => restore(b)} />
                <Button title="Delete" icon="trash" variant="danger" small onPress={() => { setPurgeTarget(b); setPassword('') }} />
              </View>
            </View>
          )
        }}
      />

      <Modal transparent visible={!!purgeTarget} animationType="fade" onRequestClose={() => setPurgeTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPurgeTarget(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.warnIcon}><Ionicons name="warning" size={26} color={colors.danger} /></View>
            <Text style={styles.modalTitle}>Permanently delete?</Text>
            <Text style={styles.modalSub}>This cannot be undone. Enter the delete password to remove this bill from the cloud forever.</Text>
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Delete password" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setPurgeTarget(null)} />
              <Button title="Delete forever" variant="danger" style={{ flex: 1 }} onPress={confirmPurge} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {node}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: 40, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  no: { ...font.body, color: colors.text, fontWeight: '800' },
  meta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  deleted: { ...font.tiny, color: colors.textFaint, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 380, ...shadow.float },
  warnIcon: { alignSelf: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tintRose, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modalTitle: { ...font.h2, color: colors.text, textAlign: 'center' },
  modalSub: { ...font.small, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 16, lineHeight: 18 },
})
