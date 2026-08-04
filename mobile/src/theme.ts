// Central design system — colours, spacing, radius, shadows, typography.
// The app leans vibrant and immersive: indigo→violet brand gradients, soft tinted
// surface cards, and confident status colours.

export const colors = {
  // Brand
  brand: '#4f46e5', // indigo-600
  brandDark: '#3730a3', // indigo-800
  brandLight: '#6366f1', // indigo-500
  violet: '#7c3aed',
  cyan: '#06b6d4',
  pink: '#ec4899',

  // Gradients (used with expo-linear-gradient)
  gradBrand: ['#4f46e5', '#7c3aed', '#a21caf'] as const,
  gradBlue: ['#2563eb', '#4f46e5'] as const,
  gradEmerald: ['#059669', '#10b981'] as const,
  gradAmber: ['#d97706', '#f59e0b'] as const,
  gradRose: ['#e11d48', '#f43f5e'] as const,
  gradCyan: ['#0891b2', '#06b6d4'] as const,
  gradViolet: ['#7c3aed', '#a855f7'] as const,

  // Semantic
  success: '#10b981',
  successDark: '#047857',
  danger: '#ef4444',
  dangerDark: '#b91c1c',
  warning: '#f59e0b',
  info: '#06b6d4',

  // Neutrals (slate)
  bg: '#f1f5f9', // page background
  bgDeep: '#e2e8f0',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',

  text: '#0f172a', // slate-900
  textMuted: '#475569', // slate-600
  textFaint: '#94a3b8', // slate-400
  textOnBrand: '#ffffff',

  // Tints for soft chips / icon holders
  tintIndigo: '#eef2ff',
  tintViolet: '#f5f3ff',
  tintEmerald: '#ecfdf5',
  tintAmber: '#fffbeb',
  tintRose: '#fff1f2',
  tintCyan: '#ecfeff',
  tintSlate: '#f1f5f9',
}

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 }

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 }

export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  float: {
    shadowColor: '#4f46e5',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
}

export const font = {
  h1: { fontSize: 26, fontWeight: '800' as const },
  h2: { fontSize: 20, fontWeight: '800' as const },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const },
}

// Status → colour helpers -----------------------------------------------------
export function statusColor(status: string): { fg: string; bg: string } {
  switch (status) {
    case 'Paid':
    case 'Accepted':
    case 'Converted':
      return { fg: colors.successDark, bg: colors.tintEmerald }
    case 'Partial':
    case 'Sent':
      return { fg: '#b45309', bg: colors.tintAmber }
    case 'Pending':
    case 'Rejected':
    case 'Expired':
      return { fg: colors.dangerDark, bg: colors.tintRose }
    case 'Draft':
      return { fg: colors.textMuted, bg: colors.tintSlate }
    default:
      return { fg: colors.brandDark, bg: colors.tintIndigo }
  }
}
