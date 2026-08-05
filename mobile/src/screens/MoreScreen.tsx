import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { canAccess } from '../lib/menus'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { GradientHeader } from '../components/Header'
import { Button, useConfirm } from '../components/ui'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface Item { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; route: keyof RootStackParamList; color: string; bg: string; menuKey?: string; adminOnly?: boolean }

const buildItems = (colors: Palette): Item[] => [
  { icon: 'people', label: 'Customers', sub: 'Manage your customers', route: 'CustomersList', color: colors.cyan, bg: colors.tintCyan, menuKey: 'customers' },
  { icon: 'business', label: 'Companies', sub: 'Company profiles & branding', route: 'CompaniesList', color: colors.brand, bg: colors.tintIndigo, menuKey: 'companies' },
  { icon: 'bar-chart', label: 'Reports', sub: 'Sales, receivables, GST, profit', route: 'Reports', color: colors.violet, bg: colors.tintViolet, menuKey: 'reports' },
  { icon: 'settings', label: 'Settings', sub: 'Theme, tax, letter-pad, reminders', route: 'Settings', color: colors.textMuted, bg: colors.tintSlate, adminOnly: true },
  { icon: 'shield-checkmark', label: 'Users', sub: 'Team & access control', route: 'Users', color: colors.success, bg: colors.tintEmerald, adminOnly: true },
]

export function MoreScreen() {
  const nav = useNavigation<Nav>()
  const { currentUser, logout, activeCompany } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const { confirm, node } = useConfirm()
  const role = currentUser?.role ?? 'Operator'

  const items = buildItems(colors).filter((it) => {
    if (it.adminOnly) return role === 'Admin'
    if (it.menuKey) return canAccess(role, currentUser?.allowedMenus, it.menuKey)
    return true
  })

  const doLogout = async () => {
    if (await confirm('Sign out of Magizhini?')) await logout()
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="More" showCompany={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={colors.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.profile, shadow.card]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(currentUser?.name ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{currentUser?.name}</Text>
            <Text style={styles.email}>{currentUser?.email}</Text>
            <View style={styles.roleChip}>
              <Ionicons name={role === 'Admin' ? 'shield-checkmark' : 'person'} size={11} color="#fff" />
              <Text style={styles.roleText}>{role}</Text>
            </View>
          </View>
        </LinearGradient>

        {activeCompany ? (
          <View style={styles.activeCompany}>
            <Ionicons name="business" size={15} color={colors.brand} />
            <Text style={styles.activeText}>Active: <Text style={{ fontWeight: '800' }}>{activeCompany.name}</Text></Text>
          </View>
        ) : null}

        <View style={{ gap: 10, marginTop: spacing.md }}>
          {items.map((it) => (
            <Pressable key={it.route} style={styles.item} onPress={() => nav.navigate(it.route as any)}>
              <View style={[styles.itemIcon, { backgroundColor: it.bg }]}>
                <Ionicons name={it.icon} size={20} color={it.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel}>{it.label}</Text>
                <Text style={styles.itemSub}>{it.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>

        <Button title="Sign out" icon="log-out-outline" variant="outline" onPress={doLogout} style={{ marginTop: spacing.xl }} />
        <Text style={styles.version}>Magizhini · v1.0 · Supabase cloud</Text>
        <View style={{ height: 30 }} />
      </ScrollView>
      {node}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: spacing.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.xl, padding: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  name: { ...font.h3, color: '#fff', fontSize: 18 },
  email: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 1 },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, marginTop: 7 },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  activeCompany: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.tintIndigo, borderRadius: radius.md, padding: 12, marginTop: spacing.md },
  activeText: { ...font.small, color: colors.brandDark },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  itemIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { ...font.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  itemSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
  version: { textAlign: 'center', color: colors.textFaint, fontSize: 11, marginTop: 18 },
})
