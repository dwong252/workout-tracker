import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — create a .env.local file.')
}

const devUserId = import.meta.env.DEV && import.meta.env.VITE_DEV_USER_ID
const devKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

// In dev bypass mode, use the service role key so RLS is skipped entirely.
const supabaseKey = devUserId && devKey ? devKey : supabaseAnonKey

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

if (devUserId) {
  const devUser = { id: devUserId, email: 'dev@local' }
  // Use the service key as the bearer token so PostgREST accepts the requests.
  const devSession = { user: devUser, access_token: devKey, token_type: 'bearer' }
  supabase.auth.getUser = async () => ({ data: { user: devUser }, error: null })
  supabase.auth.getSession = async () => ({ data: { session: devSession }, error: null })
  supabase.auth.onAuthStateChange = (cb) => {
    cb('SIGNED_IN', devSession)
    return { data: { subscription: { unsubscribe: () => {} } } }
  }
}
