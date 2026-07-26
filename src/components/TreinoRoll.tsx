import { useState } from 'react'
import { db } from '../db'
import type { PokemonSheet, Trainer } from '../types'
import { rollDice, type RollResult } from './DiceRoller'
import { DiceRow, sheetAttrValue } from './MoveRoll'
import { useMesa } from '../lib/mesa'
import { spriteUrl } from '../data'
import { DEFAULT_AVATAR } from './ImagePicker'
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
  'rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none'

function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
        {n}
      </span>
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
    </div>
  )
}

/**
 * Sessão de Treino (Corebook 3.0, p. 104-105):
 * 1. O Pokémon rola Atributo + Skill contra a dificuldade da tarefa (1-5).
 * 2. Se passar, o Treinador rola Atributo/Social + Skill e soma a
 *    dificuldade como sucessos bônus → total = Pontos de Treino.
 * 3. Após o treino, Treinador e Pokémon recuperam 2 Will Points.
 */
export function TreinoPanel({
  sheet,
  displayName,
  trainer,
}: {
  sheet: PokemonSheet
  displayName: string
  trainer: Trainer | undefined
}) {
  const { postRoll } = useMesa()
  const [difficulty, setDifficulty] = useState(2)
  const [pokAttr, setPokAttr] = useState('Vitality')
  const [pokSkill, setPokSkill] = useState('Athletic')
  const [trAttr, setTrAttr] = useState('Cool')
  const [trSkill, setTrSkill] = useState('Athletic')
  const [taskResult, setTaskResult] = useState<RollResult | null>(null)
  const [trainResult, setTrainResult] = useState<RollResult | null>(null)
  const [awarded, setAwarded] = useState<number | null>(null)

  const pokPool = Math.max(
    1,
    sheetAttrValue(sheet, pokAttr) + (sheet.skills[pokSkill] ?? 0),
  )
  const trPool = trainer
    ? Math.max(
        1,
        sheetAttrValue(trainer, trAttr) + (trainer.skills[trSkill] ?? 0),
      )
    : 0

  const rollTask = () => {
    const r = rollDice(pokPool, '')
    const passed = r.successes >= difficulty
    const labeled = {
      ...r,
      icon: spriteUrl(sheet.species),
      label: `${displayName} · Treino: tarefa dif. ${difficulty} (${pokAttr} + ${pokSkill}) → ${
        passed ? 'completou! ✅' : 'falhou ❌'
      }`,
    }
    setTaskResult(labeled)
    setTrainResult(null)
    setAwarded(null)
    postRoll(labeled)
  }

  const rollTrainer = async () => {
    if (!trainer) return
    const r = rollDice(trPool, '')
    const total = r.successes + difficulty
    const labeled = {
      ...r,
      icon: trainer.imageUrl || DEFAULT_AVATAR,
      label: `${trainer.name} · Treino: rolagem do treinador (${trAttr} + ${trSkill}) + ${difficulty} bônus → ${total} Pontos de Treino`,
    }
    setTrainResult(labeled)
    postRoll(labeled)
    // p.105 Passo 5: depois do treino, Treinador e Pokémon recuperam 2 WP
    const pokWillMax = sheet.attributes.insight + 3
    const trWillMax = trainer.attributes.insight + 3
    await db.pokemonSheets.update(sheet.id!, {
      trainingPoints: (sheet.trainingPoints ?? 0) + total,
      currentWill: Math.min(pokWillMax, (sheet.currentWill ?? pokWillMax) + 2),
    })
    await db.trainers.update(trainer.id!, {
      currentWill: Math.min(trWillMax, (trainer.currentWill ?? trWillMax) + 2),
    })
    setAwarded(total)
  }

  const taskPassed = taskResult && taskResult.successes >= difficulty

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-indigo-600 px-4 py-2.5 text-white">
        <b>🏋️ Sessão de Treino</b>
        <span className="text-xs opacity-80">de {displayName}</span>
        <label className="ml-auto flex items-center gap-1.5 text-[11px] font-medium">
          Dificuldade
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="rounded-lg border-0 bg-white/20 px-2 py-1 text-xs font-bold text-white focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d} className="text-slate-800">
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-4 p-4">
        {/* Passo 1: tarefa do Pokémon */}
        <div className="space-y-2">
          <StepBadge n={1} label="Tarefa do Pokémon" />
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={pokAttr}
              onChange={(e) => setPokAttr(e.target.value)}
              className={selectCls}
            >
              {[...POKEMON_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                <option key={a.label}>{a.label}</option>
              ))}
            </select>
            <span className="text-slate-300">+</span>
            <select
              value={pokSkill}
              onChange={(e) => setPokSkill(e.target.value)}
              className={selectCls}
            >
              {POKEMON_SKILLS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={rollTask}
              className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Rolar {pokPool}d6{' '}
              <span className="opacity-70">(precisa {difficulty})</span>
            </button>
          </div>
          {taskResult && (
            <div className="rounded-lg bg-slate-50 p-2.5">
              <DiceRow r={taskResult} />
              <p
                className={`mt-1 text-xs font-bold ${
                  taskPassed ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {taskPassed
                  ? '✅ Tarefa completa!'
                  : '❌ Falhou — o livro dá uma 2ª chance, role de novo'}
              </p>
            </div>
          )}
        </div>

        {/* Passo 2: rolagem do Treinador */}
        <div className="space-y-2">
          <StepBadge
            n={2}
            label={`Rolagem do Treinador${trainer ? ` — ${trainer.name}` : ''}`}
          />
          {trainer ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={trAttr}
                onChange={(e) => setTrAttr(e.target.value)}
                className={selectCls}
              >
                {[...TRAINER_ATTRIBUTE_LABELS, ...SOCIAL_LABELS].map((a) => (
                  <option key={a.label}>{a.label}</option>
                ))}
              </select>
              <span className="text-slate-300">+</span>
              <select
                value={trSkill}
                onChange={(e) => setTrSkill(e.target.value)}
                className={selectCls}
              >
                {TRAINER_SKILLS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={rollTrainer}
                disabled={!taskPassed}
                title={
                  taskPassed
                    ? ''
                    : 'O Pokémon precisa completar a tarefa primeiro'
                }
                className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
              >
                Rolar {trPool}d6{' '}
                <span className="opacity-70">+{difficulty} bônus</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Marque um treinador com ★ em "Treinadores" para liberar este
              passo.
            </p>
          )}
          {trainResult && (
            <div className="rounded-lg bg-slate-50 p-2.5">
              <DiceRow r={trainResult} />
              {awarded !== null && (
                <p className="mt-1 text-xs font-bold text-indigo-600">
                  🏆 +{awarded} Pontos de Treino para {displayName}!
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Lembrete: Treinador e Pokémon recuperam 2 Will Points após o
                treino.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
