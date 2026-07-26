import { useState } from 'react'
import { db } from '../db'
import type { PokemonSheet, Trainer } from '../types'
import { rankIndex } from '../types'
import { pokemonById, spriteUrl } from '../data'
import {
  nextRank,
  rankUpCost,
  retrainCost,
  evolveCost,
  parseEvolutionSpeed,
  type EvolutionSpeed,
} from '../lib/progression'

const SPEEDS: EvolutionSpeed[] = ['Fast', 'Medium', 'Slow']

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-bold text-slate-500 uppercase">
        {icon} {title}
      </p>
      {children}
    </div>
  )
}

export default function PokemonProgression({
  sheet,
  trainer,
  onUpdated,
}: {
  sheet: PokemonSheet
  trainer: Trainer | undefined
  // chamado após cada mudança persistida, para o formulário que estiver
  // editando esta ficha atualizar seu estado local (rank/espécie/atributos
  // mudam por baixo dos panos aqui)
  onUpdated?: (updated: PokemonSheet) => void
}) {
  const species = pokemonById.get(sheet.species)
  const tp = sheet.trainingPoints ?? 0
  const [notice, setNotice] = useState('')

  const apply = async (patch: Partial<PokemonSheet>) => {
    await db.pokemonSheets.update(sheet.id!, patch)
    onUpdated?.({ ...sheet, ...patch })
  }
  const [evoSpeedOverride, setEvoSpeedOverride] = useState<
    Record<string, EvolutionSpeed>
  >({})

  if (!species) return null

  // ── Rank Up ──────────────────────────────────────────────────
  const next = nextRank(sheet.rank)
  const cost = rankUpCost(sheet.rank)
  const trainerCapped = trainer ? rankIndex(next ?? sheet.rank) > rankIndex(trainer.rank) : false
  const canRankUp = next !== null && cost !== null && tp >= cost && !trainerCapped

  const doRankUp = async () => {
    if (!next || cost === null) return
    await apply({ rank: next, trainingPoints: tp - cost })
    setNotice(`Subiu para Rank ${next}! (−${cost} TP)`)
  }

  // ── Evolve ───────────────────────────────────────────────────
  const candidates = species.evolutions.filter(
    (e) => e.direction === 'to' && e.kind !== 'Mega',
  )

  const doEvolve = async (targetName: string, speed: EvolutionSpeed) => {
    const target = [...pokemonById.values()].find((p) => p.name === targetName)
    if (!target) {
      setNotice(`Não achei "${targetName}" no Pokédex — confira o nome.`)
      return
    }
    const c = evolveCost(speed)
    if (tp < c) return
    const hpDelta = target.baseHp - species.baseHp
    const keepAbility = target.abilities.includes(sheet.ability)
      ? sheet.ability
      : (target.abilities[0] ?? '')
    await apply({
      species: target.id,
      ability: keepAbility,
      attributes: {
        strength: Math.min(sheet.attributes.strength, target.maxAttributes.strength),
        dexterity: Math.min(sheet.attributes.dexterity, target.maxAttributes.dexterity),
        vitality: Math.min(sheet.attributes.vitality, target.maxAttributes.vitality),
        special: Math.min(sheet.attributes.special, target.maxAttributes.special),
        insight: Math.min(sheet.attributes.insight, target.maxAttributes.insight),
      },
      currentHp: Math.max(1, sheet.currentHp + hpDelta),
      trainingPoints: tp - c,
    })
    setNotice(`Evoluiu para ${target.name}! (−${c} TP)`)
  }

  // ── Re-Train ─────────────────────────────────────────────────
  const retrCost = retrainCost(sheet.rank)
  const canRetrain = tp >= retrCost

  const doRetrain = async () => {
    if (
      !confirm(
        'Re-treinar reseta Atributos, Sociais e Skills para você redistribuir do zero (os golpes conhecidos NÃO mudam). Continuar?',
      )
    )
      return
    await apply({
      attributes: { ...species.attributes },
      social: { tough: 1, cool: 1, beauty: 1, cute: 1, clever: 1 },
      skills: {},
      trainingPoints: tp - retrCost,
    })
    setNotice(
      `Re-treinado! (−${retrCost} TP) Role a ficha até Atributos/Skills para redistribuir.`,
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase">
          Progressão do Pokémon
        </p>
        <span className="text-xs font-bold text-indigo-600">🏆 {tp} TP</span>
      </div>
      {notice && (
        <p
          className="cursor-pointer rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
          onClick={() => setNotice('')}
        >
          {notice}
        </p>
      )}

      <Section title="Rank Up" icon="⬆️">
        {next && cost !== null ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              {sheet.rank} → <b>{next}</b>
            </span>
            <button
              onClick={doRankUp}
              disabled={!canRankUp}
              className="ml-auto rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              Subir ({cost} TP)
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Já é Champion Rank.</p>
        )}
        {trainerCapped && (
          <p className="mt-1 text-[11px] text-amber-600">
            Bloqueado: um Pokémon não pode ultrapassar o Rank do próprio
            Treinador
            {trainer ? ` (${trainer.rank})` : ''}.
          </p>
        )}
      </Section>

      <Section title="Evoluir" icon="✨">
        {candidates.length === 0 ? (
          <p className="text-xs text-slate-400">
            {species.name} não tem evolução conhecida.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c, i) => {
              const detected = parseEvolutionSpeed(c.detail)
              const speed = evoSpeedOverride[c.name] ?? detected ?? 'Medium'
              const cCost = evolveCost(speed)
              const targetSprite = [...pokemonById.values()].find(
                (p) => p.name === c.name,
              )
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2"
                >
                  {targetSprite && (
                    <img
                      src={spriteUrl(targetSprite.id)}
                      alt=""
                      className="h-8 w-8 object-contain [image-rendering:pixelated]"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = 'hidden')
                      }
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {c.kind}
                      {c.detail ? ` · ${c.detail}` : ''}
                    </p>
                  </div>
                  <select
                    value={speed}
                    onChange={(e) =>
                      setEvoSpeedOverride((prev) => ({
                        ...prev,
                        [c.name]: e.target.value as EvolutionSpeed,
                      }))
                    }
                    title={
                      detected
                        ? 'Velocidade detectada automaticamente'
                        : 'Não achei a velocidade nos dados — escolha manualmente'
                    }
                    className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
                  >
                    {SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => doEvolve(c.name, speed)}
                    disabled={tp < cCost}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Evoluir ({cCost} TP)
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Re-Treinar" icon="🔄">
        <p className="mb-2 text-[11px] text-slate-400">
          Redistribui Atributos, Sociais e Skills do zero (baseado no Rank
          atual: {sheet.rank}). Golpes conhecidos não mudam.
        </p>
        <button
          onClick={doRetrain}
          disabled={!canRetrain}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40"
        >
          Re-treinar ({retrCost} TP)
        </button>
      </Section>
    </div>
  )
}
