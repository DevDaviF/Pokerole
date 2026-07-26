import { useState } from 'react'
import type { Move, PokemonSheet } from '../types'
import TypeBadge from './TypeBadge'
import { CategoryBadge } from './MoveDetailModal'
import {
  rollDice,
  rollChanceDice,
  parseChanceDiceCount,
  DiceRow,
  type RollResult,
} from './DiceRoller'
import { useMesa } from '../lib/mesa'
import { pokemonById, typeColor, spriteUrl } from '../data'
import { useCombatants } from '../lib/combatants'
import type { Combatant } from './BattleTracker'

// Só golpes claramente de alvo único ou automiras não são AOE — qualquer
// outra coisa no campo "Target" (Every Pokémon, All Foes, Field...) deixa
// escolher mais de um alvo.
function isAoeTarget(target: string): boolean {
  const t = target.toLowerCase()
  if (!t) return false
  return !t.includes('single') && !t.includes('self') && !t.includes('user')
}

export { DiceRow }

// atributo pode ser composto ("Tough/Cute" no Growl): usa o maior
export function sheetAttrValue(
  rec: { attributes: object; social: object },
  name: string,
) {
  const all = { ...rec.attributes, ...rec.social } as Record<string, number>
  return Math.max(
    0,
    ...name.split('/').map((p) => all[p.trim().toLowerCase()] ?? 0),
  )
}

function MiniNum({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={15}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-10 rounded border-0 bg-slate-50 px-1 py-0.5 text-center text-xs font-bold text-slate-700 focus:ring-1 focus:ring-red-400 focus:outline-none"
      />
    </label>
  )
}

function RollButton({
  icon,
  label,
  pool,
  formula,
  color,
  onClick,
}: {
  icon: string
  label: string
  pool: number
  formula: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl px-4 py-2.5 text-left text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: color }}
    >
      <span className="text-xl">{icon}</span>
      <span>
        <span className="block text-[11px] font-medium opacity-80">
          {label} · {formula}
        </span>
        <span className="block text-lg leading-none font-extrabold">
          {pool}d6
        </span>
      </span>
    </button>
  )
}

export function MoveRollPanel({
  sheet,
  move,
  displayName,
}: {
  sheet: PokemonSheet
  move: Move
  displayName: string
}) {
  const { postRoll, session, activeMesa } = useMesa()
  const [last, setLast] = useState<RollResult | null>(null)
  const [accBonus, setAccBonus] = useState(0)
  const [dmgBonus, setDmgBonus] = useState(0)
  const [targetDef, setTargetDef] = useState(0)
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const baseChanceDice = parseChanceDiceCount(move.addedEffect)
  const [chanceBonus, setChanceBonus] = useState(0)

  const allCombatants = useCombatants(activeMesa?.id ?? null)
  // não faz sentido mirar em si mesmo
  const targets = allCombatants.filter(
    (c) => !(c.sourceKind === 'pokemonSheet' && c.localId === sheet.id),
  )
  const aoe = isAoeTarget(move.target)
  const selectedTargets = targets.filter((c) => targetKeys.includes(c.key))

  const toggleTarget = (key: string) => {
    setTargetKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      return aoe ? [...prev, key] : [key]
    })
  }

  // Physical usa Def (Vitality), Special usa Sp.Def (Insight) — Z-Move/
  // suporte com as duas categorias junto usa a maior das duas (p.27 & p.60).
  const targetDefValue = (c: Combatant): number => {
    const isPhysical = move.category.includes('Physical')
    const isSpecial = move.category.includes('Special')
    if (isPhysical && !isSpecial) return c.def ?? 0
    if (isSpecial && !isPhysical) return c.spDef ?? 0
    return Math.max(c.def ?? 0, c.spDef ?? 0)
  }

  const attrVal = (name: string) => sheetAttrValue(sheet, name)

  const accFormula = `${move.accuracy.attribute}${
    move.accuracy.skill ? ` + ${move.accuracy.skill}` : ''
  }`
  const accBase =
    attrVal(move.accuracy.attribute) + (sheet.skills[move.accuracy.skill] ?? 0)
  const accPool = Math.max(1, accBase + accBonus)

  // STAB: golpe Physical/Special do mesmo tipo do Pokémon = +1 dado (p. 60)
  const species = pokemonById.get(sheet.species)
  const hasStab = Boolean(
    move.damagePool &&
      species?.types.includes(move.type) &&
      (move.category.includes('Physical') || move.category.includes('Special')),
  )

  const dmgBase = move.damagePool
    ? attrVal(move.damagePool.attribute) +
      move.damagePool.bonus +
      (hasStab ? 1 : 0)
    : 0
  // com 1 alvo escolhido, a Def/Sp.Def dele substitui o campo manual; com
  // 0 ou 2+ (AOE) alvos, o manual serve de base pro caso sem alvo e cada
  // alvo AOE ganha seu próprio botão de rolagem com a Def/Sp.Def certa
  const effectiveTargetDef =
    selectedTargets.length === 1 ? targetDefValue(selectedTargets[0]) : targetDef
  // Defesa reduz o pool de dados, mas nunca abaixo de 1 (Corebook p. 60)
  const dmgPool = Math.max(1, dmgBase + dmgBonus - effectiveTargetDef)
  const defLabel = move.category.includes('Special')
    ? move.category.includes('Physical')
      ? 'Def/Sp.Def alvo'
      : 'Sp.Def alvo'
    : 'Def alvo'

  const doRoll = (kind: string, pool: number, formula: string, targetName?: string) => {
    const r = rollDice(
      Math.max(1, pool),
      `${displayName} · ${move.name} · ${kind}${targetName ? ` vs ${targetName}` : ''} (${formula})`,
    )
    if (species) r.icon = spriteUrl(species.id)
    setLast(r)
    postRoll(r)
  }

  const chancePool =
    baseChanceDice !== null ? Math.max(1, baseChanceDice + chanceBonus) : 0
  const doChanceRoll = () => {
    const r = rollChanceDice(
      chancePool,
      `${displayName} · ${move.name} · Chance Dice`,
    )
    if (species) r.icon = spriteUrl(species.id)
    setLast(r)
    postRoll(r)
  }

  const accFormulaFull = `${accFormula}${accBonus ? ` ${accBonus > 0 ? '+' : ''}${accBonus}` : ''}`
  const dmgFormulaFull = (def: number) =>
    move.damagePool
      ? [
          `${move.damagePool.attribute}+${move.damagePool.bonus}`,
          hasStab ? 'STAB+1' : '',
          dmgBonus ? `${dmgBonus > 0 ? '+' : ''}${dmgBonus}` : '',
          def ? `−${def}` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : null

  const accent = typeColor(move.type)

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ borderTopColor: accent, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <b className="text-slate-800">{move.name}</b>
        <TypeBadge type={move.type} size="sm" />
        <CategoryBadge category={move.category} />
        {hasStab && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"
            title="Same Type Attack Bonus: +1 dado por o golpe ser do tipo do Pokémon"
          >
            ⭐ STAB
          </span>
        )}
      </div>
      {move.addedEffect && (
        <p className="px-4 pt-1 text-xs text-slate-400">{move.addedEffect}</p>
      )}

      <div className="space-y-2.5 p-4">
        {targets.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
              Alvo{aoe ? 's' : ''}
              {aoe && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700 normal-case">
                  Alvo do golpe: {move.target} — pode escolher mais de um
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {targets.map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleTarget(c.key)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    targetKeys.includes(c.key)
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {c.spriteId && (
                    <img
                      src={spriteUrl(c.spriteId)}
                      alt=""
                      className="h-4 w-4 object-contain [image-rendering:pixelated]"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <RollButton
            icon="🎯"
            label="Acerto"
            pool={accPool}
            formula={accFormula}
            color="#334155"
            onClick={() => doRoll('Acerto', accPool, accFormulaFull)}
          />
          <MiniNum label="bônus" value={accBonus} onChange={setAccBonus} min={-10} />
        </div>

        {move.damagePool && selectedTargets.length > 1 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase">
              Dano por alvo (cada um rola separado — Defesa diferente muda o pool)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {selectedTargets.map((c) => {
                const def = targetDefValue(c)
                const pool = Math.max(1, dmgBase + dmgBonus - def)
                return (
                  <RollButton
                    key={c.key}
                    icon="💥"
                    label={`Dano vs ${c.name}`}
                    pool={pool}
                    formula={dmgFormulaFull(def) ?? ''}
                    color="#dc2626"
                    onClick={() => doRoll('Dano', pool, dmgFormulaFull(def) ?? '', c.name)}
                  />
                )
              })}
              <MiniNum label="bônus" value={dmgBonus} onChange={setDmgBonus} min={-10} />
            </div>
          </div>
        ) : (
          dmgFormulaFull(effectiveTargetDef) && (
            <div className="flex flex-wrap items-center gap-2">
              <RollButton
                icon="💥"
                label="Dano"
                pool={dmgPool}
                formula={move.damagePool!.attribute}
                onClick={() =>
                  doRoll(
                    'Dano',
                    dmgPool,
                    dmgFormulaFull(effectiveTargetDef) ?? '',
                    selectedTargets[0]?.name,
                  )
                }
                color="#dc2626"
              />
              {selectedTargets.length === 1 ? (
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                  {defLabel} de {selectedTargets[0].name}: {effectiveTargetDef}
                </span>
              ) : (
                <MiniNum label={defLabel} value={targetDef} onChange={setTargetDef} />
              )}
              <MiniNum label="bônus" value={dmgBonus} onChange={setDmgBonus} min={-10} />
            </div>
          )
        )}

        {baseChanceDice !== null && (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-2.5">
            <RollButton
              icon="🍀"
              label="Chance Dice"
              pool={chancePool}
              formula="ativa com qualquer 6"
              color="#d97706"
              onClick={doChanceRoll}
            />
            <MiniNum
              label="bônus"
              value={chanceBonus}
              onChange={setChanceBonus}
              min={-10}
            />
            <span className="text-[11px] text-slate-400">
              role depois do Acerto/Dano confirmados
            </span>
          </div>
        )}
      </div>

      {last && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
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
