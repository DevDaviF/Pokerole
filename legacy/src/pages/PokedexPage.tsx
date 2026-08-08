import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { POKEDEX, POKEMON_TYPES, spriteUrl, typeColor } from '../data'
import TypeBadge from '../components/TypeBadge'

export default function PokedexPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showForms, setShowForms] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return POKEDEX.filter((p) => {
      if (!showForms && p.name.includes('(')) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.dexNumber.includes(q))
        return false
      if (typeFilter && !p.types.includes(typeFilter)) return false
      return true
    })
  }, [search, typeFilter, showForms])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou número..."
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-red-400 focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showForms}
            onChange={(e) => setShowForms(e.target.checked)}
          />
          Mostrar formas (Mega, regionais...)
        </label>
        <span className="ml-auto text-sm text-slate-500">
          {filtered.length} Pokémon
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {POKEMON_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold text-white uppercase transition-opacity ${
              typeFilter && typeFilter !== t ? 'opacity-30' : 'opacity-100'
            }`}
            style={{ backgroundColor: typeColor(t) }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((p) => (
          <Link
            key={p.id}
            to={`/pokemon/${p.id}`}
            className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
          >
            <img
              src={spriteUrl(p.id)}
              alt={p.name}
              loading="lazy"
              className="h-16 w-16 object-contain [image-rendering:pixelated]"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
            <span className="text-xs text-slate-400">#{p.dexNumber}</span>
            <span className="text-center text-sm font-semibold text-slate-800">
              {p.name}
            </span>
            <div className="mt-1 flex gap-1">
              {p.types.map((t) => (
                <TypeBadge key={t} type={t} size="sm" />
              ))}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-slate-400">
          Nenhum Pokémon encontrado.
        </p>
      )}
    </div>
  )
}
