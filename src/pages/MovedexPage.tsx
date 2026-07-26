import { useMemo, useState } from 'react'
import type { Move } from '../types'
import { MOVES, POKEMON_TYPES, typeColor } from '../data'
import TypeBadge from '../components/TypeBadge'
import MoveDetailModal, { CategoryBadge } from '../components/MoveDetailModal'

const CATEGORIES = ['Physical', 'Special', 'Support'] as const

export default function MovedexPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [selectedMove, setSelectedMove] = useState<Move | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOVES.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false
      if (typeFilter && m.type !== typeFilter) return false
      // categorias mistas ("Physical/Special") contam nos dois filtros
      if (categoryFilter && !m.category.includes(categoryFilter)) return false
      return true
    })
  }, [search, typeFilter, categoryFilter])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar golpe..."
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-red-400 focus:outline-none"
        />
        <div className="flex gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() =>
                setCategoryFilter(categoryFilter === c ? null : c)
              }
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                categoryFilter === c
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-red-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-slate-500">
          {filtered.length} golpes
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <th className="px-4 py-2.5">Golpe</th>
              <th className="px-2 py-2.5">Tipo</th>
              <th className="px-2 py-2.5">Categoria</th>
              <th className="px-2 py-2.5 text-center">Power</th>
              <th className="hidden px-2 py-2.5 sm:table-cell">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                onClick={() => setSelectedMove(m)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-2 font-medium text-slate-800">
                  {m.name}
                </td>
                <td className="px-2 py-2">
                  <TypeBadge type={m.type} size="sm" />
                </td>
                <td className="px-2 py-2">
                  <CategoryBadge category={m.category} />
                </td>
                <td className="px-2 py-2 text-center font-semibold text-slate-700">
                  {m.powerLabel ? '✱' : (m.power ?? '—')}
                </td>
                <td className="hidden px-2 py-2 text-xs text-slate-500 sm:table-cell">
                  {m.accuracy.attribute}
                  {m.accuracy.skill && ` + ${m.accuracy.skill}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-12 text-center text-slate-400">
            Nenhum golpe encontrado.
          </p>
        )}
      </div>

      <MoveDetailModal
        move={selectedMove}
        onClose={() => setSelectedMove(null)}
      />
    </div>
  )
}
