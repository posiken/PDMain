import crypto from 'crypto'
import { getSupabase, verifyCode, cors } from './_supabase.js'

const KEY = 'users'
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex')

async function getUsers(supabase) {
  try {
    const { data } = await supabase
      .from('app_config').select('value').eq('key', KEY).single()
    return data?.value?.users ?? []
  } catch {
    return []
  }
}

async function saveUsers(supabase, users) {
  await supabase.from('app_config').upsert({ key: KEY, value: { users } })
}

const pub = u => ({ id: u.id, name: u.name, username: u.username, active: u.active !== false })

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let supabase
  try { supabase = getSupabase() }
  catch (e) { return res.status(500).json({ error: e.message }) }

  const { action, code, username, pin, token, user } = req.body ?? {}
  let users = await getUsers(supabase)

  // ── Agent login — returns a rotating session token ─────────────────────────
  if (action === 'login') {
    const uname = String(username || '').trim().toLowerCase()
    const u = users.find(x => x.username === uname)
    if (!u || u.active === false || u.pinHash !== hash(pin)) {
      return res.status(401).json({ error: 'Invalid username or PIN' })
    }
    u.token = crypto.randomUUID()
    u.lastLogin = Date.now()
    await saveUsers(supabase, users)
    return res.status(200).json({ ok: true, user: pub(u), token: u.token })
  }

  // ── Agent token check (used to validate a stored session) ──────────────────
  if (action === 'verify') {
    const u = users.find(x => x.username === String(username || '').toLowerCase())
    if (!u || u.active === false || !token || u.token !== token) {
      return res.status(401).json({ error: 'Session expired' })
    }
    return res.status(200).json({ ok: true, user: pub(u) })
  }

  // ── Everything below requires a manager / master code ──────────────────────
  const session = await verifyCode(supabase, code)
  if (!session) return res.status(401).json({ error: 'Invalid code' })

  if (action === 'list') {
    return res.status(200).json({ users: users.map(pub) })
  }

  if (action === 'add') {
    const uname = String(user?.username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const name  = String(user?.name || '').trim()
    if (!uname || !name || !user?.pin) return res.status(400).json({ error: 'Name, username and PIN required' })
    if (users.some(x => x.username === uname)) return res.status(409).json({ error: 'Username already exists' })
    users = [...users, {
      id: 'u_' + Date.now().toString(36),
      name, username: uname,
      pinHash: hash(user.pin),
      active: true, createdBy: session.label, createdAt: Date.now(),
    }]
    await saveUsers(supabase, users)
    return res.status(200).json({ users: users.map(pub) })
  }

  if (action === 'update') {
    users = users.map(x => x.id === user?.id
      ? { ...x,
          name:   user.name?.trim()   || x.name,
          active: typeof user.active === 'boolean' ? user.active : x.active,
          ...(user.pin ? { pinHash: hash(user.pin), token: null } : {}) }
      : x)
    await saveUsers(supabase, users)
    return res.status(200).json({ users: users.map(pub) })
  }

  if (action === 'delete') {
    users = users.filter(x => x.id !== user?.id)
    await saveUsers(supabase, users)
    return res.status(200).json({ users: users.map(pub) })
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
