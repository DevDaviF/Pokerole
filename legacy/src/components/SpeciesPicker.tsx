import { useMemo, useState } from 'react'
import type { Pokemon } from '../types'
import { POKEDEX, spriteUrl } from '../data'
import TypeBadge from './TypeBadge'

export default function SpeciesPicker({
  onSelect,
  placeholder = 'Digite o nome da espécie...',
}: {
  onSelect: (p: Pokemon) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return POKEDEX.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12)
  }, [query])

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
      />
      {results.length > 0 && (
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p)
                setQuery('')
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left hover:bg-slate-50"
            >
              <img
                src={spriteUrl(p.id)}
                alt=""
                className="h-8 w-8 object-contain [image-rendering:pixelated]"
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
              <span className="text-sm font-medium text-slate-700">
                {p.name}
              </span>
              <span className="ml-auto flex gap-1">
                {p.types.map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
