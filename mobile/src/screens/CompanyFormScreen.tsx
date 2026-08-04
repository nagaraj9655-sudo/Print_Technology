import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { uid } from '../lib/db'
import type { DocTemplate, Handbook } from '../lib/types'
import { colors, font, radius, spacing } from '../theme'
import { Button, Card, Input, SectionTitle, useConfirm, useToast } from '../components/ui'
import { Select } from '../components/Select'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
const ACCENTS = ['#4f46e5', '#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#dc2626', '#4338ca']
const TEMPLATES: DocTemplate[] = ['modern', 'classic', 'minimal']
const FONTS = ['Inter', 'Poppins', 'Libre Baskerville', 'Roboto', 'Lato']

export function CompanyFormScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'CompanyForm'>>()
  const editId = route.params?.id
  const { db, saveCompany, deleteCompany } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const existing = editId ? db.companies.find((c) => c.id === editId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [gstin, setGstin] = useState(existing?.gstin ?? '')
  const [stateCode, setStateCode] = useState(existing?.stateCode ?? '')
  const [bankDetails, setBankDetails] = useState(existing?.bankDetails ?? '')
  const [upiId, setUpiId] = useState(existing?.upiId ?? '')
  const [payeeName, setPayeeName] = useState(existing?.payeeName ?? '')
  const [invoicePrefix, setInvoicePrefix] = useState(existing?.invoicePrefix ?? '')
  const [quotePrefix, setQuotePrefix] = useState(existing?.quotePrefix ?? '')
  const [accent, setAccent] = useState(existing?.accent ?? ACCENTS[0])
  const [template, setTemplate] = useState<DocTemplate>(existing?.template ?? 'modern')
  const [fontFamily, setFontFamily] = useState(existing?.fontFamily ?? 'Inter')
  const [terms, setTerms] = useState(existing?.terms ?? '')
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)
  const [handbooks, setHandbooks] = useState<Handbook[]>(existing?.handbooks ?? [])

  const addHandbook = () => setHandbooks((h) => [...h, { id: uid(), name: 'New book', bookNo: String(h.length + 1), billsPerBook: 50, startNo: 1 }])
  const updateHb = (id: string, patch: Partial<Handbook>) => setHandbooks((h) => h.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const removeHb = (id: string) => setHandbooks((h) => h.filter((x) => x.id !== id))
  const numHb = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0 }

  const save = () => {
    if (!name.trim()) return toast('Enter a company name', 'error')
    saveCompany({
      id: editId, name: name.trim(), address, phone, email, gstin, stateCode, bankDetails, upiId, payeeName,
      invoicePrefix, quotePrefix, accent, accent2: accent, template, fontFamily, terms, isActive, handbooks,
    })
    toast(editId ? 'Company updated' : 'Company added')
    nav.goBack()
  }

  const remove = async () => {
    if (!editId) return
    if (await confirm('Delete this company? This cannot be undone.', true)) { deleteCompany(editId); toast('Company deleted', 'info'); nav.goBack() }
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title={editId ? 'Edit company' : 'New company'} showCompany={false} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SectionTitle title="Profile" />
          <Card style={{ gap: 14 }}>
            <Input label="Company name" value={name} onChangeText={setName} />
            <Input label="Address" value={address} onChangeText={setAddress} multiline />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View>
              <View style={{ flex: 1 }}><Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></View>
            </View>
          </Card>

          <SectionTitle title="GST & numbering" />
          <Card style={{ gap: 14 }}>
            <Input label="GSTIN (leave blank for non-GST)" value={gstin} onChangeText={setGstin} autoCapitalize="characters" hint="Presence enables tax invoices" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Input label="State code" value={stateCode} onChangeText={setStateCode} keyboardType="numeric" placeholder="33" /></View>
              <View style={{ flex: 1 }}><Input label="Invoice prefix" value={invoicePrefix} onChangeText={setInvoicePrefix} placeholder="PT/" /></View>
            </View>
            <Input label="Quote prefix" value={quotePrefix} onChangeText={setQuotePrefix} placeholder="PT/" />
          </Card>

          <SectionTitle title="Payments" />
          <Card style={{ gap: 14 }}>
            <Input label="UPI ID / VPA" value={upiId} onChangeText={setUpiId} autoCapitalize="none" placeholder="name@bank" hint="Drives the payment QR & reminders" />
            <Input label="Payee name" value={payeeName} onChangeText={setPayeeName} placeholder="Name shown in UPI apps" />
            <Input label="Bank details" value={bankDetails} onChangeText={setBankDetails} multiline placeholder="A/c · IFSC" />
          </Card>

          <SectionTitle title="Branding" />
          <Card style={{ gap: 14 }}>
            <View>
              <Text style={styles.label}>Accent colour</Text>
              <View style={styles.swatches}>
                {ACCENTS.map((a) => (
                  <Pressable key={a} onPress={() => setAccent(a)} style={[styles.swatch, { backgroundColor: a }, accent === a && styles.swatchActive]}>
                    {accent === a && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </Pressable>
                ))}
              </View>
            </View>
            <Select label="Document template" value={template} options={TEMPLATES.map((t) => ({ label: t[0].toUpperCase() + t.slice(1), value: t }))} onChange={(v) => setTemplate(v as DocTemplate)} />
            <Select label="Font family" value={fontFamily} options={FONTS.map((f) => ({ label: f, value: f }))} onChange={setFontFamily} />
            <Input label="Invoice terms / footer" value={terms} onChangeText={setTerms} multiline />
          </Card>

          <SectionTitle title="Handbooks (manual bill books)" action={<Pressable onPress={addHandbook}><Text style={styles.addLink}>+ Add</Text></Pressable>} />
          {handbooks.length === 0 ? (
            <Card><Text style={styles.emptyHb}>No manual bill books. Add one to record handbill receipts.</Text></Card>
          ) : (
            handbooks.map((h) => (
              <Card key={h.id} style={{ gap: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.hbTitle}>Book {h.bookNo}</Text>
                  <Pressable onPress={() => removeHb(h.id)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
                </View>
                <Input label="Name" value={h.name} onChangeText={(t) => updateHb(h.id, { name: t })} />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><Input label="Book no" value={h.bookNo} onChangeText={(t) => updateHb(h.id, { bookNo: t })} /></View>
                  <View style={{ flex: 1 }}><Input label="Receipts" value={String(h.billsPerBook)} onChangeText={(t) => updateHb(h.id, { billsPerBook: numHb(t) })} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Input label="Start no" value={String(h.startNo)} onChangeText={(t) => updateHb(h.id, { startNo: numHb(t) })} keyboardType="numeric" /></View>
                </View>
                <Input label="Assigned to" value={h.assignedTo ?? ''} onChangeText={(t) => updateHb(h.id, { assignedTo: t })} />
              </Card>
            ))
          )}

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Active company</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.brandLight }} thumbColor="#fff" />
          </View>

          <Button title={editId ? 'Save changes' : 'Add company'} icon="checkmark" onPress={save} full style={{ marginTop: spacing.lg }} />
          {editId && <Button title="Delete company" icon="trash-outline" variant="danger" onPress={remove} full style={{ marginTop: spacing.md }} />}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {node}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.md, gap: 6 },
  label: { ...font.small, color: colors.textMuted, fontWeight: '600', marginBottom: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 3, borderColor: '#fff', ...({ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }) },
  addLink: { ...font.small, color: colors.brand, fontWeight: '800' },
  emptyHb: { ...font.small, color: colors.textFaint },
  hbTitle: { ...font.h3, color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggleLabel: { ...font.body, color: colors.text, fontWeight: '700' },
})
