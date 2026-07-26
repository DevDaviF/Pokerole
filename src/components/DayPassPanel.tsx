import { useState } from 'react'
import type { PokemonSheet, Trainer } from '../types'
import { db } from '../db'
import { pokemonById } from '../data'
import { useMesa } from '../lib/mesa'
import { supabase } from '../lib/supabase'

const RATION_ITEM_ID = 'meal-rations'
const RATION_NAME = 'Ração'

export default function DayPassPanel({
  myTrainer,
  myPokemonSheets,
}: {
  myTrainer: Trainer | undefined
  myPokemonSheets: PokemonSheet[]
}) {
  const { session, activeMesa } = useMesa()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const team = myPokemonSheets.filter((s) => s.inTeam)
  const needed = team.length
  const inventory = myTrainer?.inventory ?? []
  const rationEntry = inventory.find((e) => e.itemId === RATION_ITEM_ID)
  const haveRations = rationEntry?.qty ?? 0

  const announce = async (content: string) => {
    if (!session || !activeMesa || !supabase) return
    await supabase.from('messages').insert({
      mesa_id: activeMesa.id,
      user_id: session.user.id,
      kind: 'chat',
      content,
    })
  }

  const passDay = async () => {
    if (!myTrainer?.id) return
    setBusy(true)
    setNotice('')

    // consome o que tiver (até o necessário) — se faltar, só avisa no
    // chat; o descanso acontece igual, a punição por falta de ração fica
    // a critério do Mestre, narrativamente
    const consumed = Math.min(haveRations, needed)
    const short = needed - consumed
    if (consumed > 0) {
      const nextInventory = inventory
        .map((e) =>
          e.itemId === RATION_ITEM_ID ? { ...e, qty: e.qty - consumed } : e,
        )
        .filter((e) => e.qty > 0)
      await db.trainers.update(myTrainer.id, {
        inventory: nextInventory,
        currentHp: myTrainer.hp,
      })
    } else {
      await db.trainers.update(myTrainer.id, { currentHp: myTrainer.hp })
    }

    for (const s of team) {
      const sp = pokemonById.get(s.species)
      const maxHp = (sp?.baseHp ?? 1) + s.attributes.vitality
      await db.pokemonSheets.update(s.id!, {
        currentHp: maxHp,
        statusConditions: [],
      })
    }

    if (short > 0) {
      await announce(
        `⚠️ ${myTrainer.name} não tinha ração suficiente hoje! Faltaram ${short} de ${needed}. O time descansou mesmo assim.`,
      )
    }
    await announce(
      `🌙 ${myTrainer.name} passou o dia e descansou${consumed > 0 ? ` (−${consumed} ${RATION_NAME}${consumed > 1 ? 'ões' : ''})` : ''}. Time totalmente recuperado.`,
    )
    setNotice(
      short > 0
        ? `Dia passado, mas faltou ração (${short}). Time recuperado mesmo assim.`
        : 'Dia passado! Treinador e time recuperados.',
    )
    setBusy(false)
  }

  if (!myTrainer) return null

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-amber-600 px-4 py-2.5 text-white">
        <b>🌙 Passar o dia</b>
        <span className="ml-auto text-xs opacity-90">
          {needed} Pokémon no time · {haveRations} ração(ões)
        </span>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs text-slate-400">
          Consome 1 {RATION_NAME.toLowerCase()} por Pokémon no time e aplica
          descanso: recupera HP do treinador e do time, limpa status.
        </p>
        <button
          onClick={passDay}
          disabled={busy}
          className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? 'Passando o dia...' : '🌙 Passar o dia'}
        </button>
        {notice && <p className="text-xs text-slate-500">{notice}</p>}
      </div>
    </div>
  )
}
