import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { font, radius, spacing, useStyles, useTheme, type Palette } from '../theme'
import { Button, Card, Input, SectionTitle, useToast } from '../components/ui'
import { Select } from '../components/Select'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function SettingsScreen() {
  const nav = useNavigation<Nav>()
  const { db, saveSettings } = useStore()
  const { id: themeId, themes, setThemeId } = useTheme()
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const s = db.settings

  const [currency, setCurrency] = useState(s.currency)
  const [fyStartMonth, setFyStartMonth] = useState(s.fyStartMonth)
  const [defaultTaxRate, setDefaultTaxRate] = useState(String(s.defaultTaxRate))
  const [taxRates, setTaxRates] = useState(s.taxRates.join(', '))
  const [footer, setFooter] = useState(s.invoiceFooter)
  const [billTop, setBillTop] = useState(String(s.letterpadBillTopMm ?? 40))
  const [quoteTop, setQuoteTop] = useState(String(s.letterpadQuoteTopMm ?? 40))
  const [reminder, setReminder] = useState(s.reminderTemplate ?? '')

  const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }

  const save = () => {
    saveSettings({
      currency, fyStartMonth, defaultTaxRate: num(defaultTaxRate), invoiceFooter: footer,
      taxRates: taxRates.split(',').map((x) => parseFloat(x.trim())).filter((n) => !isNaN(n)),
      letterpadBillTopMm: num(billTop), letterpadQuoteTopMm: num(quoteTop),
      reminderTemplate: reminder.trim() || undefined,
    })
    toast('Settings saved')
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title="Settings" showCompany={false} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SectionTitle title="Appearance" />
          <Card>
            <Text style={styles.themeHint}>Pick an app theme — it recolours the whole app instantly.</Text>
            <View style={styles.themeGrid}>
              {themes.map((th) => {
                const active = th.id === themeId
                return (
                  <Pressable key={th.id} onPress={() => setThemeId(th.id)} style={[styles.themeCell, active && styles.themeCellActive]}>
                    <LinearGradient colors={th.swatch as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.themeSwatch}>
                      {active && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                    </LinearGradient>
                    <Text style={[styles.themeName, active && styles.themeNameActive]}>{th.name}</Text>
                  </Pressable>
                )
              })}
            </View>
          </Card>

          <SectionTitle title="General" />
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Input label="Currency" value={currency} onChangeText={setCurrency} /></View>
              <View style={{ flex: 1 }}><Input label="Default GST %" value={defaultTaxRate} onChangeText={setDefaultTaxRate} keyboardType="numeric" /></View>
            </View>
            <Select label="Financial year starts" value={String(fyStartMonth)} options={MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }))} onChange={(v) => setFyStartMonth(parseInt(v, 10))} />
            <Input label="Available GST rates (comma-separated)" value={taxRates} onChangeText={setTaxRates} placeholder="0, 5, 12, 18, 28" />
            <Input label="Invoice footer text" value={footer} onChangeText={setFooter} multiline />
          </Card>

          <SectionTitle title="Letter-pad spacing" />
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Input label="Bill top (mm)" value={billTop} onChangeText={setBillTop} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Input label="Quote top (mm)" value={quoteTop} onChangeText={setQuoteTop} keyboardType="numeric" /></View>
            </View>
          </Card>

          <SectionTitle title="Payment reminder" />
          <Card>
            <Input label="Reminder intro message" value={reminder} onChangeText={setReminder} multiline placeholder="This is a gentle payment reminder from [Company Name]." hint="Leave blank to use the default. Pending bills, UPI ID & QR are added automatically." />
          </Card>

          <Button title="Save all settings" icon="save-outline" onPress={save} full style={{ marginTop: spacing.xl }} />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: 6 },
  themeHint: { ...font.small, color: colors.textMuted, marginBottom: 12 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  themeCell: { alignItems: 'center', gap: 6, width: 72 },
  themeCellActive: {},
  themeSwatch: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  themeName: { ...font.tiny, color: colors.textMuted },
  themeNameActive: { color: colors.brand, fontWeight: '800' },
})
