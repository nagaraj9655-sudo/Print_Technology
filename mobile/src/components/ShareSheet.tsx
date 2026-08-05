import React, { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { font, radius, shadow, spacing, useStyles, useTheme, type Palette } from '../theme'
import { useToast } from './ui'
import { emailPdf, makePdf, openSms, openWhatsApp, sharePdf, webPrintDoc } from '../lib/share'

export interface ShareConfig {
  title: string
  phone?: string
  email?: string
  buildHtml: () => string
  fileName: string
  summary: string
  emailSubject: string
}

export function ShareSheet({ open, onClose, config }: { open: boolean; onClose: () => void; config: ShareConfig | null }) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  if (!config) return null

  const withPdf = async (label: string, run: (uri: string) => Promise<void>) => {
    // On web, expo-print can only print the current page (it would capture the
    // app screen, not the invoice). Open the rendered doc in its own window and
    // let the browser "Save as PDF" it instead. Sharing/email aren't available
    // on web either, so this print path covers every PDF option.
    if (Platform.OS === 'web') {
      const ok = webPrintDoc(config.buildHtml())
      if (!ok) toast('Allow pop-ups to open the printable PDF', 'error')
      onClose()
      return
    }
    try {
      setBusy(label)
      const uri = await makePdf(config.buildHtml(), config.fileName)
      await run(uri)
    } catch (e) {
      toast(`Could not generate PDF: ${(e as Error)?.message ?? e}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const options: { key: string; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; run: () => void }[] = [
    {
      key: 'wa-buyer', label: config.phone ? 'WhatsApp buyer' : 'WhatsApp', sub: config.phone ? `Message ${config.phone}` : 'Pick a contact',
      icon: 'logo-whatsapp', color: '#25D366', bg: 'rgba(37,211,102,0.12)',
      run: async () => {
        const ok = await openWhatsApp(config.phone, config.summary)
        if (!ok) toast('WhatsApp not available', 'error')
      },
    },
    {
      key: 'pdf-wa', label: 'Send PDF on WhatsApp', sub: 'Attach the PDF & pick the contact', icon: 'logo-whatsapp', color: '#128C7E', bg: 'rgba(18,140,126,0.12)',
      run: () => withPdf('pdf-wa', async (uri) => { const ok = await sharePdf(uri, 'Send document on WhatsApp'); if (!ok) toast('Sharing not available on this device', 'error') }),
    },
    {
      key: 'pdf', label: 'Share PDF', sub: 'Any app — Drive, print, Files', icon: 'document-attach', color: colors.brand, bg: colors.tintIndigo,
      run: () => withPdf('pdf', async (uri) => { const ok = await sharePdf(uri, config.title); if (!ok) toast('Sharing not available on this device', 'error') }),
    },
    {
      key: 'email', label: 'Email', sub: config.email ? `To ${config.email}` : 'Attach PDF & send', icon: 'mail', color: '#2563eb', bg: 'rgba(37,99,235,0.12)',
      run: () => withPdf('email', async (uri) => {
        const res = await emailPdf({ to: config.email, subject: config.emailSubject, body: config.summary, uri })
        if (res === 'unavailable') toast('No email account set up on this device', 'error')
        else if (res === 'sent') toast('Email sent')
      }),
    },
    {
      key: 'sms', label: 'SMS', sub: config.phone ? `Text ${config.phone}` : 'Send a text summary', icon: 'chatbubble-ellipses', color: colors.warning, bg: colors.tintAmber,
      run: async () => { const ok = await openSms(config.phone, config.summary); if (!ok) toast('SMS not available', 'error') },
    },
    {
      key: 'copy', label: 'Copy summary', sub: 'Copy details to clipboard', icon: 'copy', color: colors.textMuted, bg: colors.tintSlate,
      run: async () => { await Clipboard.setStringAsync(config.summary); toast('Copied to clipboard') },
    },
  ]

  return (
    <Modal transparent visible={open} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Share {config.title}</Text>
              <Text style={styles.sub}>Send as PDF, WhatsApp, Email or SMS</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.textFaint} /></Pressable>
          </View>

          <View style={{ gap: 10, marginTop: 6 }}>
            {options.map((o) => (
              <Pressable key={o.key} style={styles.row} onPress={o.run} disabled={!!busy}>
                <View style={[styles.icon, { backgroundColor: o.bg }]}>
                  <Ionicons name={o.icon} size={20} color={o.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{o.label}</Text>
                  <Text style={styles.rowSub}>{o.sub}</Text>
                </View>
                {busy === o.key
                  ? <Ionicons name="hourglass-outline" size={18} color={colors.textFaint} />
                  : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
              </Pressable>
            ))}
          </View>
          <View style={{ height: 8 }} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 30, ...shadow.float },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { ...font.h2, color: colors.text },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...font.body, color: colors.text, fontWeight: '700', fontSize: 15 },
  rowSub: { ...font.small, color: colors.textFaint, marginTop: 2 },
})
