import { useState } from 'react'
import { db } from '../db'
import type { PokemonSheet, Trainer } from '../types'
import { rollDice } from './DiceRoller'
import { sheetAttrValue } from './MoveRoll'
import { useMesa } from '../lib/mesa'
import { supabase } from '../lib/supabase'
import { pokemonById, spriteUrl } from '../data'
import {
  POKEMON_ATTRIBUTE_LABELS,
  TRAINER_ATTRIBUTE_LABELS,
  SOCIAL_LABELS,
  POKEMON_SKILL_GROUPS,
  TRAINER_SKILL_GROUPS,
} from '../constants'

const POKEMON_SKILLS = POKEMON_SKILL_GROUPS.flatMap((g) => g.skills)
const TRAINER_SKILLS = TRAINER_SKILL_GROUPS.flatMap((g) => g.skills)

const selectCls =
  'rounded-lg border-0 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none'

interface ResultRow {
  sheetId: number
  name: string
  daysTrained: number
  daysCompleted: number
  tpGained: number
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return result
}

// Chance de tirar >= difficulty sucessos numa pool de d6 (sucesso em 4/5/6,
// ou seja p=0.5 por dado).
function successChance(pool: number, difficulty: number): number {
  if (difficulty <= 0) return 1
  if (difficulty > pool) return 0
  let p = 0
  for (let k = difficulty; k <= pool; k++) p += combinations(pool, k)
  return p / 2 ** pool
}

// Já considerando a 2ª chance do Corebook (falhou, rola de novo).
function successChanceWithRetry(pool: number, difficulty: number): number {
  const p1 = successChance(pool, difficulty)
  return 1 - (1 - p1) ** 2
}

// Trunca (não arredonda pra cima) pra 1 casa decimal — 99.96% deve
// aparecer como "99.9%", não "100.0%".
function truncatedPercent(p: number): string {
  return (Math.floor(p * 1000) / 10).toFixed(1)
}

// Roda a sessão de treino (Corebook p.104-105: tarefa do Pokémon vs
// dificuldade, com 2ª chance em caso de falha; se passar, rolagem do
// Treinador + dificuldade = Pontos de Treino; os dois recuperam 2 WP)
// pra vários Pokémon de uma vez, sem precisar clicar rolar dia por dia,
// bicho por bicho. Cada Pokémon selecionado tem sua própria quantidade de
// dias de treino (não é dividido igualmente). O atributo/perícia do
// Treinador também pode variar por Pokémon (roleplay: arremesso pra um,
// incentivo gritado pra outro batendo num tronco...), então cada linha
// tem sua própria dupla de seletores, tanto do lado do Pokémon quanto do
// Treinador — cada opção já mostra o valor daquele atributo/perícia pra
// esse Pokémon/Treinador, junto com o total de dados da pool escolhida.
export default function BatchTraining({
  trainer,
  teamSheets,
}: {
  trainer: Trainer | undefined
  teamSheets: PokemonSheet[]
}) {
  const { session, activeMesa } = useMesa()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [pokAttrs, setPokAttrs] = useState<Record<number, string>>({})
  const [pokSkills, setPokSkills] = useState<Record<number, string>>({})
  const [trAttrs, setTrAttrs] = useState<Record<number, string>>({})
  const [trSkills, setTrSkills] = useState<Record<number, string>>({})
  const [days, setDays] = useState<Record<number, number>>({})
  const [difficulty, setDifficulty] = useState(2)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ResultRow[] | null>(null)

  const toggleSelected = (id: number) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  const selectedSheets = teamSheets.filter((s) => selected[s.id!])
  const totalDaysPlanned = selectedSheets.reduce(
    (sum, s) => sum + Math.max(1, days[s.id!] ?? 1),
    0,
  )

  const run = async () => {
    if (!trainer || selectedSheets.length === 0) return
    setBusy(true)
    setResults(null)

    const trWillMax = trainer.attributes.insight + 3
    let trainerWill = trainer.currentWill ?? trWillMax
    const rows: ResultRow[] = []

    for (const s of selectedSheets) {
      const daysForThis = Math.max(1, days[s.id!] ?? 1)
      const pokWillMax = s.attributes.insight + 3
      let pokWill = s.currentWill ?? pokWillMax
      let tpGained = 0
      let daysCompleted = 0

      const pokAttr = pokAttrs[s.id!] ?? 'Vitality'
      const pokSkill = pokSkills[s.id!] ?? 'Athletic'
      const pokPool = Math.max(
        1,
        sheetAttrValue(s, pokAttr) + (s.skills[pokSkill] ?? 0),
      )
      const trAttr = trAttrs[s.id!] ?? 'Cool'
      const trSkill = trSkills[s.id!] ?? 'Athletic'
      const trPool = Math.max(
        1,
        sheetAttrValue(trainer, trAttr) + (trainer.skills[trSkill] ?? 0),
      )

      for (let day = 0; day < daysForThis; day++) {
        let taskRoll = rollDice(pokPool)
        let passed = taskRoll.successes >= difficulty
        if (!passed) {
          // p.105: falhou, o livro dá uma 2ª chance no mesmo dia
          taskRoll = rollDice(pokPool)
          passed = taskRoll.successes >= difficulty
        }
        if (!passed) continue
        daysCompleted++

        const trRoll = rollDice(trPool)
        tpGained += trRoll.successes + difficulty
        pokWill = Math.min(pokWillMax, pokWill + 2)
        trainerWill = Math.min(trWillMax, trainerWill + 2)
      }

      await db.pokemonSheets.update(s.id!, {
        trainingPoints: (s.trainingPoints ?? 0) + tpGained,
        currentWill: pokWill,
      })
      rows.push({
        sheetId: s.id!,
        name: s.nickname || pokemonById.get(s.species)?.name || '?',
        daysTrained: daysForThis,
        daysCompleted,
        tpGained,
      })
    }

    await db.trainers.update(trainer.id!, { currentWill: trainerWill })
    setResults(rows)
    setBusy(false)

    if (supabase && session && activeMesa) {
      const summary = rows
        .map((r) => `${r.name} ${r.daysCompleted}/${r.daysTrained}d +${r.tpGained}TP`)
        .join(' · ')
      const totalDays = rows.reduce((sum, r) => sum + r.daysTrained, 0)
      await supabase.from('messages').insert({
        mesa_id: activeMesa.id,
        user_id: session.user.id,
        kind: 'chat',
        content: `🏋️ Treino em lote de ${trainer.name} (dif. ${difficulty}, ${totalDays} dia${totalDays === 1 ? '' : 's'} no total entre ${rows.length} Pokémon): ${summary}`,
      })
    }
  }

  if (!trainer || teamSheets.length === 0) return null

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-indigo-600 px-4 py-2 text-left text-white"
      >
        <b className="text-sm">🏋️ Treino em Lote</b>
        <span className="text-xs opacity-80">
          vários Pokémon, vários dias, 1 clique
        </span>
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Dificuldade</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className={selectCls}
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {selectedSheets.length > 0 && (
              <span className="text-[11px] text-slate-400">
                dias definidos individualmente por Pokémon abaixo — {totalDaysPlanned}{' '}
                dia{totalDaysPlanned === 1 ? '' : 's'} no total
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {teamSheets.map((s) => {
              const sp = pokemonById.get(s.species)
              const isSelected = Boolean(selected[s.id!])
              const pokAttr = pokAttrs[s.id!] ?? 'Vitality'
              const pokSkill = pokSkills[s.id!] ?? 'Athletic'
              const pokAttrValue = sheetAttrValue(s, pokAttr)
              const pokSkillValue = s.skills[pokSkill] ?? 0
              const pokPool = Math.max(1, pokAttrValue + pokSkillValue)
              const pokChance = successChanceWithRetry(pokPool, difficulty)
              const trAttr = trAttrs[s.id!] ?? 'Cool'
              const trSkill = trSkills[s.id!] ?? 'Athletic'
              const trAttrValue = trainer ? sheetAttrValue(trainer, trAttr) : 0
              const trSkillValue = trainer ? (trainer.skills[trSkill] ?? 0) : 0
              const trPool = Math.max(1, trAttrValue + trSkillValue)
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border px-2 py-1.5 ${
                    isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(s.id!)}
                      />
                      {sp && (
                        <img
                          src={spriteUrl(sp.id)}
                          alt=""
                          className="h-5 w-5 object-contain [image-rendering:pixelated]"
                          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                        />
                      )}
                      {s.nickname || sp?.name}
                    </label>
                    {isSelected && (
                      <>
                        <span className="ml-auto text-[10px] text-slate-400">Dias:</span>
                        <input
                          type="number"
                          min={1}
                          value={days[s.id!] ?? 1}
                          onChange={(e) =>
                            setDays((prev) => ({
                              ...prev,
                              [s.id!]: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="w-12 rounded-lg border-0 bg-white px-1.5 py-1 text-center text-[11px] font-bold shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none"
                        />
                      </>
                    )}
                  </div>
                  {isSelected && (
                    <div className="mt-1.5 space-y-2 pl-5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 text-[10px] text-slate-400">Pokémon:</span>
                          <select
                            value={pokAttr}
                            onChange={(e) =>
                              setPokAttrs((prev) => ({ ...prev, [s.id!]: e.target.value }))
                            }
                            className={`${selectCls} min-w-0 flex-1`}
                          >
                            {[...POKEMON_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                              <option key={a.label} value={a.label}>
                                {a.label} ({sheetAttrValue(s, a.label)})
                              </option>
                            ))}
                          </select>
                          <span className="shrink-0 text-slate-300">+</span>
                          <select
                            value={pokSkill}
                            onChange={(e) =>
                              setPokSkills((prev) => ({ ...prev, [s.id!]: e.target.value }))
                            }
                            className={`${selectCls} min-w-0 flex-1`}
                          >
                            {POKEMON_SKILLS.map((sk) => (
                              <option key={sk} value={sk}>
                                {sk} ({s.skills[sk] ?? 0})
                              </option>
                            ))}
                          </select>
                        </div>
                        <span
                          className="mt-1 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-emerald-700"
                          title="Dados a rolar contra a dificuldade · chance de sucesso já com a 2ª chance"
                        >
                          {pokPool}d6 · {truncatedPercent(pokChance)}%
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 text-[10px] text-slate-400">Treinador:</span>
                          <select
                            value={trAttr}
                            onChange={(e) =>
                              setTrAttrs((prev) => ({ ...prev, [s.id!]: e.target.value }))
                            }
                            className={`${selectCls} min-w-0 flex-1`}
                          >
                            {[...TRAINER_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                              <option key={a.label} value={a.label}>
                                {a.label} ({sheetAttrValue(trainer, a.label)})
                              </option>
                            ))}
                          </select>
                          <span className="shrink-0 text-slate-300">+</span>
                          <select
                            value={trSkill}
                            onChange={(e) =>
                              setTrSkills((prev) => ({ ...prev, [s.id!]: e.target.value }))
                            }
                            className={`${selectCls} min-w-0 flex-1`}
                          >
                            {TRAINER_SKILLS.map((sk) => (
                              <option key={sk} value={sk}>
                                {sk} ({trainer.skills[sk] ?? 0})
                              </option>
                            ))}
                          </select>
                        </div>
                        <span
                          className="mt-1 inline-block rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-indigo-700"
                          title="Dados que o treinador rola para gerar Pontos de Treino"
                        >
                          {trPool}d6
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={run}
            disabled={selectedSheets.length === 0 || busy}
            className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-40"
          >
            {busy
              ? 'Rodando...'
              : `▶ Rodar treino (${totalDaysPlanned} dia${totalDaysPlanned === 1 ? '' : 's'} entre ${selectedSheets.length} Pokémon)`}
          </button>

          {results && (
            <div className="space-y-1 rounded-lg bg-slate-50 p-2.5">
              <p className="text-xs font-bold text-slate-500 uppercase">Resultado</p>
              {results.map((r) => (
                <p key={r.sheetId} className="text-xs text-slate-600">
                  <b>{r.name}</b>: {r.daysCompleted}/{r.daysTrained} dias completados ·{' '}
                  <span className="font-bold text-indigo-600">+{r.tpGained} TP</span>
                </p>
              ))}
              <p className="text-[11px] text-slate-400">
                Pontos de Treino e Will Points já aplicados nas fichas
                {session && activeMesa ? ' · resumo enviado ao chat da mesa' : ''}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
