import { getSupabase, verifyCode, cors } from './_supabase.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getTechs(supabase) {
  const { data, error } = await supabase
    .from('app_config').select('value').eq('key', 'technicians').single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.value ?? []
}

async function saveTechs(supabase, techs) {
  const { error } = await supabase.from('app_config').upsert({ key: 'technicians', value: techs })
  if (error) throw error
}

async function getBackups(supabase) {
  try {
    const { data } = await supabase
      .from('app_config').select('value').eq('key', 'backups').single()
    return data?.value?.entries ?? []
  } catch { return [] }
}

async function createBackup(supabase, currentTechs, reason) {
  try {
    const existing = await getBackups(supabase)
    const entry = {
      id:        'bk_' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      count:     currentTechs.length,
      reason:    reason || 'Manual edit',
      techs:     currentTechs,
    }
    const entries = [entry, ...existing].slice(0, 10) // keep last 10
    await supabase.from('app_config').upsert({ key: 'backups', value: { entries } })
  } catch (e) {
    // Don't fail the main save if backup fails
    console.error('Backup failed:', e.message)
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  let supabase
  try { supabase = getSupabase() }
  catch (e) { return res.status(500).json({ error: e.message }) }

  // ── GET — return current technicians (public) ─────────────────────────────
  if (req.method === 'GET') {
    try {
      const techs = await getTechs(supabase)
      return res.status(200).json(techs)
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // ── PUT — save technicians (authenticated, creates backup first) ───────────
  if (req.method === 'PUT') {
    const { techs, code, reason } = req.body ?? {}

    if (!code) return res.status(401).json({ error: 'Admin code required' })
    const session = await verifyCode(supabase, code)
    if (!session) return res.status(401).json({ error: 'Invalid code' })
    if (!Array.isArray(techs)) return res.status(400).json({ error: 'techs must be an array' })

    // Backup current data before overwriting
    const current = await getTechs(supabase)
    await createBackup(supabase, current, reason)

    // Save new data
    try {
      await saveTechs(supabase, techs)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // ── POST — backup operations (authenticated) ───────────────────────────────
  if (req.method === 'POST') {
    const { action, code, backupId } = req.body ?? {}

    const session = await verifyCode(supabase, code)
    if (!session) return res.status(401).json({ error: 'Invalid code' })

    // List all backups
    if (action === 'listBackups') {
      const backups = await getBackups(supabase)
      // Return without the full techs array to keep response small
      return res.status(200).json({
        backups: backups.map(b => ({
          id:        b.id,
          timestamp: b.timestamp,
          count:     b.count,
          reason:    b.reason,
          techs:     b.techs, // included for download
        }))
      })
    }

    // Restore from a specific backup
    if (action === 'restore') {
      if (!backupId) return res.status(400).json({ error: 'backupId required' })
      const backups = await getBackups(supabase)
      const backup  = backups.find(b => b.id === backupId)
      if (!backup) return res.status(404).json({ error: 'Backup not found' })

      // Backup what's currently there before restoring
      const current = await getTechs(supabase)
      await createBackup(supabase, current, `Before restore from ${backup.timestamp.split('T')[0]}`)

      // Restore
      try {
        await saveTechs(supabase, backup.techs)
        return res.status(200).json({ ok: true, techs: backup.techs })
      } catch (e) {
        return res.status(500).json({ error: e.message })
      }
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
