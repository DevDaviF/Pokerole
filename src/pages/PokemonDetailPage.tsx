import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Attributes, Move } from '../types'
import { RANKS, rankIndex } from '../types'
import {
  POKEDEX,
  pokemonById,
  moveById,
  abilityByName,
  spriteUrl,
  typeColor,
} from '../data'
import TypeBadge from '../components/TypeBadge'
import MoveDetailModal, { CategoryBadge } from '../components/MoveDetailModal'

const nameToId = new Map(POKEDEX.map((p) => [p.name, p.id]))

const ATTR_LABELS: Array<[keyof Attributes, string]> = [
  ['strength', 'Strength'],
  ['dexterity', 'Dexterity'],
  ['vitality', 'Vitality'],
  ['special', 'Special'],
  ['insight', 'Insight'],
]

function AttributeRow({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs font-medium text-slate-500">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: Math.max(max, value) }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${
              i < value ? 'bg-red-500' : 'border border-slate-300 bg-white'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400">
        {value}/{max}
      </span>
    </div>
  )
}

export default function PokemonDetailPage() {
  const { id } = useParams()
  const pokemon = id ? pokemonById.get(id) : undefined
  const [selectedMove, setSelectedMove] = useState<Move | null>(null)

  const learnsetByRank = useMemo(() => {
    if (!pokemon) return []
    const groups = new Map<string, Move[]>()
    for (const entry of pokemon.learnset) {
      const move = moveById.get(entry.moveId)
      if (!move) continue
      if (!groups.has(entry.rank)) groups.set(entry.rank, [])
      groups.get(entry.rank)!.push(move)
    }
    return [...groups.entries()].sort(
      (a, b) => rankIndex(a[0]) - rankIndex(b[0]),
    )
  }, [pokemon])

  if (!pokemon) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
        Pokémon não encontrado.{' '}
        <Link to="/" className="text-red-600 underline">
          Voltar ao Pokédex
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link to="/" className="text-sm text-red-600 hover:underline">
        ← Pokédex
      </Link>

      {/* Cabeçalho */}
      <div
        className="flex flex-wrap items-center gap-5 rounded-xl p-5 text-white shadow-md"
        style={{ backgroundColor: typeColor(pokemon.types[0]) }}
      >
        <img
          src={spriteUrl(pokemon.id)}
          alt={pokemon.name}
          className="h-24 w-24 object-contain [image-rendering:pixelated]"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
        <div className="flex-1">
          <div className="text-sm opacity-80">
            #{pokemon.dexNumber} · {pokemon.dexCategory}
          </div>
          <h1 className="text-3xl font-bold">{pokemon.name}</h1>
          <div className="mt-1 flex gap-1.5">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="opacity-80">HP Base</span>
          <span className="font-bold">{pokemon.baseHp}</span>
          <span className="opacity-80">Rank sugerido</span>
          <span className="font-bold">{pokemon.suggestedRank}</span>
          <span className="opacity-80">Altura</span>
          <span className="font-bold">{pokemon.height}</span>
          <span className="opacity-80">Peso</span>
          <span className="font-bold">{pokemon.weight}</span>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Atributos */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-slate-800">
            Atributos da espécie
          </h2>
          <div className="space-y-2">
            {ATTR_LABELS.map(([key, label]) => (
              <AttributeRow
                key={key}
                label={label}
                value={pokemon.attributes[key]}
                max={pokemon.maxAttributes[key]}
              />
            ))}
          </div>
          {pokemon.goodStarter && (
            <p className="mt-3 text-xs font-medium text-emerald-600">
              ★ Bom Pokémon inicial
            </p>
          )}
          {pokemon.legendary && (
            <p className="mt-3 text-xs font-medium text-amber-600">
              ★ Lendário
            </p>
          )}
        </div>

        {/* Habilidades + evoluções */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-slate-800">Habilidades</h2>
            <ul className="space-y-2">
              {pokemon.abilities.map((a) => (
                <li key={a}>
                  <span className="font-semibold text-slate-700">{a}</span>
                  <p className="text-xs text-slate-500">
                    {abilityByName.get(a)?.effect}
                  </p>
                </li>
              ))}
              {pokemon.hiddenAbility && (
                <li>
                  <span className="font-semibold text-slate-700">
                    {pokemon.hiddenAbility}
                  </span>{' '}
                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 uppercase">
                    Oculta
                  </span>
                  <p className="text-xs text-slate-500">
                    {abilityByName.get(pokemon.hiddenAbility)?.effect}
                  </p>
                </li>
              )}
            </ul>
          </div>

          {pokemon.evolutions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-bold text-slate-800">Evolução</h2>
              <ul className="space-y-1 text-sm">
                {pokemon.evolutions.map((ev, i) => {
                  const targetId = nameToId.get(ev.name)
                  const label =
                    ev.direction === 'from'
                      ? `Evolui de ${ev.name}`
                      : `Evolui para ${ev.name}`
                  return (
                    <li key={i} className="text-slate-600">
                      {targetId ? (
                        <Link
                          to={`/pokemon/${targetId}`}
                          className="text-red-600 hover:underline"
                        >
                          {label}
                        </Link>
                      ) : (
                        label
                      )}{' '}
                      <span className="text-xs text-slate-400">
                        ({ev.kind}
                        {ev.detail ? ` · ${ev.detail}` : ''})
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Descrição */}
      <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 italic shadow-sm">
        {pokemon.dexDescription}
      </p>

      {/* Learnset */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold text-slate-800">
          Golpes por Rank de aprendizado
        </h2>
        <div className="space-y-4">
          {learnsetByRank.map(([rank, moves]) => (
            <div key={rank}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600 uppercase">
                <span
                  className="inline-block h-2 w-2 rounded-full bg-red-500"
                  style={{
                    opacity: 0.3 + (0.7 * (rankIndex(rank) + 1)) / RANKS.length,
                  }}
                />
                {rank}
              </h3>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {moves.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMove(m)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {m.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">
                        {m.accuracy.attribute}
                      </span>
                      <TypeBadge type={m.type} size="sm" />
                      <CategoryBadge category={m.category} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <MoveDetailModal
        move={selectedMove}
        onClose={() => setSelectedMove(null)}
      />
    </div>
  )
}
