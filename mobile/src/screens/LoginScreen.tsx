import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useStore } from '../lib/store'
import { Button, Input, useToast } from '../components/ui'
import { colors, font, radius, shadow, spacing } from '../theme'

export function LoginScreen() {
  const { login } = useStore()
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!email.trim() || !password) return toast('Enter email and password', 'error')
    setBusy(true)
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) toast(res.error ?? 'Login failed', 'error')
  }

  return (
    <LinearGradient colors={colors.gradBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 50 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}><Text style={styles.logoText}>M</Text></View>
          <Text style={styles.brand}>Magizhini</Text>
          <Text style={styles.tag}>Multi-company billing & quotations</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}>Sign in to your account</Text>

            <View style={{ gap: 14, marginTop: 18 }}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@company.com"
              />
              <View>
                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!show}
                  placeholder="••••••••"
                  onSubmitEditing={submit}
                />
                <Pressable style={styles.eye} onPress={() => setShow((s) => !s)} hitSlop={8}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textFaint} />
                </Pressable>
              </View>
              <Button title="Sign in" icon="log-in-outline" onPress={submit} loading={busy} full style={{ marginTop: 4 }} />
            </View>
          </View>

          <View style={styles.demo}>
            <Ionicons name="information-circle-outline" size={15} color="rgba(255,255,255,0.8)" />
            <Text style={styles.demoText}>Uses your live Supabase account. First user becomes Admin.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 40, fontWeight: '800' },
  brand: { ...font.h1, color: '#fff', fontSize: 30, marginTop: 14 },
  tag: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5, marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: radius.xl, padding: spacing.xl, width: '100%', marginTop: 34, ...shadow.float },
  cardTitle: { ...font.h2, color: colors.text },
  cardSub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  eye: { position: 'absolute', right: 12, top: 34 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, paddingHorizontal: 12 },
  demoText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500', flexShrink: 1 },
})
