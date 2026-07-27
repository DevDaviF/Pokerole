import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Move, Pokemon, PokemonSheet } from '../types'
import { RANKS, rankIndex } from '../types'
import {
  POKEMON_ATTRIBUTE_LABELS,
  SOCIAL_LABELS,
  POKEMON_SKILL_GROUPS,
  STATUS_CONDITIONS,
} from '../constants'
import {
  MOVES,
  NATURES,
  ITEMS,
  pokemonById,
  moveById,
  abilityByName,
  spriteUrl,
  typeColor,
} from '../data'
import {
  rankAttributePoints,
  rankSocialPoints,
  rankSkillPoints,
  rankSkillLimit,
  RANK_POINT_ATTRIBUTES,
} from '../lib/progression'
import Stepper from '../components/Stepper'
import TypeBadge from '../components/TypeBadge'
import MoveDetailModal from '../components/MoveDetailModal'
import TrainingPointsBadge from '../components/TrainingPoints'
import SpeciesPicker from '../components/SpeciesPicker'
import PokemonProgression from '../components/PokemonProgression'
import TypeMatchups from '../components/TypeMatchups'
import UnitToggle, { useUnitSystem } from '../components/UnitToggle'
import SendToChatButton from '../components/SendToChatButton'
import { useMesa } from '../lib/mesa'
import { supabaseConfigured } from '../lib/supabase'
import { formatHeight, formatWeight } from '../lib/units'
import { breedingInfoFor, eggGroupLabel, genderLabel } from '../lib/breeding'

const emptySheet = (): PokemonSheet => ({
  trainerId: 0,
  species: '',
  nickname: '',
  rank: 'Starter',
  nature: '',
  ability: '',
  heldItem: '',
  attributes: { strength: 1, dexterity: 1, vitality: 1, special: 1, insight: 1 },
  social: { tough: 1, cool: 1, beauty: 1, cute: 1, clever: 1 },
  skills: {},
  knownMoves: [],
  currentHp: 1,
  statusConditions: [],
  inTeam: false,
  trainingPoints: 0,
  happiness: 2,
  loyalty: 2,
  notes: '',
})


export default function PokemonSheetsPage() {
  const sheets = useLiveQuery(() => db.pokemonSheets.toArray(), []) ?? []
  const trainers = useLiveQuery(() => db.trainers.toArray(), []) ?? []
  const [editing, setEditing] = useState<PokemonSheet | null>(null)
  const [moveInfo, setMoveInfo] = useState<Move | null>(null)
  const { session } = useMesa()
  const needsAccount = supabaseConfigured && !session
  const [unitSystem, setUnitSystem] = useUnitSystem()

  const species = editing?.species ? pokemonById.get(editing.species) : undefined
  const speciesBreeding = species ? breedingInfoFor(species.id) : null

  const totalHp = species && editing ? species.baseHp + editing.attributes.vitality : 0
  const willPoints = editing ? editing.attributes.insight + 3 : 0

  // Pontos de atributo por Rank (item 12/13): mesmo orçamento pra qualquer
  // Pokémon, capturado ou selvagem — livre pra distribuir, sem contar
  // Special (tratado à parte). "Gasto" = quanto cada atributo está acima da
  // base da espécie; sobra = orçamento do Rank menos o gasto.
  const attrBudget = species && editing ? rankAttributePoints(editing.rank) : 0
  const attrSpent =
    species && editing
      ? RANK_POINT_ATTRIBUTES.reduce(
          (sum, key) => sum + Math.max(0, editing.attributes[key] - species.attributes[key]),
          0,
        )
      : 0
  const attrRemaining = Math.max(0, attrBudget - attrSpent)
  const attrMax = (key: keyof PokemonSheet['attributes']) => {
    if (!species || !editing) return 12
    // Champion Rank (p.31): atributos podem passar do limite da espécie
    // em até 2 pontos.
    const speciesMax = species.maxAttributes[key] + (editing.rank === 'Champion' ? 2 : 0)
    if (!(RANK_POINT_ATTRIBUTES as readonly string[]).includes(key)) return speciesMax
    return Math.min(speciesMax, editing.attributes[key] + attrRemaining)
  }

  // Sociais: mesmo orçamento dos atributos físicos por Rank (p.30-31),
  // base 1 em cada (valor inicial de toda ficha nova).
  const socialBudget = editing ? rankSocialPoints(editing.rank) : 0
  const socialSpent = editing
    ? SOCIAL_LABELS.reduce(
        (sum, { key }) => sum + Math.max(0, editing.social[key] - 1),
        0,
      )
    : 0
  const socialRemaining = Math.max(0, socialBudget - socialSpent)
  const socialMax = (key: keyof PokemonSheet['social']) => {
    if (!editing) return 5
    return Math.min(5, editing.social[key] + socialRemaining)
  }

  // Skills: Skill Points totais por Rank + Skill Limit (máx por skill
  // individual) — p.30-31. Base 0 em cada.
  const skillBudget = editing ? rankSkillPoints(editing.rank) : 0
  const skillSpent = editing
    ? Object.values(editing.skills).reduce((sum, v) => sum + (v ?? 0), 0)
    : 0
  const skillRemaining = Math.max(0, skillBudget - skillSpent)
  const skillLimit = editing ? rankSkillLimit(editing.rank) : 5
  const skillMax = (skillName: string) => {
    if (!editing) return skillLimit
    const current = editing.skills[skillName] ?? 0
    return Math.min(skillLimit, current + skillRemaining)
  }

  const hasOtherStarter = editing
    ? sheets.some(
        (s) => s.trainerId === editing.trainerId && s.isStarter && s.id !== editing.id,
      )
    : false

  // Golpes disponíveis: learnset até o rank atual (Mew: qualquer golpe)
  const availableMoves = useMemo(() => {
    if (!species || !editing) return []
    if (species.name === 'Mew')
      return MOVES.map((m) => ({ rank: 'Starter', move: m }))
    const currentRank = rankIndex(editing.rank)
    return species.learnset
      .map((e) => ({ rank: e.rank, move: moveById.get(e.moveId)! }))
      .filter((e) => e.move)
      .sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank))
      .map((e) => ({ ...e, locked: rankIndex(e.rank) > currentRank }))
  }, [species, editing?.rank]) as Array<{
    rank: string
    move: Move
    locked?: boolean
  }>

  const pickSpecies = (p: Pokemon) => {
    if (!editing) return
    setEditing({
      ...editing,
      species: p.id,
      rank: (RANKS as readonly string[]).includes(p.suggestedRank)
        ? (p.suggestedRank as PokemonSheet['rank'])
        : 'Starter',
      ability: p.abilities[0] ?? '',
      attributes: { ...p.attributes },
      knownMoves: [],
      currentHp: p.baseHp + p.attributes.vitality,
    })
  }

  // Corebook 3.0 p. 114: Pokémon aprendem um número de golpes igual a
  // Insight + 3.
  const maxMoves = (editing?.attributes.insight ?? 0) + 3

  const toggleMove = (moveId: string) => {
    if (!editing) return
    const has = editing.knownMoves.includes(moveId)
    if (!has && editing.knownMoves.length >= maxMoves) return
    setEditing({
      ...editing,
      knownMoves: has
        ? editing.knownMoves.filter((m) => m !== moveId)
        : [...editing.knownMoves, moveId],
    })
  }

  const save = async () => {
    if (!editing || !editing.species) return
    const record = {
      ...editing,
      currentHp: editing.id ? editing.currentHp : totalHp,
    }
    if (editing.id) await db.pokemonSheets.put(record)
    else await db.pokemonSheets.add(record)
    setEditing(null)
  }

  const remove = async (id: number) => {
    if (!confirm('Excluir esta ficha de Pokémon?')) return
    await db.pokemonSheets.delete(id)
  }

  // ── Formulário ─────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-2xl font-bold text-slate-800">
          {editing.id ? `Editando ${editing.nickname || species?.name}` : 'Nova Ficha de Pokémon'}
        </h1>

        {!species ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-slate-800">
              1. Escolha a espécie
            </h2>
            <SpeciesPicker onSelect={pickSpecies} />
          </div>
        ) : (
          <>
            <div
              className="flex flex-wrap items-center gap-4 rounded-xl p-4 text-white shadow-md"
              style={{ backgroundColor: typeColor(species.types[0]) }}
            >
              <img
                src={spriteUrl(species.id)}
                alt=""
                className="h-16 w-16 object-contain [image-rendering:pixelated]"
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
              <div>
                <h2 className="text-xl font-bold">{species.name}</h2>
                <div className="flex gap-1">
                  {species.types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </div>
              </div>
              <div className="ml-auto grid grid-cols-2 gap-x-4 text-sm">
                <span className="opacity-80">HP total</span>
                <b>{totalHp}</b>
                <span className="opacity-80">Will</span>
                <b>{willPoints}</b>
                <span className="opacity-80">Def / Sp.Def</span>
                <b>
                  {editing.attributes.vitality} / {editing.attributes.insight}
                </b>
              </div>
              {editing.id && (
                <div className="rounded-lg bg-white/15 px-2.5 py-1.5">
                  <TrainingPointsBadge sheet={editing} onUpdated={setEditing} />
                </div>
              )}
              <button
                onClick={() =>
                  setEditing({ ...editing, species: '', knownMoves: [] })
                }
                className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
              >
                Trocar espécie
              </button>
            </div>

            <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-bold text-slate-800">Dados da espécie</h2>
                  <UnitToggle value={unitSystem} onChange={setUnitSystem} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-slate-400">Altura</span>
                  <b className="text-slate-700">
                    {formatHeight(species.height, unitSystem)}
                  </b>
                  <span className="text-slate-400">Peso</span>
                  <b className="text-slate-700">
                    {formatWeight(species.weight, unitSystem)}
                  </b>
                  {speciesBreeding && (
                    <>
                      <span className="text-slate-400">Gênero (espécie)</span>
                      <b className="text-slate-700">
                        {genderLabel(speciesBreeding.genderRate)}
                      </b>
                      <span className="text-slate-400">Grupo de Ovo</span>
                      <b className="text-slate-700">
                        {speciesBreeding.eggGroups.map(eggGroupLabel).join(' / ') || '—'}
                      </b>
                    </>
                  )}
                </div>
              </div>
              <div>
                <h2 className="mb-2 font-bold text-slate-800">
                  Fraquezas, Resistências e Imunidades
                </h2>
                <TypeMatchups types={species.types} />
              </div>
            </div>

            <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Apelido
                </span>
                <input
                  value={editing.nickname}
                  onChange={(e) =>
                    setEditing({ ...editing, nickname: e.target.value })
                  }
                  placeholder={species.name}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Gênero{' '}
                  <span className="text-xs text-slate-400">
                    (deste indivíduo — a razão acima é só da espécie)
                  </span>
                </span>
                {speciesBreeding?.genderRate === -1 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Sem gênero (espécie)
                  </p>
                ) : (
                  <select
                    value={editing.gender ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        gender: (e.target.value || undefined) as PokemonSheet['gender'],
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                  >
                    <option value="">— não definido —</option>
                    <option value="M">♂ Macho</option>
                    <option value="F">♀ Fêmea</option>
                  </select>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Rank{' '}
                  <span className="text-xs text-slate-400">
                    (sugerido: {species.suggestedRank})
                  </span>
                </span>
                <select
                  value={editing.rank}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      rank: e.target.value as PokemonSheet['rank'],
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                >
                  {RANKS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Treinador
                </span>
                <select
                  value={editing.trainerId}
                  onChange={(e) =>
                    setEditing({ ...editing, trainerId: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                >
                  <option value={0}>— sem treinador —</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Habilidade
                </span>
                {editing.id ? (
                  <p
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    title="Habilidade só muda via Re-treino, lá embaixo em Progressão"
                  >
                    {editing.ability || '—'}
                  </p>
                ) : (
                  <select
                    value={editing.ability}
                    onChange={(e) =>
                      setEditing({ ...editing, ability: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                  >
                    {species.abilities.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                    {species.hiddenAbility && (
                      <option>{species.hiddenAbility} (Oculta)</option>
                    )}
                  </select>
                )}
                {editing.id && (
                  <p className="mt-1 text-xs text-slate-400">
                    Só muda via "Re-treinar" em Progressão, lá embaixo.
                  </p>
                )}
                {editing.ability && (
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      {abilityByName.get(editing.ability.replace(' (Oculta)', ''))
                        ?.effect ?? ''}
                    </p>
                    <SendToChatButton
                      text={`💡 ${editing.ability}: ${
                        abilityByName.get(editing.ability.replace(' (Oculta)', ''))
                          ?.effect ?? ''
                      }`}
                    />
                  </div>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Natureza
                </span>
                <select
                  value={editing.nature}
                  onChange={(e) =>
                    setEditing({ ...editing, nature: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                >
                  <option value="">—</option>
                  {NATURES.map((n) => (
                    <option key={n.id} value={n.name}>
                      {n.name} (Confidence {n.confidence})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  Item segurado
                </span>
                <input
                  list="items-list"
                  value={editing.heldItem}
                  onChange={(e) =>
                    setEditing({ ...editing, heldItem: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
                <datalist id="items-list">
                  {ITEMS.map((i) => (
                    <option key={i.id} value={i.name} />
                  ))}
                </datalist>
              </label>
              {!editing.id && (
                <label
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    hasOtherStarter
                      ? 'border-slate-100 bg-slate-50 text-slate-400'
                      : 'border-slate-200 text-slate-600'
                  }`}
                  title={
                    hasOtherStarter
                      ? 'Este treinador já tem um Pokémon inicial'
                      : 'Marca esta ficha como o Pokémon inicial do treinador'
                  }
                >
                  <input
                    type="checkbox"
                    checked={Boolean(editing.isStarter)}
                    disabled={hasOtherStarter}
                    onChange={(e) =>
                      setEditing({ ...editing, isStarter: e.target.checked })
                    }
                  />
                  É seu Pokémon inicial?
                </label>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-bold text-slate-800">Atributos</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      attrRemaining > 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                    title="Pontos ganhos por Rank (mesma regra pra qualquer Pokémon), livres pra distribuir entre Strength/Dexterity/Vitality/Special/Insight"
                  >
                    {attrRemaining}/{attrBudget} pontos de Rank
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-400">
                  Limites da espécie entre parênteses. Só dá pra aumentar —
                  reduzir um atributo já alocado exige Re-Treino.
                </p>
                <div className="space-y-2">
                  {POKEMON_ATTRIBUTE_LABELS.map(({ key, label }) => (
                    <Stepper
                      key={key}
                      label={`${label} (${species.maxAttributes[key]})`}
                      value={editing.attributes[key]}
                      min={editing.attributes[key]}
                      max={attrMax(key)}
                      dotMax={species.maxAttributes[key]}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          attributes: { ...editing.attributes, [key]: v },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold text-slate-800">
                    Atributos Sociais
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      socialRemaining > 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {socialRemaining}/{socialBudget} pontos de Rank
                  </span>
                </div>
                <p className="mb-2 text-xs text-slate-400">
                  Só dá pra aumentar — reduzir exige Re-Treino.
                </p>
                <div className="space-y-2">
                  {SOCIAL_LABELS.map(({ key, label }) => (
                    <Stepper
                      key={key}
                      label={label}
                      value={editing.social[key]}
                      min={editing.social[key]}
                      max={socialMax(key)}
                      dotMax={5}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          social: { ...editing.social, [key]: v },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 font-bold text-slate-800">
                Vínculo com o Treinador
              </h2>
              <p className="mb-3 text-xs text-slate-400">
                Vão de 0 a 5. Selvagens começam com 2 em cada; não crescem
                por Rank, só via role-play (p.28-29).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Stepper
                  label="Happiness"
                  value={editing.happiness ?? 2}
                  min={0}
                  max={5}
                  dotMax={5}
                  onChange={(v) => setEditing({ ...editing, happiness: v })}
                />
                <Stepper
                  label="Loyalty"
                  value={editing.loyalty ?? 2}
                  min={0}
                  max={5}
                  dotMax={5}
                  onChange={(v) => setEditing({ ...editing, loyalty: v })}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Skills</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    skillRemaining > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                  title={`Máximo de ${skillLimit} pontos por skill neste Rank`}
                >
                  {skillRemaining}/{skillBudget} Skill Points · limite {skillLimit}/skill
                </span>
              </div>
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
                {POKEMON_SKILL_GROUPS.map(({ group, skills }) => (
                  <div key={group}>
                    <h3 className="mb-2 text-xs font-bold text-slate-400 uppercase">
                      {group}
                    </h3>
                    <div className="space-y-1.5">
                      {skills.map((s) => (
                        <Stepper
                          key={s}
                          label={s}
                          value={editing.skills[s] ?? 0}
                          max={skillMax(s)}
                          dotMax={skillLimit}
                          onChange={(v) =>
                            setEditing({
                              ...editing,
                              skills: { ...editing.skills, [s]: v },
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 font-bold text-slate-800">
                Golpes conhecidos ({editing.knownMoves.length}/{maxMoves})
              </h2>
              <p className="mb-3 text-xs text-slate-400">
                Máximo = Insight + 3 (Corebook p. 114).{' '}
                {species.name === 'Mew'
                  ? 'Mew pode aprender qualquer golpe!'
                  : 'Golpes acima do rank atual ficam bloqueados.'}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {availableMoves.map(({ rank, move, locked }) => {
                  const selected = editing.knownMoves.includes(move.id)
                  return (
                    <div
                      key={move.id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
                        locked
                          ? 'border-slate-100 bg-slate-50 opacity-40'
                          : selected
                            ? 'border-red-400 bg-red-50'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={
                          locked ||
                          (!selected && editing.knownMoves.length >= maxMoves)
                        }
                        onChange={() => toggleMove(move.id)}
                      />
                      <button
                        onClick={() => setMoveInfo(move)}
                        className="flex-1 text-left text-sm font-medium text-slate-700 hover:underline"
                        title="Ver detalhes"
                      >
                        {move.name}
                      </button>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {rank}
                      </span>
                      <TypeBadge type={move.type} size="sm" />
                    </div>
                  )
                })}
              </div>
            </div>

            {editing.id && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-bold text-slate-800">Progressão</h2>
                <PokemonProgression
                  sheet={editing}
                  trainer={trainers.find((t) => t.id === editing.trainerId)}
                  onUpdated={setEditing}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-bold text-slate-800">
                  Status / Condições
                </h2>
                <div className="flex flex-wrap gap-2">
                  {STATUS_CONDITIONS.map((s) => {
                    const on = editing.statusConditions.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setEditing({
                            ...editing,
                            statusConditions: on
                              ? editing.statusConditions.filter((x) => x !== s)
                              : [...editing.statusConditions, s],
                          })
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          on
                            ? 'border-purple-400 bg-purple-100 text-purple-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="mb-2 block font-bold text-slate-800">
                  Notas
                </span>
                <textarea
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
              </label>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={!editing.species}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-40"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(null)}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>

        <MoveDetailModal move={moveInfo} onClose={() => setMoveInfo(null)} />
      </div>
    )
  }

  // ── Lista ──────────────────────────────────────────────────────────
  // NPCs gerados pelo Mestre (selvagem/ginásio) não aparecem aqui — são
  // fichas descartáveis, ficam só nas ferramentas da Mesa e no combate.
  const displaySheets = sheets.filter((s) => !s.isNpc)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Meus Pokémon</h1>
        {needsAccount ? (
          <span
            title="Crie uma conta ou faça login na aba Mesa pra criar fichas"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
          >
            🔒 + Nova Ficha
          </span>
        ) : (
          <button
            onClick={() => setEditing(emptySheet())}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            + Nova Ficha
          </button>
        )}
      </div>

      {needsAccount && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          🔒 Crie uma conta ou faça login (na aba{' '}
          <a href="#/mesa" className="underline">
            Mesa
          </a>
          ) pra criar novas fichas de Pokémon. Fichas já existentes continuam
          disponíveis pra editar.
        </p>
      )}

      {displaySheets.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
          Nenhuma ficha ainda. Crie a primeira!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displaySheets.map((s) => {
            const sp = pokemonById.get(s.species)
            const trainer = trainers.find((t) => t.id === s.trainerId)
            const maxHp = sp ? sp.baseHp + s.attributes.vitality : 0
            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {sp && (
                    <img
                      src={spriteUrl(sp.id)}
                      alt=""
                      className="h-12 w-12 object-contain [image-rendering:pixelated]"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = 'hidden')
                      }
                    />
                  )}
                  <div>
                    <h2 className="font-bold text-slate-800">
                      {s.nickname || sp?.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {sp?.name} · Rank {s.rank}
                    </p>
                  </div>
                  <span className="ml-auto">
                    <TrainingPointsBadge sheet={s} size="sm" />
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  HP {s.currentHp}/{maxHp} · Will {s.attributes.insight + 3} ·{' '}
                  {trainer ? `de ${trainer.name}` : 'sem treinador'}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.knownMoves.map((mid) => (
                    <span
                      key={mid}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      {moveById.get(mid)?.name}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setEditing(s)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(s.id!)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
