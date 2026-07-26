import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export interface ScoutContributor {
  name: string
  successes: number
  at: number
  userId?: string
}

export interface ScoutRollsRow {
  mesa_id: string
  total: number
  contributors: ScoutContributor[]
}

// Lê e sincroniza em tempo real a contagem de batedores da mesa (soma dos
// sucessos de Insight + Alert de vários Treinadores, conforme o costume da
// mesa — não é regra fixa do livro).
export function useScoutRolls(mesaId: string | null) {
  const [row, setRow] = useState<ScoutRollsRow | null>(null)
  // Vários componentes (widget da mesa + ferramentas do Mestre) podem usar
  // este hook ao mesmo tempo para o mesmo mesaId. Um nome de canal fixo
  // colidiria: o supabase-js reaproveita o canal pelo nome e rejeita
  // registrar um novo callback nele depois do primeiro subscribe(). Um
  // sufixo aleatório por instância evita a colisão.
  const instanceId = useRef(Math.random().toString(36).slice(2))

  useEffect(() => {
    if (!supabase || !mesaId) return
    let cancelled = false

    supabase
      .from('scout_rolls')
      .select('mesa_id, total, contributors')
      .eq('mesa_id', mesaId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setRow(data as ScoutRollsRow)
      })

    const channel = supabase
      .channel(`scouts-${mesaId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scout_rolls',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => setRow(payload.new as ScoutRollsRow),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId])

  return row
}

// Retorna false sem escrever nada se este usuário já contribuiu nesta
// rodada (evita contar o mesmo Treinador duas vezes na soma).
export async function contributeScoutRoll(
  mesaId: string,
  current: ScoutRollsRow,
  name: string,
  successes: number,
): Promise<boolean> {
  if (!supabase) return false
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  if (current.contributors.some((c) => c.userId === user.id)) return false
  const contributors = [
    ...current.contributors,
    { name, successes, at: Date.now(), userId: user.id },
  ].slice(-30)
  await supabase
    .from('scout_rolls')
    .update({
      total: current.total + successes,
      contributors,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('mesa_id', mesaId)
  return true
}

export async function resetScoutRolls(mesaId: string) {
  if (!supabase) return
  await supabase
    .from('scout_rolls')
    .update({ total: 0, contributors: [], updated_at: new Date().toISOString() })
    .eq('mesa_id', mesaId)
}
