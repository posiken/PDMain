import { getSupabase, getAuthConfig, verifyCode, cors } from './_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let supabase
  try {
    supabase = getSupabase()
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

  const { action, code, config } = req.body ?? {}

  // ── checkStatus ────────────────────────────────────────────────────────────
  // Called when the login modal opens. Tells the client whether to show the
  // "create master code" setup screen or the regular login screen.
  if (action === 'checkStatus') {
    const auth = await getAuthConfig(supabase)
    return res.status(200).json({ needsSetup: !auth.master })
  }

  // ── login ──────────────────────────────────────────────────────────────────
  // Verify an admin code. Returns { level, label } on success.
  if (action === 'login') {
    const auth = await getAuthConfig(supabase)
    if (!auth.master) return res.status(200).json({ needsSetup: true })

    const session = await verifyCode(supabase, code)
    if (!session) return res.status(401).json({ error: 'wrong' })
    return res.status(200).json(session)
  }

  // ── setup ──────────────────────────────────────────────────────────────────
  // Create the master code for the first time. Fails if one already exists.
  if (action === 'setup') {
    const auth = await getAuthConfig(supabase)
    if (auth.master) return res.status(400).json({ error: 'Master code already set' })
    if (!code || code.length < 4) return res.status(400).json({ error: 'Code must be at least 4 characters' })

    const newAuth = { master: code, managers: [] }
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'auth', value: newAuth })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ level: 'master', label: 'Master Admin' })
  }

  // ── getConfig ──────────────────────────────────────────────────────────────
  // Fetch the full auth config (master + all manager codes). Master only.
  if (action === 'getConfig') {
    const auth = await getAuthConfig(supabase)
    if (!auth.master || code !== auth.master) {
      return res.status(401).json({ error: 'Invalid master code' })
    }
    return res.status(200).json(auth)
  }

  // ── updateConfig ───────────────────────────────────────────────────────────
  // Replace the full auth config. Master only.
  if (action === 'updateConfig') {
    const auth = await getAuthConfig(supabase)
    if (!auth.master || code !== auth.master) {
      return res.status(401).json({ error: 'Invalid master code' })
    }
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config payload' })
    }

    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'auth', value: config })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(400).json({ error: `Unknown action: ${action}` })
}
