import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, font, shadow } from '../theme'
import { CompanySwitcher } from './CompanySwitcher'

// Immersive gradient header used across the app.
export function GradientHeader({
  title, subtitle, showCompany = true, onBack, right,
}: {
  title: string
  subtitle?: string
  showCompany?: boolean
  onBack?: () => void
  right?: React.ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <LinearGradient colors={colors.gradBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wrap, { paddingTop: insets.top + 10 }, shadow.card]}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        <View style={styles.rightRow}>
          {right}
          {showCompany && <CompanySwitcher />}
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  back: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  title: { ...font.h1, color: '#fff', fontSize: 24 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500', marginTop: 1 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
