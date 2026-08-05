import React, { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'

// Compact pill for the header that switches the active company (or "All").
export function CompanySwitcher() {
  const { db, activeCompanyId, setActiveCompanyId } = useStore()
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const [open, setOpen] = useState(false)
  const label = activeCompanyId === 'ALL' ? 'All companies' : db.companies.find((c) => c.id === activeCompanyId)?.name ?? 'Select'

  const options = [{ id: 'ALL', name: 'All companies', sub: 'Consolidated' }, ...db.companies.map((c) => ({ id: c.id, name: c.name, sub: c.gstin ? 'GST · ' + c.gstin : 'Non-GST' }))]

  return (
    <>
      <Pressable style={styles.pill} onPress={() => setOpen(true)}>
        <Ionicons name="business" size={13} color="#fff" />
        <Text style={styles.pillText} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.85)" />
      </Pressable>

      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Switch company</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => {
                const active = item.id === activeCompanyId
                return (
                  <Pressable style={[styles.row, active && styles.rowActive]} onPress={() => { setActiveCompanyId(item.id as any); setOpen(false) }}>
                    <View style={[styles.dot, { backgroundColor: item.id === 'ALL' ? colors.violet : colors.brand }]}>
                      <Ionicons name={item.id === 'ALL' ? 'albums' : 'business'} size={16} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, active && { color: colors.brand }]}>{item.name}</Text>
                      <Text style={styles.rowSub}>{item.sub}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={colors.brand} />}
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, maxWidth: 200 },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 34, maxHeight: '70%', ...shadow.float },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  sheetTitle: { ...font.h3, color: colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.md },
  rowActive: { backgroundColor: colors.tintIndigo },
  dot: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, color: colors.text, fontWeight: '700' },
  rowSub: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
})
