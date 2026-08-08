import { useEffect, useRef, useState } from 'react'
import type { Item } from '../types'
import { supabase } from './supabase'

export interface CustomItemRow {
  id: string
  mesa_id: string
  created_by: string | null
  name: string
  description: string
  pocket: string
  price: number
  one_use: boolean
  created_at: string
}

// Itens customizados criados pelo Mestre pra esta mesa, no formato do
// catálogo estático (Item) — assim a Shop trata os dois iguais.
export function customItemToItem(row: CustomItemRow): Item {
  return {
    id: `custom:${row.id}`,
    name: `${row.name} 🛠️`,
    pocket: row.pocket,
    category: '',
    description: row.description,
    price: String(row.price),
    oneUse: row.one_use,
  }
}

export function useCustomItems(mesaId: string | null): CustomItemRow[] {
  const [rows, setRows] = useState<CustomItemRow[]>([])
  const instanceId = useRef(Math.random().toString(36).slice(2))

  useEffect(() => {
    if (!supabase || !mesaId) return
    let cancelled = false

    supabase
      .from('custom_items')
      .select('*')
      .eq('mesa_id', mesaId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return
        setRows(data as CustomItemRow[])
      })

    const channel = supabase
      .channel(`custom-items-${mesaId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'custom_items',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => {
          const row = payload.new as CustomItemRow
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'custom_items',
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
  }, [mesaId])

  return rows
}

export async function createCustomItem(
  mesaId: string,
  item: { name: string; description: string; pocket: string; price: number; oneUse: boolean },
) {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.from('custom_items').insert({
    mesa_id: mesaId,
    created_by: user?.id,
    name: item.name,
    description: item.description,
    pocket: item.pocket,
    price: item.price,
    one_use: item.oneUse,
  })
}

export async function deleteCustomItem(id: string) {
  if (!supabase) return
  await supabase.from('custom_items').delete().eq('id', id)
}
