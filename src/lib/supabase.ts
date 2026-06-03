import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Copy .env.example to .env.local')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // simpan session di localStorage
    autoRefreshToken: true,      // refresh token otomatis sebelum expired
    detectSessionInUrl: true,    // handle magic link / OAuth callback
    storageKey: 'kasir-supabase-auth', // key terpisah dari kasir-auth
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  },
  global: {
    headers: { 'x-app-name': 'kasir-umkm' }
  }
})
