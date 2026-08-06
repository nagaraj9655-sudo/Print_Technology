import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { LineItem } from '../lib/types'
import { lineTotal } from '../lib/calc'
import { formatINR } from '../lib/format'
import { uid } from '../lib/db'
import { useStore } from '../lib/store'
import { font, radius, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Select } from './Select'

export function LineItemEditor({
  items, onChange, gstMode, taxRates, showCost,
}: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  gstMode: boolean
  taxRates: number[]
  showCost?: boolean
}) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const { db } = useStore()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const update = (id: string, patch: Partial<LineItem>) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const remove = (id: string) => onChange(items.filter((it) => it.id !== id))
  const add = () => onChange([...items, { id: uid(), description: '', qty: 1, rate: 0, taxRate: gstMode ? taxRates[taxRates.length - 1] ?? 18 : undefined }])

  // Unique descriptions used on past bills/quotes — offered as you type.
  const pastDescriptions = useMemo(() => {
    const set = new Set<string>()
    db.bills.forEach((b) => b.items.forEach((i) => i.description && set.add(i.description.trim())))
    db.quotations.forEach((q) => q.items.forEach((i) => i.description && set.add(i.description.trim())))
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [db.bills, db.quotations])

  const suggestionsFor = (it: LineItem) => {
    if (focusedId !== it.id) return []
    const q = it.description.trim().toLowerCase()
    if (!q) return []
    return pastDescriptions.filter((d) => d.toLowerCase().includes(q) && d.toLowerCase() !== q).slice(0, 6)
  }

  const num = (v: string) => {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  return (
    <View style={{ gap: 12 }}>
      {items.map((it, idx) => (
        <View key={it.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.idx}>Item {idx + 1}</Text>
            <Pressable onPress={() => remove(it.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>

          <TextInput
            placeholder="Description / service"
            placeholderTextColor={colors.textFaint}
            value={it.description}
            onChangeText={(t) => update(it.id, { description: t })}
            onFocus={() => setFocusedId(it.id)}
            onBlur={() => setFocusedId((f) => (f === it.id ? null : f))}
            style={styles.desc}
            multiline
          />
          {suggestionsFor(it).length > 0 && (
            <View style={styles.suggestBox}>
              {suggestionsFor(it).map((s) => (
                <Pressable
                  key={s}
                  style={styles.suggestRow}
                  onPress={() => { update(it.id, { description: s }); setFocusedId(null) }}
                >
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.suggestText} numberOfLines={1}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.row}>
            <MiniField label="Qty">
              <TextInput keyboardType="numeric" value={String(it.qty ?? '')} onChangeText={(t) => update(it.id, { qty: num(t) })} style={styles.mini} placeholderTextColor={colors.textFaint} />
            </MiniField>
            <MiniField label="Rate ₹">
              <TextInput keyboardType="numeric" value={String(it.rate ?? '')} onChangeText={(t) => update(it.id, { rate: num(t) })} style={styles.mini} placeholderTextColor={colors.textFaint} />
            </MiniField>
            {showCost && (
              <MiniField label="Cost ₹">
                <TextInput keyboardType="numeric" value={it.cost != null ? String(it.cost) : ''} onChangeText={(t) => update(it.id, { cost: t ? num(t) : undefined })} style={styles.mini} placeholder="0" placeholderTextColor={colors.textFaint} />
              </MiniField>
            )}
          </View>

          {gstMode && (
            <View style={styles.row}>
              <View style={{ flex: 1.2 }}>
                <MiniField label="HSN/SAC">
                  <TextInput value={it.hsnSac ?? ''} onChangeText={(t) => update(it.id, { hsnSac: t })} style={styles.mini} placeholder="—" placeholderTextColor={colors.textFaint} />
                </MiniField>
              </View>
              <View style={{ flex: 1 }}>
                <Select
                  label="GST %"
                  value={String(it.taxRate ?? 0)}
                  options={taxRates.map((r) => ({ label: `${r}%`, value: String(r) }))}
                  onChange={(v) => update(it.id, { taxRate: parseFloat(v) })}
                />
              </View>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Line total</Text>
            <Text style={styles.totalValue}>{formatINR(lineTotal(it))}</Text>
          </View>
        </View>
      ))}

      <Pressable style={styles.add} onPress={add}>
        <Ionicons name="add-circle" size={20} color={colors.brand} />
        <Text style={styles.addText}>Add line item</Text>
      </Pressable>
    </View>
  )
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={styles.miniLabel}>{label}</Text>
      {children}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idx: { ...font.tiny, color: colors.brand, textTransform: 'uppercase', letterSpacing: 0.4 },
  desc: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, padding: 10, fontSize: 14, color: colors.text, minHeight: 40 },
  suggestBox: { marginTop: -4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brandLight, borderRadius: radius.md, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestText: { ...font.body, color: colors.text, flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  mini: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.text },
  miniLabel: { ...font.tiny, color: colors.textMuted },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { ...font.small, color: colors.textMuted },
  totalValue: { ...font.h3, color: colors.text },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brandLight, borderStyle: 'dashed', backgroundColor: colors.tintIndigo },
  addText: { ...font.body, color: colors.brand, fontWeight: '700' },
})
