import type { PokemonSheet } from '../types'
import { supabase } from './supabase'

export async function sendSheetTransfer(
  mesaId: string,
  toUserId: string,
  sheet: PokemonSheet,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase não configurado' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase.from('sheet_transfers').insert({
    mesa_id: mesaId,
    from_user_id: user.id,
    to_user_id: toUserId,
    payload: sheet,
  })
  return { error: error?.message }
}
