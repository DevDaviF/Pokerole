import { useState } from 'react'
import { db } from '../db'
import type { PokemonSheet, Trainer } from '../types'
import { rankIndex, RANKS } from '../types'
import { pokemonById, spriteUrl, moveById, MOVES } from '../data'
import {
  nextRank,
  rankUpCost,
  retrainCost,
  evolveCost,
  parseEvolutionSpeed,
  evolutiveStage,
  learnMoveCost,
  overRankCost,
  type EvolutionSpeed,
} from '../lib/progression'

const SPEEDS: EvolutionSpeed[] = ['Fast', 'Medium', 'Slow']

// Corebook 3.0 p.110: TM/TR ensina QUALQUER golpe (dentro ou fora do
// learnset) por um custo fixo, igual pra qualquer Rank/Estágio — é o que
// te economiza Training Points, mas custa dinheiro pela TM/TR em si
// (fica a critério do Mestre disponibilizar).
const TM_TR_COST = 5

function Section({
  title,
  icon,
  page,
  children,
}: {
  title: string
  icon: string
  page?: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
        {icon} {title}
        {page && <span className="normal-case text-slate-400">(p.{page})</span>}
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
  const [tmSearch, setTmSearch] = useState('')
  const [tmMoveId, setTmMoveId] = useState('')
  const [tmForgetId, setTmForgetId] = useState('')
  const [rankMoveId, setRankMoveId] = useState('')
  const [rankForgetId, setRankForgetId] = useState('')
  const [overRankMoveId, setOverRankMoveIdSel] = useState('')
  const [overRankForgetId, setOverRankForgetId] = useState('')

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

  // ── Golpes: 3 mecânicas diferentes (p.109-111) ──────────────────
  const maxMoves = sheet.attributes.insight + 3
  const atMoveCap = sheet.knownMoves.length >= maxMoves
  const stage = evolutiveStage(species.evolutions)
  const isMew = species.name === 'Mew'

  // 1) Golpe do Rank atual/anterior (dentro do learnset, só quando no limite)
  const rankLearnable = isMew
    ? []
    : species.learnset.filter(
        (e) =>
          rankIndex(e.rank) <= rankIndex(sheet.rank) && !sheet.knownMoves.includes(e.moveId),
      )
  const rankLearnEntry = rankLearnable.find((e) => e.moveId === rankMoveId)
  const rankLearnTier: 'current' | 'previous' | null = rankLearnEntry
    ? rankLearnEntry.rank === sheet.rank
      ? 'current'
      : 'previous'
    : null
  const rankLearnCost = rankLearnTier ? learnMoveCost(stage, rankLearnTier) : 0
  const canRankLearn =
    atMoveCap && Boolean(rankLearnEntry) && Boolean(rankForgetId) && tp >= rankLearnCost

  const doRankLearn = async () => {
    if (!canRankLearn || !rankLearnEntry) return
    const newMove = moveById.get(rankMoveId)
    const oldMove = moveById.get(rankForgetId)
    if (!newMove || !oldMove) return
    if (
      !confirm(
        `Trocar "${oldMove.name}" por "${newMove.name}" (Rank ${rankLearnEntry.rank})? Custa ${rankLearnCost} TP.`,
      )
    )
      return
    const knownMoves = sheet.knownMoves.map((id) => (id === oldMove.id ? newMove.id : id))
    await apply({ knownMoves, trainingPoints: tp - rankLearnCost })
    setNotice(`Trocou "${oldMove.name}" por "${newMove.name}"! (−${rankLearnCost} TP)`)
    setRankMoveId('')
    setRankForgetId('')
  }

  // 2) Over-Rank (golpe acima do Rank atual, ainda do learnset)
  const overRankCandidates = isMew
    ? []
    : species.learnset.filter(
        (e) => rankIndex(e.rank) > rankIndex(sheet.rank) && !sheet.knownMoves.includes(e.moveId),
      )
  const overRankEntry = overRankCandidates.find((e) => e.moveId === overRankMoveId)
  const ranksAbove = overRankEntry ? rankIndex(overRankEntry.rank) - rankIndex(sheet.rank) : 0
  const overRankTp = overRankEntry ? overRankCost(stage, ranksAbove) : 0
  const happiness = sheet.happiness ?? 0
  const loyalty = sheet.loyalty ?? 0
  const meetsBond = happiness + loyalty >= 7
  // se já existe um golpe Over-Rank ativo, aprender outro esquece ELE
  // automaticamente (p.111); senão, só precisa escolher o que esquecer se
  // já estiver no limite de golpes
  const autoForgetMove = sheet.overRankMoveId ? moveById.get(sheet.overRankMoveId) : null
  const needsManualForget = !sheet.overRankMoveId && atMoveCap
  const canOverRank =
    Boolean(overRankEntry) &&
    meetsBond &&
    tp >= overRankTp &&
    (!needsManualForget || Boolean(overRankForgetId))

  const doOverRank = async () => {
    if (!canOverRank || !overRankEntry) return
    const newMove = moveById.get(overRankMoveId)
    if (!newMove) return
    const forgetMove =
      autoForgetMove ?? (needsManualForget ? moveById.get(overRankForgetId) : null)
    const question = forgetMove
      ? `Over-Rank: trocar "${forgetMove.name}" por "${newMove.name}" (Rank ${overRankEntry.rank}, ${ranksAbove} acima do seu)? Custa ${overRankTp} TP.`
      : `Over-Rank: aprender "${newMove.name}" (Rank ${overRankEntry.rank}, ${ranksAbove} acima do seu)? Custa ${overRankTp} TP.`
    if (!confirm(question)) return
    const knownMoves = forgetMove
      ? sheet.knownMoves.map((id) => (id === forgetMove.id ? newMove.id : id))
      : [...sheet.knownMoves, newMove.id]
    await apply({
      knownMoves,
      trainingPoints: tp - overRankTp,
      overRankMoveId: newMove.id,
    })
    setNotice(`Over-Rank! Aprendeu "${newMove.name}". (−${overRankTp} TP)`)
    setOverRankMoveIdSel('')
    setOverRankForgetId('')
  }

  // 3) TM/TR (qualquer golpe, 5 TP fixo)
  const canLearnTm =
    tp >= TM_TR_COST && Boolean(tmMoveId) && (!atMoveCap || Boolean(tmForgetId))

  const doLearnTm = async () => {
    if (!canLearnTm) return
    const newMove = moveById.get(tmMoveId)
    const oldMove = tmForgetId ? moveById.get(tmForgetId) : null
    if (!newMove) return
    const question = oldMove
      ? `TM/TR: trocar "${oldMove.name}" por "${newMove.name}"? Custa ${TM_TR_COST} TP (+ o custo em dinheiro da TM/TR, a critério do Mestre).`
      : `TM/TR: aprender "${newMove.name}"? Custa ${TM_TR_COST} TP (+ o custo em dinheiro da TM/TR, a critério do Mestre).`
    if (!confirm(question)) return
    const knownMoves = oldMove
      ? sheet.knownMoves.map((id) => (id === oldMove.id ? newMove.id : id))
      : [...sheet.knownMoves, newMove.id]
    await apply({ knownMoves, trainingPoints: tp - TM_TR_COST })
    setNotice(
      oldMove
        ? `Trocou "${oldMove.name}" por "${newMove.name}"! (−${TM_TR_COST} TP)`
        : `Aprendeu "${newMove.name}"! (−${TM_TR_COST} TP)`,
    )
    setTmMoveId('')
    setTmForgetId('')
    setTmSearch('')
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

      <Section title="Rank Up" icon="⬆️" page={107}>
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

      <Section title="Evoluir" icon="✨" page={108}>
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

      <Section title="Re-Treinar" icon="🔄" page={114}>
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

      <Section title={`Trocar Golpe do Rank (Estágio ${stage})`} icon="📖" page={109}>
        <p className="mb-2 text-[11px] text-slate-400">
          Corebook p.109: só quando já está no limite de golpes conhecidos
          ({sheet.knownMoves.length}/{maxMoves}). Golpes de Ranks que o
          Pokémon já passou custam menos que os do Rank atual.
        </p>
        {!atMoveCap ? (
          <p className="text-xs text-slate-400">
            Ainda não está no limite — escolha golpes novos direto em
            "Golpes conhecidos" acima, de graça.
          </p>
        ) : rankLearnable.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhum golpe novo disponível no learnset até o Rank atual.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={rankMoveId}
              onChange={(e) => setRankMoveId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Escolha o golpe...</option>
              {rankLearnable.map((e) => (
                <option key={e.moveId} value={e.moveId}>
                  {moveById.get(e.moveId)?.name ?? e.moveId} (Rank {e.rank})
                </option>
              ))}
            </select>
            <select
              value={rankForgetId}
              onChange={(e) => setRankForgetId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Esquecer qual golpe?</option>
              {sheet.knownMoves.map((id) => (
                <option key={id} value={id}>
                  {moveById.get(id)?.name ?? id}
                </option>
              ))}
            </select>
            <button
              onClick={doRankLearn}
              disabled={!canRankLearn}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {rankLearnTier
                ? `Trocar (${rankLearnCost} TP${rankLearnTier === 'previous' ? ' · Rank anterior' : ''})`
                : 'Trocar'}
            </button>
          </div>
        )}
      </Section>

      <Section title={`Over-Rank (Estágio ${stage})`} icon="🌟" page={111}>
        <p className="mb-2 text-[11px] text-slate-400">
          Corebook p.111: aprende um golpe ACIMA do Rank atual. Exige
          Happiness + Loyalty ≥ 7. Só um golpe Over-Rank por vez — aprender
          outro esquece o anterior automaticamente.
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Happiness
            <input
              type="number"
              min={0}
              value={happiness}
              onChange={(e) => apply({ happiness: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-center text-xs font-bold focus:border-red-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Loyalty
            <input
              type="number"
              min={0}
              value={loyalty}
              onChange={(e) => apply({ loyalty: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-center text-xs font-bold focus:border-red-400 focus:outline-none"
            />
          </label>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${meetsBond ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}
          >
            Total {happiness + loyalty} {meetsBond ? '✓' : '(precisa ≥ 7)'}
          </span>
        </div>
        {autoForgetMove && (
          <p className="mb-2 text-[11px] text-slate-500">
            Golpe Over-Rank atual: <b>{autoForgetMove.name}</b> — será
            esquecido se você aprender outro.
          </p>
        )}
        {overRankCandidates.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhum golpe de Rank mais alto disponível no learnset (ou você
            já é {RANKS[RANKS.length - 1]}).
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={overRankMoveId}
              onChange={(e) => setOverRankMoveIdSel(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Escolha o golpe...</option>
              {overRankCandidates.map((e) => (
                <option key={e.moveId} value={e.moveId}>
                  {moveById.get(e.moveId)?.name ?? e.moveId} (Rank {e.rank})
                </option>
              ))}
            </select>
            {needsManualForget && (
              <select
                value={overRankForgetId}
                onChange={(e) => setOverRankForgetId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
              >
                <option value="">Esquecer qual golpe?</option>
                {sheet.knownMoves.map((id) => (
                  <option key={id} value={id}>
                    {moveById.get(id)?.name ?? id}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={doOverRank}
              disabled={!canOverRank}
              className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-40"
            >
              {overRankEntry ? `Over-Rank (${overRankTp} TP)` : 'Over-Rank'}
            </button>
          </div>
        )}
      </Section>

      <Section title="TM/TR (qualquer golpe)" icon="📀" page={110}>
        <p className="mb-2 text-[11px] text-slate-400">
          Corebook p.110: {TM_TR_COST} TP fixo pra qualquer golpe, dentro ou
          fora do learnset — mas custa dinheiro pela TM/TR em si e fica a
          critério do Mestre disponibilizar.
        </p>
        <input
          value={tmSearch}
          onChange={(e) => setTmSearch(e.target.value)}
          placeholder="Buscar golpe..."
          className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={tmMoveId}
            onChange={(e) => setTmMoveId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
          >
            <option value="">Escolha o novo golpe...</option>
            {MOVES.filter(
                (m) =>
                  !sheet.knownMoves.includes(m.id) &&
                  m.name.toLowerCase().includes(tmSearch.toLowerCase()),
              )
              .slice(0, 40)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          {atMoveCap && (
            <select
              value={tmForgetId}
              onChange={(e) => setTmForgetId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Esquecer qual golpe?</option>
              {sheet.knownMoves.map((id) => (
                <option key={id} value={id}>
                  {moveById.get(id)?.name ?? id}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={doLearnTm}
            disabled={!canLearnTm}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Aprender ({TM_TR_COST} TP)
          </button>
        </div>
        {atMoveCap && (
          <p className="mt-1.5 text-[11px] text-amber-600">
            Já está no limite de golpes conhecidos ({sheet.knownMoves.length}/
            {maxMoves}) — escolha um golpe pra esquecer.
          </p>
        )}
      </Section>
    </div>
  )
}
