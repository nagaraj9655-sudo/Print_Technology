// Central design system — colours, spacing, radius, shadows, typography.
//
// Colours are now *themeable at runtime*. The app ships a set of curated
// palettes (see THEMES). ThemeProvider holds the active palette; components read
// it via useTheme() and build styles with useStyles(makeStyles).
//
// `spacing`, `radius`, `shadow`, `font` are theme-independent and stay static.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/* ----------------------------- Palette shape ---------------------------- */
export interface Palette {
  // Brand
  brand: string
  brandDark: string
  brandLight: string
  violet: string
  cyan: string
  pink: string

  // Gradients (used with expo-linear-gradient)
  gradBrand: readonly string[]
  gradBlue: readonly string[]
  gradEmerald: readonly string[]
  gradAmber: readonly string[]
  gradRose: readonly string[]
  gradCyan: readonly string[]
  gradViolet: readonly string[]

  // Semantic
  success: string
  successDark: string
  danger: string
  dangerDark: string
  warning: string
  info: string

  // Neutrals
  bg: string
  bgDeep: string
  surface: string
  surfaceAlt: string
  border: string
  borderStrong: string

  text: string
  textMuted: string
  textFaint: string
  textOnBrand: string

  // Tints for soft chips / icon holders
  tintIndigo: string
  tintViolet: string
  tintEmerald: string
  tintAmber: string
  tintRose: string
  tintCyan: string
  tintSlate: string
}

// Shared semantic colours reused across the light themes (green = paid,
// red = due, amber = partial keep their meaning regardless of accent).
const LIGHT_SEMANTIC = {
  success: '#10b981',
  successDark: '#047857',
  danger: '#ef4444',
  dangerDark: '#b91c1c',
  warning: '#f59e0b',
  info: '#06b6d4',
  gradBlue: ['#2563eb', '#4f46e5'] as const,
  gradEmerald: ['#059669', '#10b981'] as const,
  gradAmber: ['#d97706', '#f59e0b'] as const,
  gradRose: ['#e11d48', '#f43f5e'] as const,
  gradCyan: ['#0891b2', '#06b6d4'] as const,
  gradViolet: ['#7c3aed', '#a855f7'] as const,
  tintEmerald: '#ecfdf5',
  tintAmber: '#fffbeb',
  tintRose: '#fff1f2',
  tintCyan: '#ecfeff',
}

// Shared light neutrals (slate).
const LIGHT_NEUTRAL = {
  bg: '#f1f5f9',
  bgDeep: '#e2e8f0',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  textFaint: '#94a3b8',
  textOnBrand: '#ffffff',
  tintSlate: '#f1f5f9',
}

/* ------------------------------- Themes --------------------------------- */
export type ThemeId = 'indigo' | 'emerald' | 'ocean' | 'sunset' | 'royal' | 'rose' | 'midnight'

export interface ThemeMeta {
  id: ThemeId
  name: string
  swatch: readonly string[] // preview gradient
}

const indigo: Palette = {
  ...LIGHT_NEUTRAL, ...LIGHT_SEMANTIC,
  brand: '#4f46e5', brandDark: '#3730a3', brandLight: '#6366f1',
  violet: '#7c3aed', cyan: '#06b6d4', pink: '#ec4899',
  gradBrand: ['#4f46e5', '#7c3aed', '#a21caf'],
  tintIndigo: '#eef2ff', tintViolet: '#f5f3ff',
}

const emerald: Palette = {
  ...LIGHT_NEUTRAL, ...LIGHT_SEMANTIC,
  brand: '#059669', brandDark: '#065f46', brandLight: '#10b981',
  violet: '#0d9488', cyan: '#06b6d4', pink: '#14b8a6',
  gradBrand: ['#059669', '#0d9488', '#0891b2'],
  tintIndigo: '#ecfdf5', tintViolet: '#f0fdfa',
}

const ocean: Palette = {
  ...LIGHT_NEUTRAL, ...LIGHT_SEMANTIC,
  brand: '#0284c7', brandDark: '#075985', brandLight: '#38bdf8',
  violet: '#2563eb', cyan: '#06b6d4', pink: '#6366f1',
  gradBrand: ['#0ea5e9', '#2563eb', '#4f46e5'],
  tintIndigo: '#eff6ff', tintViolet: '#eef2ff',
}

const sunset: Palette = {
  ...LIGHT_NEUTRAL, ...LIGHT_SEMANTIC,
  brand: '#ea580c', brandDark: '#9a3412', brandLight: '#fb923c',
  violet: '#e11d48', cyan: '#f59e0b', pink: '#ec4899',
  gradBrand: ['#f97316', '#ef4444', '#ec4899'],
  tintIndigo: '#fff7ed', tintViolet: '#fff1f2',
}

const royal: Palette = {
  ...LIGHT_NEUTRAL, ...LIGHT_SEMANTIC,
  brand: '#7c3aed', brandDark: '#5b21b6', brandLight: '#a855f7',
  violet: '#a21caf', cyan: '#8b5cf6', pink: '#db2777',
  gradBrand: ['#7c3aed', '#a21caf', '#db2777'],
  tintIndigo: '#f5f3ff', tintViolet: '#fdf4ff',
}

const rose: Palette = {
  ...LIGHT_NEUTRAL, ...LIGHT_SEMANTIC,
  brand: '#e11d48', brandDark: '#9f1239', brandLight: '#fb7185',
  violet: '#be123c', cyan: '#f43f5e', pink: '#ec4899',
  gradBrand: ['#f43f5e', '#e11d48', '#be123c'],
  tintIndigo: '#fff1f2', tintViolet: '#fdf2f8',
}

// Dark theme — overrides neutrals + tints for a deep slate look.
const midnight: Palette = {
  ...LIGHT_SEMANTIC,
  brand: '#6366f1', brandDark: '#4338ca', brandLight: '#818cf8',
  violet: '#a855f7', cyan: '#22d3ee', pink: '#f472b6',
  gradBrand: ['#4338ca', '#6d28d9', '#a21caf'],
  gradBlue: ['#1d4ed8', '#4338ca'],
  gradEmerald: ['#047857', '#059669'],
  gradAmber: ['#b45309', '#d97706'],
  gradRose: ['#be123c', '#e11d48'],
  gradCyan: ['#0e7490', '#0891b2'],
  gradViolet: ['#6d28d9', '#9333ea'],
  success: '#34d399', successDark: '#6ee7b7',
  danger: '#f87171', dangerDark: '#fca5a5',
  warning: '#fbbf24', info: '#22d3ee',
  bg: '#0b1220', bgDeep: '#060a14',
  surface: '#131c31', surfaceAlt: '#0f1626',
  border: '#26314b', borderStrong: '#3a4661',
  text: '#e5eaf5', textMuted: '#9aa7c2', textFaint: '#5f6d8a', textOnBrand: '#ffffff',
  tintIndigo: '#1e2540', tintViolet: '#241a3d',
  tintEmerald: '#0e2a24', tintAmber: '#2a2110', tintRose: '#2c1620', tintCyan: '#0c2630', tintSlate: '#1a2238',
}

export const THEMES: Record<ThemeId, Palette> = { indigo, emerald, ocean, sunset, royal, rose, midnight }

export const THEME_LIST: ThemeMeta[] = [
  { id: 'indigo', name: 'Indigo', swatch: indigo.gradBrand },
  { id: 'emerald', name: 'Emerald', swatch: emerald.gradBrand },
  { id: 'ocean', name: 'Ocean', swatch: ocean.gradBrand },
  { id: 'sunset', name: 'Sunset', swatch: sunset.gradBrand },
  { id: 'royal', name: 'Royal', swatch: royal.gradBrand },
  { id: 'rose', name: 'Rosé', swatch: rose.gradBrand },
  { id: 'midnight', name: 'Midnight', swatch: midnight.gradBrand },
]

export const DEFAULT_THEME: ThemeId = 'indigo'

// Mutable singleton mirroring the active palette. Kept in sync by the
// ThemeProvider so any non-hook / legacy `colors.*` reference still resolves to
// the current theme's values. Prefer useTheme() in components.
export const colors: Palette = { ...indigo }

export function applyPalette(id: ThemeId) {
  Object.assign(colors, THEMES[id] ?? indigo)
}

/* --------------------------- Static tokens ------------------------------ */
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
export function statusColor(status: string, c: Palette = colors): { fg: string; bg: string } {
  switch (status) {
    case 'Paid':
    case 'Accepted':
    case 'Converted':
      return { fg: c.successDark, bg: c.tintEmerald }
    case 'Partial':
    case 'Sent':
      return { fg: '#b45309', bg: c.tintAmber }
    case 'Pending':
    case 'Rejected':
    case 'Expired':
      return { fg: c.dangerDark, bg: c.tintRose }
    case 'Draft':
      return { fg: c.textMuted, bg: c.tintSlate }
    default:
      return { fg: c.brandDark, bg: c.tintIndigo }
  }
}

/* ------------------------- Theme context + hooks ------------------------ */
const THEME_KEY = 'magizhini.theme'

interface ThemeContextValue {
  id: ThemeId
  colors: Palette
  themes: ThemeMeta[]
  setThemeId: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<ThemeId>(DEFAULT_THEME)

  useEffect(() => {
    let alive = true
    void AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (alive && saved && (THEMES as Record<string, Palette>)[saved]) {
        applyPalette(saved as ThemeId)
        setId(saved as ThemeId)
      }
    })
    return () => { alive = false }
  }, [])

  const setThemeId = useCallback((next: ThemeId) => {
    applyPalette(next)
    setId(next)
    void AsyncStorage.setItem(THEME_KEY, next)
  }, [])

  const palette = THEMES[id] ?? indigo
  const value = useMemo<ThemeContextValue>(
    () => ({ id, colors: palette, themes: THEME_LIST, setThemeId }),
    [id, palette, setThemeId],
  )
  return React.createElement(ThemeContext.Provider, { value }, children)
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  // Fallback keeps components usable if rendered outside a provider (e.g. tests).
  if (!ctx) return { id: DEFAULT_THEME, colors, themes: THEME_LIST, setThemeId: () => {} }
  return ctx
}

// Build a memoised StyleSheet from the active palette. `factory` must be a
// stable module-level function so the memo only recomputes when the theme flips.
export function useStyles<T>(factory: (c: Palette) => T): T {
  const { colors: c } = useTheme()
  return useMemo(() => factory(c), [c, factory])
}
