import { useEffect, useState } from 'react'
import { db } from '../db'
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
  currentHp: number
  maxHp: number
  def?: number // Vitality — usado pra reduzir o pool de Dano físico (p.60)
  spDef?: number // Insight — usado pra reduzir o pool de Dano especial
  statusConditions: string[]
  // permitem "escrever de volta" na ficha de origem quando quem edita o HP
  // é o próprio dono (viewer local) — ver updateHp()
  ownerId?: string
  localId?: number
  sourceKind?: 'pokemonSheet' | 'trainerSheet' | 'sharedNpc'
  sharedSheetId?: string
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

// Blinda contra linhas antigas/parciais vindas do Supabase (realtime ou
// fetch inicial) — nunca deixa `combatants`/`statusConditions`/HP
// undefined chegar no render (se a migration-6 — REPLICA IDENTITY FULL —
// ainda não rodou, updates em colunas jsonb grandes podem chegar
// incompletos via realtime).
function normalizeRow(data: BattleRow): BattleRow {
  return {
    ...data,
    combatants: (data.combatants ?? []).map((c) => ({
      ...c,
      statusConditions: c.statusConditions ?? [],
      currentHp: c.currentHp ?? 0,
      maxHp: c.maxHp ?? Math.max(1, c.currentHp ?? 1),
    })),
  }
}

function pokemonMaxHp(attrs: { vitality: number }, speciesId: string) {
  const sp = pokemonById.get(speciesId)
  return (sp?.baseHp ?? 1) + attrs.vitality
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const color =
    pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// Estado grosseiro de HP pra quem não pode ver o número exato (Pokémon
// selvagem visto por um Jogador) — dá uma noção sem revelar o HP real.
function hpStatusLabel(current: number, max: number): string {
  if (current <= 0) return '💀 Desmaiado'
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return '🟢 Firme'
  if (pct > 0.25) return '🟡 Ferido'
  return '🔴 Crítico'
}

export default function BattleTracker({
  mesaId,
  myId,
  myPokemonSheets,
  myTrainer,
  sharedNpcs,
  myUsername,
  isGm,
}: {
  mesaId: string
  myId: string
  myPokemonSheets: PokemonSheet[]
  myTrainer: Trainer | undefined
  sharedNpcs: Array<{ id: string; ownerId: string; payload: PokemonSheet }>
  myUsername: string
  isGm: boolean
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
        setRow(normalizeRow(data as BattleRow))
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
        (payload) => setRow(normalizeRow(payload.new as BattleRow)),
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

  // A ordem é o próprio array: quem está no índice 0 é quem tem a vez.
  // "Passar a vez" tira o primeiro e bota no fim da fila — reordena de
  // verdade, não só move um ponteiro sobre uma lista fixa por iniciativa.
  const addCombatant = async (combatant: Omit<Combatant, 'key' | 'initiative'>, bonus: number) => {
    if (!row) return
    const r = rollAdditive(bonus, `${combatant.name} · Iniciativa`)
    if (combatant.spriteId) r.icon = spriteUrl(combatant.spriteId)
    postRoll(r)
    const full: Combatant = { ...combatant, key: newKey(), initiative: r.total! }
    // antes do combate começar, a lista toda é reordenada por iniciativa;
    // depois de começado, reforços entram no fim da fila (agem na próxima
    // rodada, sem atrapalhar quem já está jogando)
    const combatants = row.started
      ? [...row.combatants, full]
      : [...row.combatants, full].sort((a, b) => b.initiative - a.initiative)
    await persist({ combatants, current_key: combatants[0]?.key ?? null })
    setShowAdd(false)
  }

  const removeCombatant = async (key: string) => {
    if (!row) return
    const combatants = row.combatants.filter((c) => c.key !== key)
    await persist({ combatants, current_key: combatants[0]?.key ?? null })
  }

  const nextTurn = async () => {
    if (!row || row.combatants.length === 0) return
    const [current, ...rest] = row.combatants
    const combatants = [...rest, current]
    await persist({
      combatants,
      current_key: combatants[0]?.key ?? null,
      started: true,
      // `round` guarda o total de turnos passados (não o número exibido);
      // o badge calcula Math.floor(round / combatants.length) + 1
      round: row.round + 1,
    })
  }

  const resetBattle = async () => {
    if (!confirm('Encerrar a batalha e limpar a ordem de combate?')) return
    await persist({ combatants: [], current_key: null, started: false, round: 0 })
  }

  // Ajusta o HP de um combatente. Qualquer um na mesa pode ajustar (agiliza
  // a batalha), e se quem ajusta for o dono da ficha original, o valor
  // também é gravado na ficha de origem (Dexie local / shared_sheets).
  const adjustHp = async (key: string, delta: number) => {
    if (!row) return
    const target = row.combatants.find((c) => c.key === key)
    if (!target) return
    const nextHp = Math.max(0, Math.min(target.maxHp, target.currentHp + delta))
    const combatants = row.combatants.map((c) =>
      c.key === key ? { ...c, currentHp: nextHp } : c,
    )
    await persist({ combatants })

    if (target.ownerId !== myId || target.localId === undefined) return
    if (target.sourceKind === 'trainerSheet') {
      await db.trainers.update(target.localId, { currentHp: nextHp })
    } else if (target.sourceKind === 'pokemonSheet' || target.sourceKind === 'sharedNpc') {
      await db.pokemonSheets.update(target.localId, { currentHp: nextHp })
      if (target.sharedSheetId && supabase) {
        // não dá pra sobrescrever `payload` só com currentHp — apagaria o
        // resto da ficha. Busca o payload atual e mescla.
        const { data: existing } = await supabase
          .from('shared_sheets')
          .select('payload')
          .eq('id', target.sharedSheetId)
          .single()
        if (existing) {
          await supabase
            .from('shared_sheets')
            .update({
              payload: { ...(existing.payload as object), currentHp: nextHp },
              updated_at: new Date().toISOString(),
            })
            .eq('id', target.sharedSheetId)
        }
      }
    }
  }

  if (!row) return null

  const displayRound =
    row.combatants.length > 0 ? Math.floor(row.round / row.combatants.length) + 1 : 1

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-2.5 text-white">
        <b>⚔️ Ordem de Combate</b>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold">
          Round {displayRound}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold hover:bg-white/25"
          >
            + Adicionar
          </button>
          {isGm && row.combatants.length > 0 && (
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
                    {
                      name: myTrainer.name,
                      kind: 'trainer',
                      ownerLabel: myUsername,
                      currentHp: myTrainer.currentHp,
                      maxHp: myTrainer.hp,
                      def: myTrainer.attributes.vitality,
                      spDef: myTrainer.attributes.insight,
                      statusConditions: [],
                      ownerId: myId,
                      localId: myTrainer.id,
                      sourceKind: 'trainerSheet',
                    },
                    dexAlert(myTrainer),
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
                      {
                        name: s.nickname || sp?.name || '?',
                        kind: 'pokemon',
                        spriteId: sp?.id,
                        ownerLabel: myUsername,
                        currentHp: s.currentHp,
                        maxHp: pokemonMaxHp(s.attributes, s.species),
                        def: s.attributes.vitality,
                        spDef: s.attributes.insight,
                        statusConditions: s.statusConditions,
                        ownerId: myId,
                        localId: s.id,
                        sourceKind: 'pokemonSheet',
                      },
                      dexAlert(s),
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
            {isGm && sharedNpcs.map((n) => {
              const sp = pokemonById.get(n.payload.species)
              return (
                <button
                  key={n.id}
                  onClick={() =>
                    addCombatant(
                      {
                        name: n.payload.nickname || sp?.name || '?',
                        kind: 'npc',
                        spriteId: sp?.id,
                        ownerLabel: 'NPC',
                        currentHp: n.payload.currentHp,
                        maxHp: pokemonMaxHp(n.payload.attributes, n.payload.species),
                        def: n.payload.attributes.vitality,
                        spDef: n.payload.attributes.insight,
                        statusConditions: n.payload.statusConditions,
                        ownerId: n.ownerId,
                        localId: n.payload.id,
                        sourceKind: 'sharedNpc',
                        sharedSheetId: n.id,
                      },
                      dexAlert(n.payload),
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
            {row.combatants.map((c, index) => {
              const isCurrent = index === 0
              const hideExactHp = c.kind === 'npc' && !isGm
              return (
                <div
                  key={c.key}
                  className={`rounded-lg border px-3 py-2 transition-colors ${
                    isCurrent
                      ? 'border-amber-400 bg-amber-50 shadow-sm'
                      : 'border-slate-100 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
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
                    {c.statusConditions.length > 0 && (
                      <span className="flex gap-1">
                        {c.statusConditions.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700"
                          >
                            {s}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="ml-auto rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-700">
                      ⚡ {c.initiative}
                    </span>
                    {(isGm || c.ownerId === myId) && (
                      <button
                        onClick={() => removeCombatant(c.key)}
                        title="Remover (fugiu, desmaiou, saiu da batalha...)"
                        className="text-slate-300 hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-1">
                    <button
                      onClick={() => adjustHp(c.key, -1)}
                      className="h-5 w-5 shrink-0 rounded border border-slate-300 text-xs font-bold text-slate-500 hover:bg-slate-100"
                    >
                      −
                    </button>
                    {hideExactHp ? (
                      <span className="flex-1 text-center text-[11px] font-semibold text-slate-500">
                        {hpStatusLabel(c.currentHp, c.maxHp)}
                      </span>
                    ) : (
                      <div className="flex-1">
                        <HpBar current={c.currentHp} max={c.maxHp} />
                      </div>
                    )}
                    <button
                      onClick={() => adjustHp(c.key, 1)}
                      className="h-5 w-5 shrink-0 rounded border border-slate-300 text-xs font-bold text-slate-500 hover:bg-slate-100"
                    >
                      +
                    </button>
                    {!hideExactHp && (
                      <span className="w-14 shrink-0 text-right text-[11px] font-semibold text-slate-500">
                        {c.currentHp}/{c.maxHp} HP
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {row.combatants.length > 0 &&
          (isGm ? (
            <button
              onClick={nextTurn}
              className="mt-3 w-full rounded-xl bg-slate-800 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] hover:bg-slate-700 active:scale-[0.99]"
            >
              ▶ Passar a vez
            </button>
          ) : (
            <p className="mt-3 text-center text-xs text-slate-400">
              Só o Mestre passa a vez.
            </p>
          ))}
      </div>
    </div>
  )
}
