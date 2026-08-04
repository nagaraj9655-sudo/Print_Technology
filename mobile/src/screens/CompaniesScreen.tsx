import React from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore, useScopedBills } from '../lib/store'
import { billTotals } from '../lib/calc'
import { formatINR } from '../lib/format'
import { colors, font, radius, shadow, spacing } from '../theme'
import { EmptyState } from '../components/ui'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CompaniesScreen() {
  const nav = useNavigation<Nav>()
  const { db } = useStore()

  const billedFor = (companyId: string) =>
    db.bills.filter((b) => !b.deletedAt && b.docStatus === 'Finalized' && b.companyId === companyId)
      .reduce((s, b) => s + billTotals(b, db.companies.find((c) => c.id === companyId)).net, 0)

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Companies" subtitle={`${db.companies.length} configured`} showCompany={false} onBack={() => nav.goBack()} />
      <FlatList
        data={db.companies}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="business-outline" title="No companies" subtitle="Tap + to add a company." />}
        renderItem={({ item: c }) => (
          <Pressable style={styles.card} onPress={() => nav.navigate('CompanyForm', { id: c.id })}>
            <View style={[styles.logo, { backgroundColor: c.accent ?? colors.brand }]}>
              <Text style={styles.logoText}>{c.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta} numberOfLines={1}>{c.gstin ? `GST · ${c.gstin}` : 'Non-GST'}</Text>
              <Text style={styles.billed}>Billed {formatINR(billedFor(c.id))}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {!c.isActive && <View style={styles.inactive}><Text style={styles.inactiveText}>Inactive</Text></View>}
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </View>
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => nav.navigate('CompanyForm')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: 100, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  logo: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { ...font.h3, color: colors.text },
  meta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  billed: { ...font.small, color: colors.success, fontWeight: '700', marginTop: 2 },
  inactive: { backgroundColor: colors.tintSlate, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  inactiveText: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 20, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadow.float },
})
