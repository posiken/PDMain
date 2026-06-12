import { getSupabase, verifyCode, cors } from './_supabase.js'

const KEY = 'help_requests'
const MAX = 60

async function getReqs(supabase) {
  try {
    const { data } = await supabase
      .from('app_config').select('value').eq('key', KEY).single()
    return data?.value?.requests ?? []
  } catch {
    return []
  }
}

async function saveReqs(supabase, requests) {
  await supabase.from('app_config').upsert({ key: KEY, value: { requests } })
}

// Validate an agent session token against the users store
async function getAgent(supabase, username, token) {
  try {
    const { data } = await supabase
      .from('app_config').select('value').eq('key', 'users').single()
    const users = data?.value?.users ?? []
    const u = users.find(x => x.username === String(username || '').toLowerCase())
    return (u && u.active !== false && token && u.token === token) ? u : null
  } catch {
    return null
  }
}

const sanitizeCtx = c => ({
  zip:    c?.zip ? String(c.zip).slice(0, 5) : null,
  branch: c?.branch ? String(c.branch).slice(0, 30) : null,
  types:  Array.isArray(c?.types) ? c.types.slice(0, 6).map(t => String(t).slice(0, 20)) : [],
})

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let supabase
  try { supabase = getSupabase() }
  catch (e) { return res.status(500).json({ error: e.message }) }

  const { action, code, username, token, id, note, context } = req.body ?? {}
  let requests = await getReqs(supabase)

  // ── Agent actions (validated by session token) ─────────────────────────────
  if (action === 'raise') {
    const agent = await getAgent(supabase, username, token)
    if (!agent) return res.status(401).json({ error: 'Session expired — sign in again' })
    const existing = requests.find(r => r.agentUsername === agent.username && r.status === 'open')
    if (existing) return res.status(200).json({ request: existing })
    const request = {
      id: 'hr_' + Date.now().toString(36),
      ts: Date.now(),
      agentName: agent.name,
      agentUsername: agent.username,
      note: String(note || '').slice(0, 200),
      context: sanitizeCtx(context),
      status: 'open',
      claimedBy: null,
    }
    requests = [request, ...requests].slice(0, MAX)
    await saveReqs(supabase, requests)
    return res.status(200).json({ request })
  }

  if (action === 'mine') {
    const agent = await getAgent(supabase, username, token)
    if (!agent) return res.status(401).json({ error: 'Session expired' })
    const request = requests.find(r => r.agentUsername === agent.username && r.status === 'open') || null
    return res.status(200).json({ request })
  }

  if (action === 'cancel') {
    const agent = await getAgent(supabase, username, token)
    if (!agent) return res.status(401).json({ error: 'Session expired' })
    requests = requests.map(r =>
      r.id === id && r.agentUsername === agent.username && r.status === 'open'
        ? { ...r, status: 'cancelled', resolvedAt: Date.now() }
        : r
    )
    await saveReqs(supabase, requests)
    return res.status(200).json({ ok: true })
  }

  // ── Supervisor actions (require a valid admin code) ────────────────────────
  const session = await verifyCode(supabase, code)
  if (!session) return res.status(401).json({ error: 'Invalid code' })

  if (action === 'list') {
    const open   = requests.filter(r => r.status === 'open').sort((a, b) => a.ts - b.ts)
    const recent = requests.filter(r => r.status !== 'open').sort((a, b) => (b.resolvedAt||b.ts) - (a.resolvedAt||a.ts)).slice(0, 8)
    return res.status(200).json({ open, recent })
  }

  if (action === 'claim') {
    requests = requests.map(r => r.id === id && r.status === 'open'
      ? { ...r, claimedBy: session.label, claimedAt: Date.now() } : r)
    await saveReqs(supabase, requests)
    return res.status(200).json({ ok: true })
  }

  if (action === 'resolve') {
    requests = requests.map(r => r.id === id
      ? { ...r, status: 'resolved', resolvedAt: Date.now(), resolvedBy: session.label } : r)
    await saveReqs(supabase, requests)
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
