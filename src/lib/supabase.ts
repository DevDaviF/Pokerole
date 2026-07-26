import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// A anon/publishable key é pública por design; a segurança real está nas
// políticas RLS do banco. A service_role NUNCA deve aparecer neste projeto.
export const supabaseConfigured = Boolean(
  url && anonKey && !anonKey.startsWith('COLE_'),
)

export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!)
  : null
