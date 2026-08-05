import React, { useState } from 'react'
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { OPERATOR_MENUS } from '../lib/menus'
import type { Role, User } from '../lib/types'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Button, Card, EmptyState, IconBadge, Input, useConfirm, useToast } from '../components/ui'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function UsersScreen() {
  const nav = useNavigation<Nav>()
  const { db, currentUser, saveUser, deleteUser } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { confirm, node } = useConfirm()

  const [editing, setEditing] = useState<Partial<User> | null>(null)
  const [busy, setBusy] = useState(false)
  const [restrict, setRestrict] = useState(false)

  const open = (u?: User) => {
    setEditing(u ? { ...u } : { name: '', email: '', role: 'Operator', password: '' })
    setRestrict(!!u?.allowedMenus)
  }

  const submit = async () => {
    if (!editing) return
    setBusy(true)
    const res = await saveUser({ ...editing, allowedMenus: restrict ? (editing.allowedMenus ?? []) : undefined })
    setBusy(false)
    if (res.ok) { toast(editing.id ? 'User updated' : 'User created'); setEditing(null) }
    else toast(res.error ?? 'Failed', 'error')
  }

  const remove = async (u: User) => {
    if (await confirm(`Delete ${u.name}? This removes their login.`, true)) {
      const res = await deleteUser(u.id)
      if (res.ok) toast('User deleted', 'info')
      else toast(res.error ?? 'Failed', 'error')
    }
  }

  const toggleMenu = (key: string) => {
    if (!editing) return
    const cur = editing.allowedMenus ?? []
    setEditing({ ...editing, allowedMenus: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] })
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Users" subtitle={`${db.users.length} team member${db.users.length === 1 ? '' : 's'}`} showCompany={false} onBack={() => nav.goBack()} />
      <FlatList
        data={db.users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No users" />}
        renderItem={({ item: u }) => (
          <Pressable style={styles.card} onPress={() => open(u)}>
            <IconBadge icon={u.role === 'Admin' ? 'shield-checkmark' : 'person'} color={u.role === 'Admin' ? colors.success : colors.brand} bg={u.role === 'Admin' ? colors.tintEmerald : colors.tintIndigo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{u.name}{u.id === currentUser?.id ? ' (you)' : ''}</Text>
              <Text style={styles.meta}>{u.email}</Text>
              <Text style={styles.role}>{u.role}{u.allowedMenus ? ` · ${u.allowedMenus.length} menus` : ''}</Text>
            </View>
            {u.id !== currentUser?.id && (
              <Pressable onPress={() => remove(u)} hitSlop={8} style={styles.del}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
            )}
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => open()}>
        <Ionicons name="person-add" size={24} color="#fff" />
      </Pressable>

      <Modal transparent visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{editing?.id ? 'Edit user' : 'New user'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <View style={{ gap: 14, paddingTop: 8 }}>
                <Input label="Name" value={editing?.name ?? ''} onChangeText={(t) => setEditing((e) => ({ ...e!, name: t }))} />
                <Input label="Email" value={editing?.email ?? ''} onChangeText={(t) => setEditing((e) => ({ ...e!, email: t }))} keyboardType="email-address" autoCapitalize="none" editable={!editing?.id} />
                {!editing?.id && <Input label="Password" value={editing?.password ?? ''} onChangeText={(t) => setEditing((e) => ({ ...e!, password: t }))} secureTextEntry />}

                <View style={styles.segment}>
                  {(['Operator', 'Admin'] as Role[]).map((r) => (
                    <Pressable key={r} onPress={() => setEditing((e) => ({ ...e!, role: r }))} style={[styles.segBtn, editing?.role === r && styles.segActive]}>
                      <Text style={[styles.segText, editing?.role === r && { color: '#fff' }]}>{r}</Text>
                    </Pressable>
                  ))}
                </View>

                {editing?.role === 'Operator' && (
                  <View style={styles.menuBox}>
                    <View style={styles.menuHead}>
                      <Text style={styles.menuTitle}>Restrict menu access</Text>
                      <Switch value={restrict} onValueChange={setRestrict} trackColor={{ true: colors.brandLight }} thumbColor="#fff" />
                    </View>
                    {restrict && OPERATOR_MENUS.map((m) => {
                      const on = (editing?.allowedMenus ?? []).includes(m.key)
                      return (
                        <Pressable key={m.key} style={styles.menuRow} onPress={() => toggleMenu(m.key)}>
                          <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.brand : colors.textFaint} />
                          <Text style={styles.menuLabel}>{m.label}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
            <Button title={editing?.id ? 'Save' : 'Create user'} icon="checkmark" onPress={submit} loading={busy} full style={{ marginTop: 14 }} />
          </Pressable>
        </Pressable>
      </Modal>
      {node}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: 100, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  name: { ...font.body, color: colors.text, fontWeight: '800' },
  meta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  role: { ...font.tiny, color: colors.brand, marginTop: 2, textTransform: 'uppercase' },
  del: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.tintRose, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 20, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', ...shadow.float },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 30, ...shadow.float },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  sheetTitle: { ...font.h2, color: colors.text },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  segActive: { backgroundColor: colors.brand },
  segText: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  menuBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  menuHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  menuLabel: { ...font.body, color: colors.textMuted },
})
