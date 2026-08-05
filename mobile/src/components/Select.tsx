import React, { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Field } from './ui'

export interface Option {
  label: string
  value: string
  sub?: string
}

export function Select({
  label, value, options, onChange, placeholder = 'Select…', hint,
}: {
  label?: string
  value?: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const current = options.find((o) => o.value === value)
  return (
    <Field label={label} hint={hint}>
      <Pressable style={styles.control} onPress={() => setOpen(true)}>
        <Text style={[styles.value, !current && { color: colors.textFaint }]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
      </Pressable>

      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const active = item.value === value
                return (
                  <Pressable style={[styles.row, active && styles.rowActive]} onPress={() => { onChange(item.value); setOpen(false) }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, active && { color: colors.brand }]}>{item.label}</Text>
                      {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Field>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  value: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 34, ...shadow.float },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  sheetTitle: { ...font.h3, color: colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.md, gap: 8 },
  rowActive: { backgroundColor: colors.tintIndigo },
  rowLabel: { fontSize: 15, color: colors.text, fontWeight: '600' },
  rowSub: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
})
