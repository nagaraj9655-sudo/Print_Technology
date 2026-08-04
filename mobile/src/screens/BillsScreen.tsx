import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useScopedBills, useStore } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatDate, formatINR } from '../lib/format'
import { colors, font, radius, shadow, spacing } from '../theme'
import { EmptyState, IconBadge, StatusPill } from '../components/ui'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
const FILTERS = ['All', 'Pending', 'Partial', 'Paid', 'Draft'] as const

export function BillsScreen() {
  const nav = useNavigation<Nav>()
  const { db } = useStore()
  const bills = useScopedBills()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return bills
      .map((b) => ({ b, t: billTotals(b, db.companies.find((c) => c.id === b.companyId)) }))
      .filter(({ b, t }) => {
        if (filter === 'Draft' && b.docStatus !== 'Draft') return false
        if (filter !== 'All' && filter !== 'Draft' && (b.docStatus !== 'Finalized' || t.status !== filter)) return false
        if (!term) return true
        return b.companyBillNo.toLowerCase().includes(term) || b.customerName.toLowerCase().includes(term)
      })
      .sort((a, b) => (a.b.date < b.b.date ? 1 : -1))
  }, [bills, q, filter, db.companies])

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Bills" subtitle={`${rows.length} invoice${rows.length === 1 ? '' : 's'}`} />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput placeholder="Search bill no or customer" placeholderTextColor={colors.textFaint} value={q} onChangeText={setQ} style={styles.searchInput} />
          {q ? <Pressable onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}
        </View>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={({ b }) => b.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No bills yet" subtitle="Tap + to create your first invoice." />}
        renderItem={({ item: { b, t } }) => (
          <Pressable style={styles.card} onPress={() => nav.navigate('BillDetail', { id: b.id })}>
            <IconBadge icon={b.docStatus === 'Draft' ? 'document-outline' : 'receipt'} color={b.docStatus === 'Draft' ? colors.textMuted : colors.brand} bg={b.docStatus === 'Draft' ? colors.tintSlate : colors.tintIndigo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.no}>{b.docStatus === 'Draft' ? 'Draft bill' : b.companyBillNo}</Text>
              <Text style={styles.cust} numberOfLines={1}>{b.customerName || 'No customer'}</Text>
              <Text style={styles.date}>{formatDate(b.date)}{b.billType === 'Handbill' ? ' · Handbill' : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 5 }}>
              <Text style={styles.amount}>{formatINR(t.net)}</Text>
              <StatusPill status={b.docStatus === 'Draft' ? 'Draft' : t.status} />
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => nav.navigate('BillForm')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  no: { ...font.body, color: colors.text, fontWeight: '800' },
  cust: { ...font.small, color: colors.textMuted, marginTop: 2 },
  date: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  amount: { ...font.h3, color: colors.text },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 20, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadow.float },
})
