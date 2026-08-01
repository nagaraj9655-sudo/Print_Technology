import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The app runs in two modes:
//  • local   — no Supabase env set → data in browser localStorage (offline, single device)
//  • supabase — env set → real Supabase Auth + Postgres tables (cloud, multi-device, RLS)
//
// The keys below are the *public* URL and anon key. They are safe to ship in a web
// app; row-level security in Postgres is what protects the data. Never put the
// service_role key here — that stays server-side (Edge Function only).

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
