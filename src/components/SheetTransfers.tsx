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

// Transferência de fichas de Pokémon do Mestre para um jogador (ex: captura
// bem-sucedida). O destinatário aceita e a ficha vira dele no Dexie local.
export default function SheetTransfers({
  mesaId,
  myId,
  myRole,
  members,
  usernames,
  myActiveTrainerId,
  gmPokemonSheets,
}: {
  mesaId: string
  myId: string
  myRole: 'gm' | 'player' | null
  members: Array<{ user_id: string; role: 'gm' | 'player' }>
  usernames: Record<string, string>
  myActiveTrainerId: number | undefined
  gmPokemonSheets: PokemonSheet[]
}) {
  const [pending, setPending] = useState<TransferRow[]>([])
  const [offeringId, setOfferingId] = useState<number | ''>('')
  const [targetUser, setTargetUser] = useState('')
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

  const sendTransfer = async () => {
    if (!supabase || !offeringId || !targetUser) return
    const sheet = gmPokemonSheets.find((s) => s.id === offeringId)
    if (!sheet) return
    const { error } = await supabase.from('sheet_transfers').insert({
      mesa_id: mesaId,
      from_user_id: myId,
      to_user_id: targetUser,
      payload: sheet,
    })
    if (error) setNotice(error.message)
    else {
      setNotice('Ficha oferecida! Aguardando o jogador aceitar.')
      setOfferingId('')
    }
  }

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

  const otherMembers = members.filter((m) => m.user_id !== myId)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-2.5 text-white">
        <b>🎁 Transferência de fichas</b>
      </div>

      <div className="space-y-3 p-4">
        {myRole === 'gm' && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-2.5">
            <p className="text-xs font-bold text-slate-500 uppercase">
              Entregar Pokémon a um jogador
            </p>
            {gmPokemonSheets.length === 0 ? (
              <p className="text-xs text-slate-400">
                Crie um Pokémon em "Meus Pokémon" primeiro (ex: um Pokémon
                selvagem gerado nas Ferramentas do Mestre).
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={offeringId}
                  onChange={(e) =>
                    setOfferingId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none"
                >
                  <option value="">Escolha um Pokémon...</option>
                  {gmPokemonSheets.map((s) => {
                    const sp = pokemonById.get(s.species)
                    return (
                      <option key={s.id} value={s.id}>
                        {s.nickname || sp?.name} · {s.rank}
                      </option>
                    )
                  })}
                </select>
                <span className="text-xs text-slate-400">para</span>
                <select
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  className="rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none"
                >
                  <option value="">Escolha o jogador...</option>
                  {otherMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {usernames[m.user_id] ?? m.user_id}
                    </option>
                  ))}
                </select>
                <button
                  onClick={sendTransfer}
                  disabled={!offeringId || !targetUser}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-40"
                >
                  Entregar
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-bold text-slate-500 uppercase">
            Ofertas para você
          </p>
          {pending.length === 0 ? (
            <p className="text-xs text-slate-400">Nada pendente.</p>
          ) : (
            <div className="space-y-1.5">
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
            </div>
          )}
        </div>

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
