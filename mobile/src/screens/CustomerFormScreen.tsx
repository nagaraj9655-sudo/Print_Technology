import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useStore } from '../lib/store'
import { spacing } from '../theme'
import { Button, Card, Input, useConfirm, useToast } from '../components/ui'
import { GradientHeader } from '../components/Header'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CustomerFormScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RouteProp<RootStackParamList, 'CustomerForm'>>()
  const editId = route.params?.id
  const { db, saveCustomer, deleteCustomer } = useStore()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const existing = editId ? db.customers.find((c) => c.id === editId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [gstin, setGstin] = useState(existing?.gstin ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const save = () => {
    if (!name.trim()) return toast('Enter a name', 'error')
    saveCustomer({ id: editId, name: name.trim(), phone, address, gstin, notes })
    toast(editId ? 'Customer updated' : 'Customer added')
    nav.goBack()
  }

  const remove = async () => {
    if (!editId) return
    if (await confirm('Delete this customer? Their existing bills are unaffected.', true)) {
      deleteCustomer(editId); toast('Customer deleted', 'info'); nav.goBack()
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <GradientHeader title={editId ? 'Edit customer' : 'New customer'} showCompany={false} onBack={() => nav.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 14 }}>
            <Input label="Name" value={name} onChangeText={setName} placeholder="Customer / business name" />
            <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" />
            <Input label="Address" value={address} onChangeText={setAddress} multiline />
            <Input label="GSTIN (optional)" value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
            <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
          </Card>
          <Button title={editId ? 'Save changes' : 'Add customer'} icon="checkmark" onPress={save} full style={{ marginTop: spacing.xl }} />
          {editId && <Button title="Delete customer" icon="trash-outline" variant="danger" onPress={remove} full style={{ marginTop: spacing.md }} />}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {node}
    </View>
  )
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, paddingTop: spacing.md } })
