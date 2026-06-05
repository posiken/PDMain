import { createClient } from '@supabase/supabase-js'

export function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  return createClient(url, key)
}

// Fetch the auth config row from Supabase
export async function getAuthConfig(supabase) {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'auth')
    .single()
  return data?.value ?? { master: null, managers: [] }
}

// Verify an admin code — returns { level, label } or null
export async function verifyCode(supabase, code) {
  if (!code) return null
  const auth = await getAuthConfig(supabase)
  if (!auth.master) return null
  if (code === auth.master) return { level: 'master', label: 'Master Admin' }
  const mgr = (auth.managers ?? []).find(m => m.code === code)
  if (mgr) return { level: 'manager', label: mgr.label }
  return null
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}
