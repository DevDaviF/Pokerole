import { useEffect, useState } from 'react'
import type { PokemonSheet, Trainer } from '../types'
import { db } from '../db'
import { pokemonById } from '../data'
import { useMesa } from '../lib/mesa'
import { supabase } from '../lib/supabase'

// Qualquer "comida" do item catalog serve de ração — todas têm "enough
// for one day"/alimentam o Pokémon por um dia (p.116 + itens extras).
// Ordem = prioridade de consumo (mais barata/genérica primeiro, guardando
// as com efeito especial — Gourmet, High-Performance — pra quando o
// jogador quiser usá-las de propósito).
const RATION_ITEM_IDS = ['dry-food', 'meal-rations', 'high-performance-food', 'gourmet-food']
const RATION_NAME = 'Ração'

interface TriggerRow {
  mesa_id: string
  triggered_at: string | null
  triggered_by: string | null
}

export default function DayPassPanel({
  myTrainer,
  myPokemonSheets,
  isGm,
}: {
  myTrainer: Trainer | undefined
  myPokemonSheets: PokemonSheet[]
  isGm: boolean
}) {
  const { session, activeMesa } = useMesa()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [trigger, setTrigger] = useState<TriggerRow | null>(null)

  const mesaId = activeMesa?.id
  const myId = session?.user.id

  // "Passar o dia" é decisão do Mestre pra mesa toda (p.ex. evita jogador
  // descansando fora do ritmo da história) — o Mestre decreta aqui, e
  // cada Treinador (incluindo o do Mestre) aplica o descanso na própria
  // ficha local ao ver o gatilho mudar.
  useEffect(() => {
    if (!supabase || !mesaId) return
    let cancelled = false

    supabase
      .from('day_pass_triggers')
      .select('mesa_id, triggered_at, triggered_by')
      .eq('mesa_id', mesaId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setTrigger(data as TriggerRow)
      })

    const channel = supabase
      .channel(`daypass-${mesaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'day_pass_triggers',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => setTrigger(payload.new as TriggerRow),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId])

  const lastAppliedKey = mesaId ? `daypass-applied:${mesaId}` : null
  const lastApplied = lastAppliedKey ? localStorage.getItem(lastAppliedKey) : null
  const pendingApply = Boolean(
    trigger?.triggered_at && trigger.triggered_at !== lastApplied,
  )

  const team = myPokemonSheets.filter((s) => s.inTeam)
  const needed = team.length
  const inventory = myTrainer?.inventory ?? []
  const haveRations = inventory
    .filter((e) => RATION_ITEM_IDS.includes(e.itemId))
    .reduce((sum, e) => sum + e.qty, 0)

  const announce = async (content: string) => {
    if (!session || !activeMesa || !supabase) return
    await supabase.from('messages').insert({
      mesa_id: activeMesa.id,
      user_id: session.user.id,
      kind: 'chat',
      content,
    })
  }

  const triggerPartyDayPass = async () => {
    if (!supabase || !mesaId || !myId) return
    await supabase
      .from('day_pass_triggers')
      .update({ triggered_at: new Date().toISOString(), triggered_by: myId })
      .eq('mesa_id', mesaId)
    await announce(
      '🌙 O Mestre decretou que o dia passou! Cada Treinador deve aplicar o descanso.',
    )
  }

  const applyDayPass = async () => {
    if (!myTrainer?.id) return
    setBusy(true)
    setNotice('')

    // consome o que tiver (até o necessário), na ordem de prioridade de
    // RATION_ITEM_IDS — se faltar, só avisa no chat; o descanso acontece
    // igual, a punição por falta de ração fica a critério do Mestre
    const consumed = Math.min(haveRations, needed)
    const short = needed - consumed
    if (consumed > 0) {
      const toConsume: Record<string, number> = {}
      let remaining = consumed
      for (const itemId of RATION_ITEM_IDS) {
        if (remaining <= 0) break
        const have = inventory.find((e) => e.itemId === itemId)?.qty ?? 0
        const used = Math.min(have, remaining)
        if (used > 0) {
          toConsume[itemId] = used
          remaining -= used
        }
      }
      const nextInventory = inventory
        .map((e) =>
          toConsume[e.itemId] ? { ...e, qty: e.qty - toConsume[e.itemId] } : e,
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
        `⚠️ ${myTrainer.name} não tinha ração suficiente hoje! Faltaram ${short} de ${needed}.`,
      )
    } else {
      await announce(
        `🌙 ${myTrainer.name} passou o dia e descansou${consumed > 0 ? ` (−${consumed} ${RATION_NAME}${consumed > 1 ? 'ões' : ''})` : ''}. Time totalmente recuperado.`,
      )
    }
    setNotice(
      short > 0
        ? `Dia passado, mas faltou ração (${short}). Time recuperado mesmo assim.`
        : 'Dia passado! Treinador e time recuperados.',
    )
    if (lastAppliedKey && trigger?.triggered_at) {
      localStorage.setItem(lastAppliedKey, trigger.triggered_at)
    }
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
          descanso: recupera HP do treinador e do time, limpa status. Só o
          Mestre decide quando o dia passa pra mesa toda.
        </p>
        {isGm && (
          <button
            onClick={triggerPartyDayPass}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-bold text-amber-700 hover:bg-amber-100"
          >
            🌙 Decretar que o dia passou (mesa toda)
          </button>
        )}
        {pendingApply ? (
          <button
            onClick={applyDayPass}
            disabled={busy}
            className="block rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? 'Passando o dia...' : '🌙 Aplicar descanso ao meu Treinador'}
          </button>
        ) : (
          !isGm && (
            <p className="text-xs text-slate-400">
              Aguardando o Mestre decretar o dia.
            </p>
          )
        )}
        {notice && <p className="text-xs text-slate-500">{notice}</p>}
      </div>
    </div>
  )
}
