import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { font, radius, useStyles, useTheme, type Palette } from '../theme'
import { upiUri } from '../lib/payments'
import { formatINR } from '../lib/format'

// Renders a scannable UPI QR (GPay / PhonePe / Paytm understand upi://pay?…).
export function UpiQr({ upiId, payeeName, amount, note, size = 190 }: {
  upiId: string
  payeeName?: string
  amount?: number
  note?: string
  size?: number
}) {
  const styles = useStyles(makeStyles)
  const uri = upiUri({ pa: upiId, pn: payeeName, am: amount, tn: note })
  return (
    <View style={styles.wrap}>
      <View style={styles.qrBox}>
        <QRCode value={uri} size={size} backgroundColor="#fff" color="#0f172a" />
      </View>
      <Text style={styles.pa}>{upiId}</Text>
      {payeeName ? <Text style={styles.pn}>{payeeName}</Text> : null}
      {amount && amount > 0 ? <Text style={styles.amt}>{formatINR(amount)}</Text> : null}
      <Text style={styles.hint}>Scan with any UPI app to pay</Text>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  qrBox: { padding: 14, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  pa: { ...font.h3, color: colors.text, marginTop: 10 },
  pn: { ...font.small, color: colors.textMuted },
  amt: { ...font.h2, color: colors.success, marginTop: 2 },
  hint: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
})
