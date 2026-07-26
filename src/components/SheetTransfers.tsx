import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import type { PokemonSheet } from '../types'
import { supabase } from '../lib/supabase'
import { pokemonById, spriteUrl } from '../data'

interface TransferRow {
  id: string
  mesa_id: string
  from_user_id: string
  to_user_id: string
  payload: PokemonSheet
  created_at: string
}

// Ofertas de Pokémon do Mestre pendentes pra mim nesta mesa (ele entrega
// pela aba "Ferramentas do Mestre" → Presentear). Aceitar soma a ficha no
// meu Dexie local; recusar só descarta a oferta.
export default function SheetTransfers({
  mesaId,
  myId,
  myActiveTrainerId,
  usernames,
}: {
  mesaId: string
  myId: string
  myActiveTrainerId: number | undefined
  usernames: Record<string, string>
}) {
  const [pending, setPending] = useState<TransferRow[]>([])
  const [notice, setNotice] = useState('')
  const instanceId = useRef(Math.random().toString(36).slice(2))

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    supabase
      .from('sheet_transfers')
      .select('id, mesa_id, from_user_id, to_user_id, payload, created_at')
      .eq('mesa_id', mesaId)
      .eq('to_user_id', myId)
      .then(({ data }) => {
        if (cancelled || !data) return
        setPending(data as TransferRow[])
      })

    const channel = supabase
      .channel(`transfers-${mesaId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sheet_transfers',
          filter: `to_user_id=eq.${myId}`,
        },
        (payload) => {
          const row = payload.new as TransferRow
          if (row.mesa_id !== mesaId) return
          setPending((prev) => [...prev, row])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sheet_transfers',
        },
        (payload) => {
          const row = payload.old as { id: string }
          setPending((prev) => prev.filter((p) => p.id !== row.id))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId, myId])

  const accept = async (t: TransferRow) => {
    if (!myActiveTrainerId) {
      setNotice('Selecione um Treinador ativo em "Treinadores" antes de aceitar.')
      return
    }
    const payload = { ...t.payload }
    delete (payload as { id?: number }).id
    await db.pokemonSheets.add({
      ...payload,
      trainerId: myActiveTrainerId,
      isNpc: false,
      npcKind: undefined,
      inTeam: false,
    })
    await supabase?.from('sheet_transfers').delete().eq('id', t.id)
    setPending((prev) => prev.filter((p) => p.id !== t.id))
  }

  const decline = async (t: TransferRow) => {
    await supabase?.from('sheet_transfers').delete().eq('id', t.id)
    setPending((prev) => prev.filter((p) => p.id !== t.id))
  }

  if (pending.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-purple-300 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-purple-600 px-4 py-2.5 text-white">
        <b>🎁 Pokémon do Mestre</b>
      </div>
      <div className="space-y-1.5 p-4">
        {pending.map((t) => {
          const sp = pokemonById.get(t.payload.species)
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5"
            >
              {sp && (
                <img
                  src={spriteUrl(sp.id)}
                  alt=""
                  className="h-7 w-7 object-contain [image-rendering:pixelated]"
                  onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                />
              )}
              <span className="flex-1 text-sm text-slate-700">
                <b>{t.payload.nickname || sp?.name}</b> · {t.payload.rank} — de{' '}
                {usernames[t.from_user_id] ?? 'Mestre'}
              </span>
              <button
                onClick={() => accept(t)}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Aceitar
              </button>
              <button
                onClick={() => decline(t)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Recusar
              </button>
            </div>
          )
        })}
        {notice && (
          <p
            className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600"
            onClick={() => setNotice('')}
          >
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}
