import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

export function getServerSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !serviceRoleKey) return null
  return { url, serviceRoleKey }
}

export function getServerSupabaseAdmin(): SupabaseClient | null {
  const cfg = getServerSupabaseConfig()
  if (!cfg) return null
  if (!adminClient) {
    adminClient = createClient(cfg.url, cfg.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

export async function verifyParentBearer(
  authHeader: string | undefined
): Promise<{ userId: string; email: string | null } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  const admin = getServerSupabaseAdmin()
  if (admin) {
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) return null
    return { userId: data.user.id, email: data.user.email ?? null }
  }

  // Fallback verification via Supabase Auth REST if only anon key + URL exist on server
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const anon = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !anon) return null

  const { createClient: createAnon } = await import('@supabase/supabase-js')
  const client = createAnon(url, anon, { auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return { userId: data.user.id, email: data.user.email ?? null }
}
