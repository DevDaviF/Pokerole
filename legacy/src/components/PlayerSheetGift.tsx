import { useState } from 'react'
import type { PokemonSheet } from '../types'
import { pokemonById, spriteUrl } from '../data'
import { sendSheetTransfer } from '../lib/sheetTransfers'

// Qualquer jogador pode oferecer um Pokémon seu pra outro membro da mesa
// (não só o Mestre) — a RLS de sheet_transfers já permite isso, só
// faltava a interface. O destinatário aceita/recusa em "Pokémon
// recebidos" (SheetTransfers.tsx).
export default function PlayerSheetGift({
  mesaId,
  myId,
  myPokemonSheets,
  members,
  usernames,
}: {
  mesaId: string
  myId: string
  myPokemonSheets: PokemonSheet[]
  members: Array<{ user_id: string; role: 'gm' | 'player' }>
  usernames: Record<string, string>
}) {
  const [sheetId, setSheetId] = useState<number | ''>('')
  const [targetUser, setTargetUser] = useState('')
  const [notice, setNotice] = useState('')

  const myOwnSheets = myPokemonSheets.filter((s) => !s.isNpc)
  const others = members.filter((m) => m.user_id !== myId)

  if (others.length === 0) return null

  const send = async () => {
    if (!sheetId || !targetUser) return
    const sheet = myOwnSheets.find((s) => s.id === sheetId)
    if (!sheet) return
    const { error } = await sendSheetTransfer(mesaId, targetUser, sheet)
    if (error) setNotice(error)
    else {
      setNotice(`Ficha oferecida pra ${usernames[targetUser] ?? 'jogador'}!`)
      setSheetId('')
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-700 px-4 py-2.5 text-white">
        <b>🔁 Passar um Pokémon meu pra outro jogador</b>
      </div>
      <div className="space-y-2 p-4">
        {myOwnSheets.length === 0 ? (
          <p className="text-xs text-slate-400">
            Você não tem nenhuma ficha de Pokémon própria ainda.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value ? Number(e.target.value) : '')}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Escolha um Pokémon seu...</option>
              {myOwnSheets.map((s) => {
                const sp = pokemonById.get(s.species)
                return (
                  <option key={s.id} value={s.id}>
                    {s.nickname || sp?.name} (Rank {s.rank})
                  </option>
                )
              })}
            </select>
            <select
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Pra quem...</option>
              {others.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {usernames[m.user_id] ?? m.user_id}
                  {m.role === 'gm' ? ' (Mestre)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={send}
              disabled={!sheetId || !targetUser}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {sheetId && (
                <img
                  src={spriteUrl(myOwnSheets.find((s) => s.id === sheetId)?.species ?? '')}
                  alt=""
                  className="h-4 w-4 object-contain [image-rendering:pixelated]"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              Oferecer
            </button>
          </div>
        )}
        {notice && (
          <p
            className="cursor-pointer text-xs text-emerald-600"
            onClick={() => setNotice('')}
          >
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}
