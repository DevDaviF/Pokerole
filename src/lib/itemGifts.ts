import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export interface ItemGiftRow {
  id: string
  mesa_id: string
  from_user_id: string
  to_user_id: string
  item_id: string
  item_name: string
  qty: number
  created_at: string
}

// Presentes de item pendentes PRA MIM nesta mesa. Mestre manda (RLS exige
// is_mesa_gm), eu aceito (soma no meu inventário local) ou recuso — os dois
// casos só apagam a linha.
export function useItemGifts(mesaId: string | null, myId: string | null): ItemGiftRow[] {
  const [rows, setRows] = useState<ItemGiftRow[]>([])
  const instanceId = useRef(Math.random().toString(36).slice(2))

  useEffect(() => {
    if (!supabase || !mesaId || !myId) return
    let cancelled = false

    supabase
      .from('item_gifts')
      .select('*')
      .eq('mesa_id', mesaId)
      .eq('to_user_id', myId)
      .then(({ data }) => {
        if (cancelled || !data) return
        setRows(data as ItemGiftRow[])
      })

    const channel = supabase
      .channel(`item-gifts-${mesaId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'item_gifts',
          filter: `to_user_id=eq.${myId}`,
        },
        (payload) => {
          const row = payload.new as ItemGiftRow
          if (row.mesa_id !== mesaId) return
          setRows((prev) => [...prev.filter((r) => r.id !== row.id), row])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'item_gifts',
        },
        (payload) => {
          const row = payload.old as { id: string }
          setRows((prev) => prev.filter((r) => r.id !== row.id))
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

export async function sendItemGift(
  mesaId: string,
  toUserId: string,
  item: { id: string; name: string },
  qty: number,
) {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('item_gifts').insert({
    mesa_id: mesaId,
    from_user_id: user.id,
    to_user_id: toUserId,
    item_id: item.id,
    item_name: item.name,
    qty,
  })
}

export async function deleteItemGift(id: string) {
  if (!supabase) return
  await supabase.from('item_gifts').delete().eq('id', id)
}
