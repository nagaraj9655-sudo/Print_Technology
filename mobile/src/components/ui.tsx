import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { font, radius, shadow, spacing, statusColor, useStyles, useTheme, type Palette } from '../theme'

/* ----------------------------- Card ----------------------------- */
export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const styles = useStyles(makeStyles)
  return <View style={[styles.card, padded && { padding: spacing.lg }, style]}>{children}</View>
}

/* --------------------------- Section title ---------------------- */
export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  )
}

/* ----------------------------- Button --------------------------- */
type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success'
export function Button({
  title, onPress, variant = 'primary', icon, disabled, loading, small, style, full,
}: {
  title: string
  onPress?: () => void
  variant?: BtnVariant
  icon?: keyof typeof Ionicons.glyphMap
  disabled?: boolean
  loading?: boolean
  small?: boolean
  full?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.brand : '#fff'} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 15 : 18} color={btnTextColor(variant, colors)} />}
          <Text style={[styles.btnText, { color: btnTextColor(variant, colors), fontSize: small ? 13 : 15 }]}>{title}</Text>
        </>
      )}
    </>
  )
  const pad: ViewStyle = { paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 14 : 18 }
  const base: ViewStyle = { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.5 : 1 }

  if (variant === 'primary') {
    return (
      <Pressable onPress={disabled || loading ? undefined : onPress} style={[full && { alignSelf: 'stretch' }, style]}>
        <LinearGradient colors={colors.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[base, pad, shadow.card]}>
          {content}
        </LinearGradient>
      </Pressable>
    )
  }
  const bg =
    variant === 'danger' ? colors.danger : variant === 'success' ? colors.success : variant === 'outline' ? colors.surface : 'transparent'
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: colors.border } : null
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={[base, pad, { backgroundColor: bg }, border, full && { alignSelf: 'stretch' }, style]}
    >
      {content}
    </Pressable>
  )
}
function btnTextColor(v: BtnVariant, colors: Palette): string {
  if (v === 'outline') return colors.text
  if (v === 'ghost') return colors.brand
  return '#fff'
}

/* --------------------------- Text field ------------------------- */
export function Field({ label, children, hint }: { label?: string; children: React.ReactNode; hint?: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

export function Input({ label, hint, style, ...props }: TextInputProps & { label?: string; hint?: string }) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const [focus, setFocus] = useState(false)
  return (
    <Field label={label} hint={hint}>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e) }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e) }}
        style={[styles.input, focus && styles.inputFocus, props.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, style]}
      />
    </Field>
  )
}

/* ---------------------------- Status pill ----------------------- */
export function StatusPill({ status }: { status: string }) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const c = statusColor(status, colors)
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{status}</Text>
    </View>
  )
}

export function Chip({ label, color, bg, icon }: { label: string; color?: string; bg?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const fg = color ?? colors.brand
  const back = bg ?? colors.tintIndigo
  return (
    <View style={[styles.chip, { backgroundColor: back }]}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  )
}

/* ---------------------------- Empty state ----------------------- */
export function EmptyState({ icon = 'file-tray-outline', title, subtitle }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.brandLight} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  )
}

/* ---------------------------- KPI card -------------------------- */
export function KpiCard({ label, value, sub, icon, gradient, onPress }: {
  label: string; value: string; sub?: string; icon: keyof typeof Ionicons.glyphMap; gradient?: readonly string[]; onPress?: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const inner = (
    <LinearGradient colors={(gradient ?? colors.gradBrand) as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.kpi, shadow.card]}>
      <View style={styles.kpiIcon}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
      {onPress ? <View style={styles.kpiChevron}><Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.9)" /></View> : null}
    </LinearGradient>
  )
  if (onPress) return <Pressable style={{ flex: 1 }} onPress={onPress}>{inner}</Pressable>
  return inner
}

/* --------------------------- Icon holder ------------------------ */
export function IconBadge({ icon, color, bg, size = 40 }: { icon: keyof typeof Ionicons.glyphMap; color?: string; bg?: string; size?: number }) {
  const { colors } = useTheme()
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: bg ?? colors.tintIndigo, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color ?? colors.brand} />
    </View>
  )
}

/* ------------------------------ Toast --------------------------- */
type ToastKind = 'success' | 'error' | 'info'
const ToastContext = createContext<(msg: string, kind?: ToastKind) => void>(() => {})
export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  const styles = useStyles(makeStyles)
  const [msg, setMsg] = useState<{ text: string; kind: ToastKind } | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((text: string, kind: ToastKind = 'success') => {
    setMsg({ text, kind })
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setMsg(null))
    }, 2400)
  }, [opacity])

  const bg = msg?.kind === 'error' ? colors.danger : msg?.kind === 'info' ? colors.brand : colors.success
  const ic = msg?.kind === 'error' ? 'alert-circle' : msg?.kind === 'info' ? 'information-circle' : 'checkmark-circle'

  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <View style={[styles.toastInner, { backgroundColor: bg }]}>
            <Ionicons name={ic as any} size={18} color="#fff" />
            <Text style={styles.toastText}>{msg.text}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  )
}

/* ---------------------------- Confirm --------------------------- */
export function useConfirm() {
  const styles = useStyles(makeStyles)
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void; danger?: boolean } | null>(null)
  const confirm = useCallback((message: string, danger = false) =>
    new Promise<boolean>((resolve) => setState({ message, resolve, danger })), [])
  const node = (
    <Modal transparent visible={!!state} animationType="fade" onRequestClose={() => { state?.resolve(false); setState(null) }}>
      <Pressable style={styles.modalBackdrop} onPress={() => { state?.resolve(false); setState(null) }}>
        <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.confirmText}>{state?.message}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => { state?.resolve(false); setState(null) }} />
            <Button title="Confirm" variant={state?.danger ? 'danger' : 'primary'} style={{ flex: 1 }} onPress={() => { state?.resolve(true); setState(null) }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
  return { confirm, node }
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { ...font.h3, color: colors.text },
  btnText: { fontWeight: '700' },
  label: { ...font.small, color: colors.textMuted, fontWeight: '600' },
  hint: { fontSize: 11, color: colors.textFaint },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text },
  inputFocus: { borderColor: colors.brandLight, backgroundColor: colors.surface },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.tintIndigo, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...font.h3, color: colors.textMuted },
  emptySub: { ...font.small, color: colors.textFaint, textAlign: 'center', paddingHorizontal: 30 },
  kpi: { flex: 1, minWidth: 150, borderRadius: radius.lg, padding: spacing.lg, gap: 2, overflow: 'hidden' },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  kpiLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '600' },
  kpiSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  kpiChevron: { position: 'absolute', top: 14, right: 12 },
  toast: { position: 'absolute', bottom: 34, left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  toastInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.pill, ...shadow.float, maxWidth: '90%' },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 380, ...shadow.float },
  confirmText: { ...font.body, color: colors.text, fontSize: 15, lineHeight: 22 },
})
