import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Combatant } from '../components/BattleTracker'

// Leitura (só leitura) da Ordem de Combate da mesa — usado pra montar o
// seletor de alvo na hora de rolar Dano, sem duplicar a lógica de escrita
// que já mora em BattleTracker.tsx.
export function useCombatants(mesaId: string | null): Combatant[] {
  const [combatants, setCombatants] = useState<Combatant[]>([])

  useEffect(() => {
    if (!supabase || !mesaId) return
    let cancelled = false

    supabase
      .from('battle_order')
      .select('combatants')
      .eq('mesa_id', mesaId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setCombatants((data.combatants as Combatant[]) ?? [])
      })

    const channel = supabase
      .channel(`combatants-read-${mesaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_order',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => {
          const row = payload.new as { combatants: Combatant[] }
          setCombatants(row.combatants ?? [])
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId])

  return combatants
}
