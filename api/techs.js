import { getSupabase, verifyCode, cors } from './_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  let supabase
  try {
    supabase = getSupabase()
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

  // ── GET /api/techs ─────────────────────────────────────────────────────────
  // Public — returns the full technician list. No auth required.
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'technicians')
      .single()

    // PGRST116 = row not found — return empty list on first run
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data?.value ?? [])
  }

  // ── PUT /api/techs ─────────────────────────────────────────────────────────
  // Protected — replaces the full technician list. Requires a valid admin code.
  if (req.method === 'PUT') {
    const { techs, code } = req.body ?? {}

    if (!code) return res.status(401).json({ error: 'Admin code required' })

    const session = await verifyCode(supabase, code)
    if (!session) return res.status(401).json({ error: 'Invalid code' })

    if (!Array.isArray(techs)) return res.status(400).json({ error: 'techs must be an array' })

    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'technicians', value: techs })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
