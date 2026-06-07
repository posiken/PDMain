import { getSupabase, verifyCode, cors } from './_supabase.js'

const KEY = 'changelog'

async function getEntries(supabase) {
  try {
    const { data } = await supabase
      .from('app_config').select('value').eq('key', KEY).single()
    return data?.value?.entries ?? []
  } catch {
    return []
  }
}

async function saveEntries(supabase, entries) {
  await supabase.from('app_config').upsert({ key: KEY, value: { entries } })
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  let supabase
  try { supabase = getSupabase() }
  catch (e) { return res.status(500).json({ error: e.message }) }

  // ── GET — public, no auth required ────────────────────────────────────────
  if (req.method === 'GET') {
    const entries = await getEntries(supabase)
    return res.status(200).json({ entries })
  }

  // ── POST — all write actions require a valid admin code ───────────────────
  if (req.method === 'POST') {
    const { action, code, entry, id } = req.body ?? {}

    const session = await verifyCode(supabase, code)
    if (!session) return res.status(401).json({ error: 'Invalid code' })

    let entries = await getEntries(supabase)

    // Add a new entry (auto-fills date and author from session)
    if (action === 'add') {
      const newEntry = {
        id:     'cl_' + Date.now().toString(36),
        date:   new Date().toISOString().split('T')[0],
        title:  entry?.title?.trim() || 'Untitled',
        body:   entry?.body?.trim()  || '',
        author: session.label,
      }
      entries = [newEntry, ...entries]
      await saveEntries(supabase, entries)
      return res.status(200).json({ entries })
    }

    // Update an existing entry (title and body only)
    if (action === 'update') {
      entries = entries.map(e =>
        e.id === entry?.id
          ? { ...e, title: entry.title?.trim(), body: entry.body?.trim() }
          : e
      )
      await saveEntries(supabase, entries)
      return res.status(200).json({ entries })
    }

    // Delete an entry by id
    if (action === 'delete') {
      entries = entries.filter(e => e.id !== id)
      await saveEntries(supabase, entries)
      return res.status(200).json({ entries })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
