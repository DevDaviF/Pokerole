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

// Roda a sessão de treino (Corebook p.104-105: tarefa do Pokémon vs
// dificuldade, com 2ª chance em caso de falha; se passar, rolagem do
// Treinador + dificuldade = Pontos de Treino; os dois recuperam 2 WP)
// pra vários Pokémon de uma vez, sem precisar clicar rolar dia por dia,
// bicho por bicho. Só 1 Pokémon treina por dia — os dias totais do lote
// são distribuídos em rodízio entre os Pokémon selecionados (dia 1 pro
// primeiro, dia 2 pro segundo, ...). O atributo/perícia do Treinador
// pode variar por Pokémon (roleplay: arremesso pra um, incentivo
// gritado pra outro batendo num tronco...), então cada linha tem sua
// própria dupla de seletores, tanto do lado do Pokémon quanto do
// Treinador.
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
  const [difficulty, setDifficulty] = useState(2)
  const [totalDays, setTotalDays] = useState(5)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ResultRow[] | null>(null)

  const toggleSelected = (id: number) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  const selectedSheets = teamSheets.filter((s) => selected[s.id!])

  const run = async () => {
    if (!trainer || selectedSheets.length === 0 || totalDays < 1) return
    setBusy(true)
    setResults(null)

    const trWillMax = trainer.attributes.insight + 3
    let trainerWill = trainer.currentWill ?? trWillMax
    const acc = new Map<
      number,
      { tpGained: number; daysCompleted: number; daysTrained: number; pokWill: number }
    >()
    for (const s of selectedSheets) {
      acc.set(s.id!, {
        tpGained: 0,
        daysCompleted: 0,
        daysTrained: 0,
        pokWill: s.currentWill ?? s.attributes.insight + 3,
      })
    }

    // rodízio: dia 0 treina selectedSheets[0], dia 1 treina selectedSheets[1]...
    // só 1 Pokémon por dia, igual à regra da mesa.
    for (let day = 0; day < totalDays; day++) {
      const sheet = selectedSheets[day % selectedSheets.length]
      const entry = acc.get(sheet.id!)!
      entry.daysTrained++

      const pokAttr = pokAttrs[sheet.id!] ?? 'Vitality'
      const pokSkill = pokSkills[sheet.id!] ?? 'Athletic'
      const pokPool = Math.max(
        1,
        sheetAttrValue(sheet, pokAttr) + (sheet.skills[pokSkill] ?? 0),
      )
      let taskRoll = rollDice(pokPool)
      let passed = taskRoll.successes >= difficulty
      if (!passed) {
        // p.105: falhou, o livro dá uma 2ª chance no mesmo dia
        taskRoll = rollDice(pokPool)
        passed = taskRoll.successes >= difficulty
      }
      if (!passed) continue
      entry.daysCompleted++

      const trAttr = trAttrs[sheet.id!] ?? 'Cool'
      const trSkill = trSkills[sheet.id!] ?? 'Athletic'
      const trPool = Math.max(
        1,
        sheetAttrValue(trainer, trAttr) + (trainer.skills[trSkill] ?? 0),
      )
      const trRoll = rollDice(trPool)
      entry.tpGained += trRoll.successes + difficulty

      const pokWillMax = sheet.attributes.insight + 3
      entry.pokWill = Math.min(pokWillMax, entry.pokWill + 2)
      trainerWill = Math.min(trWillMax, trainerWill + 2)
    }

    const rows: ResultRow[] = []
    for (const s of selectedSheets) {
      const entry = acc.get(s.id!)!
      await db.pokemonSheets.update(s.id!, {
        trainingPoints: (s.trainingPoints ?? 0) + entry.tpGained,
        currentWill: entry.pokWill,
      })
      rows.push({
        sheetId: s.id!,
        name: s.nickname || pokemonById.get(s.species)?.name || '?',
        daysTrained: entry.daysTrained,
        daysCompleted: entry.daysCompleted,
        tpGained: entry.tpGained,
      })
    }
    await db.trainers.update(trainer.id!, { currentWill: trainerWill })
    setResults(rows)
    setBusy(false)

    if (supabase && session && activeMesa) {
      const summary = rows
        .map((r) => `${r.name} ${r.daysCompleted}/${r.daysTrained}d +${r.tpGained}TP`)
        .join(' · ')
      await supabase.from('messages').insert({
        mesa_id: activeMesa.id,
        user_id: session.user.id,
        kind: 'chat',
        content: `🏋️ Treino em lote de ${trainer.name} (dif. ${difficulty}, ${totalDays} dia${totalDays === 1 ? '' : 's'} no total, 1 Pokémon/dia): ${summary}`,
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
            <span className="text-xs font-semibold text-slate-500">
              Dias totais do lote
            </span>
            <input
              type="number"
              min={1}
              value={totalDays}
              onChange={(e) => setTotalDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-lg border-0 bg-white px-2 py-1 text-center text-xs font-bold shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
            {selectedSheets.length > 0 && (
              <span className="text-[11px] text-slate-400">
                só 1 Pokémon treina por dia — em rodízio, cada um dos{' '}
                {selectedSheets.length} selecionados treina{' '}
                {Math.floor(totalDays / selectedSheets.length)}-
                {Math.ceil(totalDays / selectedSheets.length)} dias
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {teamSheets.map((s) => {
              const sp = pokemonById.get(s.species)
              const isSelected = Boolean(selected[s.id!])
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border px-2 py-1.5 ${
                    isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
                  }`}
                >
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5">
                      <span className="text-[10px] text-slate-400">Pokémon:</span>
                      <select
                        value={pokAttrs[s.id!] ?? 'Vitality'}
                        onChange={(e) =>
                          setPokAttrs((prev) => ({ ...prev, [s.id!]: e.target.value }))
                        }
                        className={selectCls}
                      >
                        {[...POKEMON_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                          <option key={a.label}>{a.label}</option>
                        ))}
                      </select>
                      <span className="text-slate-300">+</span>
                      <select
                        value={pokSkills[s.id!] ?? 'Athletic'}
                        onChange={(e) =>
                          setPokSkills((prev) => ({ ...prev, [s.id!]: e.target.value }))
                        }
                        className={selectCls}
                      >
                        {POKEMON_SKILLS.map((sk) => (
                          <option key={sk}>{sk}</option>
                        ))}
                      </select>
                      <span className="ml-2 text-[10px] text-slate-400">Treinador:</span>
                      <select
                        value={trAttrs[s.id!] ?? 'Cool'}
                        onChange={(e) =>
                          setTrAttrs((prev) => ({ ...prev, [s.id!]: e.target.value }))
                        }
                        className={selectCls}
                      >
                        {[...TRAINER_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                          <option key={a.label}>{a.label}</option>
                        ))}
                      </select>
                      <span className="text-slate-300">+</span>
                      <select
                        value={trSkills[s.id!] ?? 'Athletic'}
                        onChange={(e) =>
                          setTrSkills((prev) => ({ ...prev, [s.id!]: e.target.value }))
                        }
                        className={selectCls}
                      >
                        {TRAINER_SKILLS.map((sk) => (
                          <option key={sk}>{sk}</option>
                        ))}
                      </select>
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
              : `▶ Rodar ${totalDays} dia${totalDays === 1 ? '' : 's'} entre ${selectedSheets.length} Pokémon`}
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
