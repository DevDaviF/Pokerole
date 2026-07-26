import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export interface MoneyAdjustmentRow {
  id: string
  mesa_id: string
  from_user_id: string
  to_user_id: string
  amount: number // positivo = credita, negativo = debita
  created_at: string
}

// Ajustes de dinheiro pendentes PRA MIM nesta mesa. Só o Mestre manda (RLS
// exige is_mesa_gm) — é uma correção autoritativa, não um presente que dá
// pra recusar, então o cliente aplica sozinho e apaga a linha.
export function useMoneyAdjustments(
  mesaId: string | null,
  myId: string | null,
): MoneyAdjustmentRow[] {
  const [rows, setRows] = useState<MoneyAdjustmentRow[]>([])
  const instanceId = useRef(Math.random().toString(36).slice(2))

  useEffect(() => {
    if (!supabase || !mesaId || !myId) return
    let cancelled = false

    supabase
      .from('money_adjustments')
      .select('*')
      .eq('mesa_id', mesaId)
      .eq('to_user_id', myId)
      .then(({ data }) => {
        if (cancelled || !data) return
        setRows(data as MoneyAdjustmentRow[])
      })

    const channel = supabase
      .channel(`money-adjustments-${mesaId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'money_adjustments',
          filter: `to_user_id=eq.${myId}`,
        },
        (payload) => {
          const row = payload.new as MoneyAdjustmentRow
          if (row.mesa_id !== mesaId) return
          setRows((prev) => [...prev.filter((r) => r.id !== row.id), row])
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId, myId])

  return rows
}

export async function sendMoneyAdjustment(
  mesaId: string,
  toUserId: string,
  amount: number,
) {
  if (!supabase || !amount) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('money_adjustments').insert({
    mesa_id: mesaId,
    from_user_id: user.id,
    to_user_id: toUserId,
    amount,
  })
}

export async function deleteMoneyAdjustment(id: string) {
  if (!supabase) return
  await supabase.from('money_adjustments').delete().eq('id', id)
}
