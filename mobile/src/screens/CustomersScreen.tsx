import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatINR } from '../lib/format'
import { colors, font, radius, shadow, spacing } from '../theme'
import { EmptyState, IconBadge } from '../components/ui'
import { GradientHeader } from '../components/Header'
import { PaymentReminder, type ReminderTarget } from '../components/PaymentReminder'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CustomersScreen() {
  const nav = useNavigation<Nav>()
  const { db, activeCompanyId } = useStore()
  const [q, setQ] = useState('')
  const [remind, setRemind] = useState<ReminderTarget | null>(null)

  const outstandingFor = (customerId: string) => {
    return db.bills
      .filter((b) => !b.deletedAt && b.docStatus === 'Finalized' && b.customerId === customerId && (activeCompanyId === 'ALL' || b.companyId === activeCompanyId))
      .reduce((s, b) => s + billTotals(b, db.companies.find((c) => c.id === b.companyId)).balance, 0)
  }

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.customers
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term))
      .map((c) => ({ c, outstanding: outstandingFor(c.id) }))
      .sort((a, b) => b.outstanding - a.outstanding || a.c.name.localeCompare(b.c.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.customers, db.bills, q, activeCompanyId])

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Customers" subtitle={`${db.customers.length} total`} onBack={() => nav.goBack()} />
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput placeholder="Search name or phone" placeholderTextColor={colors.textFaint} value={q} onChangeText={setQ} style={styles.searchInput} />
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={({ c }) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No customers" subtitle="Tap + to add a customer." />}
        renderItem={({ item: { c, outstanding } }) => (
          <Pressable style={styles.card} onPress={() => nav.navigate('CustomerForm', { id: c.id })}>
            <IconBadge icon="person" color={colors.cyan} bg={colors.tintCyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{c.phone || 'no phone'}{c.gstin ? ` · ${c.gstin}` : ''}</Text>
              {outstanding > 0.001 && <Text style={styles.due}>Due {formatINR(outstanding)}</Text>}
            </View>
            {outstanding > 0.001 ? (
              <Pressable style={styles.remindBtn} onPress={() => setRemind({ customerId: c.id, customerName: c.name, customerPhone: c.phone })}>
                <Ionicons name="notifications-outline" size={16} color={colors.warning} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            )}
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => nav.navigate('CustomerForm')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
      <PaymentReminder open={!!remind} onClose={() => setRemind(null)} target={remind} />
    </View>
  )
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  name: { ...font.body, color: colors.text, fontWeight: '800' },
  meta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  due: { ...font.small, color: colors.danger, fontWeight: '700', marginTop: 2 },
  remindBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.tintAmber, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 20, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', ...shadow.float },
})
