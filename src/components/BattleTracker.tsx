import { useEffect, useState } from 'react'
import type { PokemonSheet, Trainer } from '../types'
import { supabase } from '../lib/supabase'
import { useMesa } from '../lib/mesa'
import { rollAdditive } from './DiceRoller'
import { pokemonById, spriteUrl } from '../data'

export interface Combatant {
  key: string
  name: string
  kind: 'pokemon' | 'trainer' | 'npc'
  spriteId?: string
  initiative: number
  ownerLabel?: string
}

interface BattleRow {
  mesa_id: string
  combatants: Combatant[]
  current_key: string | null
  started: boolean
  round: number
}

const dexAlert = (entity: {
  attributes: { dexterity: number }
  skills: Record<string, number>
}) => entity.attributes.dexterity + (entity.skills['Alert'] ?? 0)

const newKey = () => Math.random().toString(36).slice(2, 10)

export default function BattleTracker({
  mesaId,
  myPokemonSheets,
  myTrainer,
  sharedNpcs,
  myUsername,
}: {
  mesaId: string
  myPokemonSheets: PokemonSheet[]
  myTrainer: Trainer | undefined
  sharedNpcs: Array<{ id: string; payload: PokemonSheet }>
  myUsername: string
}) {
  const { postRoll } = useMesa()
  const [row, setRow] = useState<BattleRow | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    supabase
      .from('battle_order')
      .select('mesa_id, combatants, current_key, started, round')
      .eq('mesa_id', mesaId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setRow(data as BattleRow)
      })

    const channel = supabase
      .channel(`battle-${mesaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_order',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => setRow(payload.new as BattleRow),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId])

  const persist = async (next: Partial<BattleRow>) => {
    if (!supabase || !row) return
    const merged = { ...row, ...next }
    setRow(merged) // otimista
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase
      .from('battle_order')
      .update({
        combatants: merged.combatants,
        current_key: merged.current_key,
        started: merged.started,
        round: merged.round,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq('mesa_id', mesaId)
  }

  const addCombatant = async (
    name: string,
    kind: Combatant['kind'],
    spriteId: string | undefined,
    bonus: number,
    ownerLabel?: string,
  ) => {
    if (!row) return
    const r = rollAdditive(bonus, `${name} · Iniciativa`)
    postRoll(r)
    const combatant: Combatant = {
      key: newKey(),
      name,
      kind,
      spriteId,
      initiative: r.total!,
      ownerLabel,
    }
    const combatants = [...row.combatants, combatant].sort(
      (a, b) => b.initiative - a.initiative,
    )
    // Antes do combate "começar" (1º Passar a vez), quem tem a vez é
    // sempre recalculado como a maior iniciativa da lista atual — não
    // trava em quem foi adicionado primeiro. Depois de começado, novas
    // entradas (Pokémon trocado em campo, reforços) não atrapalham o
    // turno de quem já está jogando.
    await persist({
      combatants,
      current_key: row.started
        ? (row.current_key ?? combatants[0].key)
        : combatants[0].key,
    })
    setShowAdd(false)
  }

  const removeCombatant = async (key: string) => {
    if (!row) return
    const combatants = row.combatants.filter((c) => c.key !== key)
    let currentKey = row.current_key
    if (!row.started) {
      // ainda montando a lista: a vez sempre acompanha a maior iniciativa
      currentKey = combatants[0]?.key ?? null
    } else if (currentKey === key) {
      const idx = row.combatants.findIndex((c) => c.key === key)
      currentKey = combatants[idx]?.key ?? combatants[0]?.key ?? null
    }
    await persist({ combatants, current_key: currentKey })
  }

  const nextTurn = async () => {
    if (!row || row.combatants.length === 0) return
    const idx = row.combatants.findIndex((c) => c.key === row.current_key)
    const nextIdx = idx === -1 ? 0 : (idx + 1) % row.combatants.length
    const wrapped = idx !== -1 && nextIdx === 0
    await persist({
      current_key: row.combatants[nextIdx].key,
      started: true,
      round: wrapped ? row.round + 1 : row.round,
    })
  }

  const resetBattle = async () => {
    if (!confirm('Encerrar a batalha e limpar a ordem de combate?')) return
    await persist({ combatants: [], current_key: null, started: false, round: 1 })
  }

  if (!row) return null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-2.5 text-white">
        <b>⚔️ Ordem de Combate</b>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">
          Round {row.round}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold hover:bg-white/25"
          >
            + Adicionar
          </button>
          {row.combatants.length > 0 && (
            <button
              onClick={resetBattle}
              className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold hover:bg-white/25"
            >
              Encerrar
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="space-y-2 border-b border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-500 uppercase">
            Rolar iniciativa e adicionar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {myTrainer && (
              <button
                onClick={() =>
                  addCombatant(
                    myTrainer.name,
                    'trainer',
                    undefined,
                    dexAlert(myTrainer),
                    myUsername,
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                🧑 {myTrainer.name}
              </button>
            )}
            {myPokemonSheets.map((s) => {
              const sp = pokemonById.get(s.species)
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    addCombatant(
                      s.nickname || sp?.name || '?',
                      'pokemon',
                      sp?.id,
                      dexAlert(s),
                      myUsername,
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {sp && (
                    <img
                      src={spriteUrl(sp.id)}
                      alt=""
                      className="h-5 w-5 object-contain [image-rendering:pixelated]"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = 'hidden')
                      }
                    />
                  )}
                  {s.nickname || sp?.name}
                </button>
              )
            })}
            {sharedNpcs.map((n) => {
              const sp = pokemonById.get(n.payload.species)
              return (
                <button
                  key={n.id}
                  onClick={() =>
                    addCombatant(
                      n.payload.nickname || sp?.name || '?',
                      'npc',
                      sp?.id,
                      dexAlert(n.payload),
                      'NPC',
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                >
                  {sp && (
                    <img
                      src={spriteUrl(sp.id)}
                      alt=""
                      className="h-5 w-5 object-contain [image-rendering:pixelated]"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = 'hidden')
                      }
                    />
                  )}
                  {n.payload.nickname || sp?.name}
                </button>
              )
            })}
          </div>
          {!myTrainer && myPokemonSheets.length === 0 && sharedNpcs.length === 0 && (
            <p className="text-xs text-slate-400">
              Nada disponível ainda — crie fichas ou peça ao Mestre para
              publicar NPCs.
            </p>
          )}
        </div>
      )}

      <div className="p-4">
        {row.combatants.length === 0 ? (
          <p className="text-sm text-slate-400">
            Ninguém na ordem de combate. Adicione combatentes para rolar
            iniciativa.
          </p>
        ) : (
          <div className="space-y-1.5">
            {row.combatants.map((c) => {
              const isCurrent = c.key === row.current_key
              return (
                <div
                  key={c.key}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    isCurrent
                      ? 'border-amber-400 bg-amber-50 shadow-sm'
                      : 'border-slate-100 bg-white'
                  }`}
                >
                  {isCurrent && <span>▶</span>}
                  {c.spriteId && (
                    <img
                      src={spriteUrl(c.spriteId)}
                      alt=""
                      className="h-7 w-7 object-contain [image-rendering:pixelated]"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = 'hidden')
                      }
                    />
                  )}
                  <span className="text-sm font-semibold text-slate-700">
                    {c.name}
                  </span>
                  {c.ownerLabel && (
                    <span className="text-xs text-slate-400">
                      {c.ownerLabel}
                    </span>
                  )}
                  <span className="ml-auto rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-700">
                    ⚡ {c.initiative}
                  </span>
                  <button
                    onClick={() => removeCombatant(c.key)}
                    title="Remover (fugiu, desmaiou, saiu da batalha...)"
                    className="text-slate-300 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {row.combatants.length > 0 && (
          <button
            onClick={nextTurn}
            className="mt-3 w-full rounded-xl bg-slate-800 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] hover:bg-slate-700 active:scale-[0.99]"
          >
            ▶ Passar a vez
          </button>
        )}
      </div>
    </div>
  )
}
