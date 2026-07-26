import { useState } from 'react'
import type { PokemonSheet, Trainer } from '../types'
import { sheetAttrValue } from './MoveRoll'
import { rollDice, rollAdditive, DiceRow, type RollResult } from './DiceRoller'
import { useMesa } from '../lib/mesa'
import {
  POKEMON_ATTRIBUTE_LABELS,
  TRAINER_ATTRIBUTE_LABELS,
  SOCIAL_LABELS,
  POKEMON_SKILL_GROUPS,
  TRAINER_SKILL_GROUPS,
} from '../constants'

export type SheetLike = (Trainer | PokemonSheet) & {
  attributes: Trainer['attributes']
  social: Trainer['social']
  skills: Record<string, number>
}

const selectCls =
  'rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none'

export default function SkillRoll({
  sheet,
  displayName,
  isPokemon,
}: {
  sheet: SheetLike
  displayName: string
  isPokemon: boolean
}) {
  const { postRoll, session, activeMesa } = useMesa()
  const attrLabels = isPokemon
    ? POKEMON_ATTRIBUTE_LABELS
    : TRAINER_ATTRIBUTE_LABELS
  const skillGroups = isPokemon ? POKEMON_SKILL_GROUPS : TRAINER_SKILL_GROUPS
  const allSkills = skillGroups.flatMap((g) => g.skills)
  const allAttrs = [...attrLabels, ...SOCIAL_LABELS]

  const [attr, setAttr] = useState('Insight')
  const [skill, setSkill] = useState('Alert')
  const [bonus, setBonus] = useState(0)
  const [last, setLast] = useState<RollResult | null>(null)
  const [lastLabel, setLastLabel] = useState('')

  const pool = (a: string, s: string) =>
    Math.max(1, sheetAttrValue(sheet, a) + (sheet.skills[s] ?? 0) + bonus)

  const roll = (a: string, s: string, presetName?: string) => {
    const formula = `${a} + ${s}${bonus ? ` ${bonus > 0 ? '+' : ''}${bonus}` : ''}`
    const label = `${displayName} · ${presetName ?? formula}`
    const r = rollDice(pool(a, s), label)
    setLast(r)
    setLastLabel(presetName ? `${presetName} (${formula})` : formula)
    postRoll(r)
  }

  // Iniciativa (p. 56) não é uma pool: é 1d6 + (Dexterity + Alert) como
  // número fixo. Resultado é comparado entre combatentes para a ordem.
  const initiativeBonus = sheetAttrValue(sheet, 'Dexterity') + (sheet.skills['Alert'] ?? 0)
  const rollInitiative = () => {
    const r = rollAdditive(initiativeBonus, `${displayName} · Iniciativa`)
    setLast(r)
    setLastLabel(`Iniciativa (1d6 + Dex + Alert)`)
    postRoll(r)
  }

  const presets: Array<{
    key: string
    label: string
    icon: string
    a: string
    s: string
    color: string
  }> = [
    { key: 'evasion', label: 'Evasion', icon: '💨', a: 'Dexterity', s: 'Evasion', color: '#059669' },
  ]
  if (isPokemon) {
    presets.push(
      { key: 'clash-p', label: 'Clash (físico)', icon: '🛡️', a: 'Strength', s: 'Clash', color: '#b45309' },
      { key: 'clash-s', label: 'Clash (especial)', icon: '🛡️', a: 'Special', s: 'Clash', color: '#b45309' },
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500 uppercase">
        Ações rápidas
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={rollInitiative}
          className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-left text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
          title="Iniciativa não é uma pool: é 1d6 + Dexterity + Alert"
        >
          <span>⚡</span>
          <span>
            <span className="block text-[10px] font-medium opacity-80">
              Iniciativa
            </span>
            <span className="block text-sm leading-none font-extrabold">
              1d6+{initiativeBonus}
            </span>
          </span>
        </button>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => roll(p.a, p.s, p.label)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: p.color }}
          >
            <span>{p.icon}</span>
            <span>
              <span className="block text-[10px] font-medium opacity-80">
                {p.label}
              </span>
              <span className="block text-sm leading-none font-extrabold">
                {pool(p.a, p.s)}d6
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="border-t border-dashed border-slate-200 pt-2 text-xs font-bold text-slate-500 uppercase">
        Perícia livre
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={attr}
          onChange={(e) => setAttr(e.target.value)}
          className={selectCls}
        >
          {allAttrs.map((a) => (
            <option key={a.label}>{a.label}</option>
          ))}
        </select>
        <span className="text-slate-300">+</span>
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          className={selectCls}
        >
          {allSkills.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-slate-500">
          bônus
          <input
            type="number"
            value={bonus}
            onChange={(e) => setBonus(Number(e.target.value) || 0)}
            className="w-10 rounded border border-slate-300 px-1 py-0.5 text-center text-xs font-bold focus:border-red-400 focus:outline-none"
          />
        </label>
        <button
          onClick={() => roll(attr, skill)}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
        >
          Rolar {pool(attr, skill)}d6
        </button>
      </div>

      {last && (
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="mb-1 text-xs font-semibold text-slate-600">
            {lastLabel}
          </p>
          <DiceRow r={last} />
          <p className="mt-1 text-[11px] text-slate-400">
            {session && activeMesa
              ? `enviado à mesa "${activeMesa.name}"`
              : 'roll local — entre numa mesa para compartilhar'}
          </p>
        </div>
      )}
    </div>
  )
}
