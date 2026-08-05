import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useScopedQuotes, useStore } from '../lib/store'
import { quoteTotals } from '../lib/calc'
import { formatDate, formatINR } from '../lib/format'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { EmptyState, IconBadge, StatusPill } from '../components/ui'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
const FILTERS = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Converted'] as const

export function QuotationsScreen() {
  const nav = useNavigation<Nav>()
  const { db } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const quotes = useScopedQuotes()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return quotes
      .filter((x) => (filter === 'All' ? true : x.status === filter))
      .filter((x) => !term || x.companyQuoteNo.toLowerCase().includes(term) || x.customerName.toLowerCase().includes(term))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [quotes, q, filter])

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Quotations" subtitle={`${rows.length} quote${rows.length === 1 ? '' : 's'}`} />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput placeholder="Search quote no or customer" placeholderTextColor={colors.textFaint} value={q} onChangeText={setQ} style={styles.searchInput} />
          {q ? <Pressable onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}
        </View>
      </View>

      <View style={styles.filters}>
        <FlatList
          data={FILTERS as unknown as string[]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
          renderItem={({ item: f }) => (
            <Pressable onPress={() => setFilter(f as any)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(x) => x.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No quotations yet" subtitle="Tap + to create a quote." />}
        renderItem={({ item: x }) => {
          const t = quoteTotals(x, db.companies.find((c) => c.id === x.companyId))
          return (
            <Pressable style={styles.card} onPress={() => nav.navigate('QuoteDetail', { id: x.id })}>
              <IconBadge icon="document-text" color={colors.violet} bg={colors.tintViolet} />
              <View style={{ flex: 1 }}>
                <Text style={styles.no}>{x.companyQuoteNo}</Text>
                <Text style={styles.cust} numberOfLines={1}>{x.customerName || 'No customer'}</Text>
                <Text style={styles.date}>{formatDate(x.date)}{x.validUntil ? ` · valid ${formatDate(x.validUntil)}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <Text style={styles.amount}>{formatINR(t.net)}</Text>
                <StatusPill status={x.status} />
              </View>
            </Pressable>
          )
        }}
      />

      <Pressable style={styles.fab} onPress={() => nav.navigate('QuoteForm')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  filters: { paddingVertical: spacing.md },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  filterText: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  no: { ...font.body, color: colors.text, fontWeight: '800' },
  cust: { ...font.small, color: colors.textMuted, marginTop: 2 },
  date: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  amount: { ...font.h3, color: colors.text },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 20, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', ...shadow.float },
})
