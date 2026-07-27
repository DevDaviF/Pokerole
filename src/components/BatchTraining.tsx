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
  'rounded-lg border-0 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none'

interface ResultRow {
  sheetId: number
  name: string
  daysCompleted: number
  totalDays: number
  tpGained: number
}

// Roda a sessão de treino (Corebook p.104-105: tarefa do Pokémon vs
// dificuldade, com 2ª chance em caso de falha; se passar, rolagem do
// Treinador + dificuldade = Pontos de Treino; os dois recuperam 2 WP)
// N vezes seguidas pra vários Pokémon de uma vez, sem precisar clicar
// rolar dia por dia, bicho por bicho — só o resumo final vai pro chat,
// não cada rolagem individual (ia spammar demais).
export default function BatchTraining({
  trainers,
  pokemonSheets,
}: {
  trainers: Trainer[]
  pokemonSheets: PokemonSheet[]
}) {
  const { session, activeMesa } = useMesa()
  const [open, setOpen] = useState(false)
  const [trainerId, setTrainerId] = useState<number | null>(trainers[0]?.id ?? null)
  const trainer = trainers.find((t) => t.id === trainerId)
  const teamSheets = pokemonSheets.filter((s) => s.trainerId === trainerId)

  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [attrs, setAttrs] = useState<Record<number, string>>({})
  const [skills, setSkills] = useState<Record<number, string>>({})
  const [difficulty, setDifficulty] = useState(2)
  const [days, setDays] = useState(5)
  const [trAttr, setTrAttr] = useState('Cool')
  const [trSkill, setTrSkill] = useState('Athletic')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ResultRow[] | null>(null)

  const toggleSelected = (id: number) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  const selectedSheets = teamSheets.filter((s) => selected[s.id!])

  const run = async () => {
    if (!trainer || selectedSheets.length === 0 || days < 1) return
    setBusy(true)
    setResults(null)

    const trWillMax = trainer.attributes.insight + 3
    let trainerWill = trainer.currentWill ?? trWillMax
    const rows: ResultRow[] = []

    for (const sheet of selectedSheets) {
      const pokAttr = attrs[sheet.id!] ?? 'Vitality'
      const pokSkill = skills[sheet.id!] ?? 'Athletic'
      const pokPool = Math.max(
        1,
        sheetAttrValue(sheet, pokAttr) + (sheet.skills[pokSkill] ?? 0),
      )
      const trPool = Math.max(
        1,
        sheetAttrValue(trainer, trAttr) + (trainer.skills[trSkill] ?? 0),
      )
      const pokWillMax = sheet.attributes.insight + 3
      let pokWill = sheet.currentWill ?? pokWillMax
      let tpGained = 0
      let daysCompleted = 0

      for (let day = 0; day < days; day++) {
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

      await db.pokemonSheets.update(sheet.id!, {
        trainingPoints: (sheet.trainingPoints ?? 0) + tpGained,
        currentWill: pokWill,
      })
      rows.push({
        sheetId: sheet.id!,
        name: sheet.nickname || pokemonById.get(sheet.species)?.name || '?',
        daysCompleted,
        totalDays: days,
        tpGained,
      })
    }

    await db.trainers.update(trainer.id!, { currentWill: trainerWill })
    setResults(rows)
    setBusy(false)

    if (supabase && session && activeMesa) {
      const summary = rows
        .map((r) => `${r.name} ${r.daysCompleted}/${r.totalDays}d +${r.tpGained}TP`)
        .join(' · ')
      await supabase.from('messages').insert({
        mesa_id: activeMesa.id,
        user_id: session.user.id,
        kind: 'chat',
        content: `🏋️ Treino em lote de ${trainer.name} (dif. ${difficulty}, ${days} dia${days === 1 ? '' : 's'}): ${summary}`,
      })
    }
  }

  if (trainers.length === 0) return null

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-indigo-600 px-4 py-2.5 text-left text-white"
      >
        <b>🏋️ Treino em Lote</b>
        <span className="text-xs opacity-80">
          treine vários Pokémon por vários dias de uma vez
        </span>
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Treinador</span>
            <select
              value={trainerId ?? ''}
              onChange={(e) => {
                setTrainerId(Number(e.target.value))
                setSelected({})
                setResults(null)
              }}
              className={selectCls}
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
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
            <span className="text-xs font-semibold text-slate-500">Dias</span>
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-lg border-0 bg-white px-2 py-1 text-center text-xs font-bold shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
            <span className="text-xs font-semibold text-slate-500">
              Rolagem do Treinador (igual em todos os dias/Pokémon)
            </span>
            <select value={trAttr} onChange={(e) => setTrAttr(e.target.value)} className={selectCls}>
              {[...TRAINER_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                <option key={a.label}>{a.label}</option>
              ))}
            </select>
            <span className="text-slate-300">+</span>
            <select value={trSkill} onChange={(e) => setTrSkill(e.target.value)} className={selectCls}>
              {TRAINER_SKILLS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {teamSheets.length === 0 ? (
            <p className="text-xs text-slate-400">
              {trainer?.name ?? 'Este treinador'} não tem Pokémon.
            </p>
          ) : (
            <div className="space-y-1.5">
              {teamSheets.map((s) => {
                const sp = pokemonById.get(s.species)
                const isSelected = Boolean(selected[s.id!])
                return (
                  <div
                    key={s.id}
                    className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                      isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
                    }`}
                  >
                    <label className="flex flex-1 items-center gap-1.5 text-xs font-semibold text-slate-700">
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
                        <select
                          value={attrs[s.id!] ?? 'Vitality'}
                          onChange={(e) =>
                            setAttrs((prev) => ({ ...prev, [s.id!]: e.target.value }))
                          }
                          className={selectCls}
                        >
                          {[...POKEMON_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                            <option key={a.label}>{a.label}</option>
                          ))}
                        </select>
                        <span className="text-slate-300">+</span>
                        <select
                          value={skills[s.id!] ?? 'Athletic'}
                          onChange={(e) =>
                            setSkills((prev) => ({ ...prev, [s.id!]: e.target.value }))
                          }
                          className={selectCls}
                        >
                          {POKEMON_SKILLS.map((sk) => (
                            <option key={sk}>{sk}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={run}
            disabled={!trainer || selectedSheets.length === 0 || busy}
            className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-40"
          >
            {busy
              ? 'Rodando...'
              : `▶ Rodar ${days} dia${days === 1 ? '' : 's'} pra ${selectedSheets.length} Pokémon`}
          </button>

          {results && (
            <div className="space-y-1 rounded-lg bg-slate-50 p-2.5">
              <p className="text-xs font-bold text-slate-500 uppercase">Resultado</p>
              {results.map((r) => (
                <p key={r.sheetId} className="text-xs text-slate-600">
                  <b>{r.name}</b>: {r.daysCompleted}/{r.totalDays} dias completados ·{' '}
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
