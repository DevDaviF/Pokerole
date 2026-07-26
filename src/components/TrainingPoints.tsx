import { useState } from 'react'
import { db } from '../db'
import type { PokemonSheet } from '../types'

// TP de treino somam sozinhos (TreinoRoll); os de batalha variam demais
// (vitória/derrota/participação, p. 114) e são ajustados aqui à mão.
export default function TrainingPointsBadge({
  sheet,
  size = 'md',
  onUpdated,
}: {
  sheet: PokemonSheet
  size?: 'sm' | 'md'
  // necessário quando `sheet` vem de um estado local (ex: formulário de
  // edição) que não se atualiza sozinho ao escrever no Dexie
  onUpdated?: (updated: PokemonSheet) => void
}) {
  const [delta, setDelta] = useState(1)
  const tp = sheet.trainingPoints ?? 0

  const adjust = async (amount: number) => {
    const trainingPoints = Math.max(0, tp + amount)
    await db.pokemonSheets.update(sheet.id!, { trainingPoints })
    onUpdated?.({ ...sheet, trainingPoints })
  }

  if (size === 'sm') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
        title="Training Points"
      >
        🏆 {tp} TP
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1.5">
      <span className="text-sm font-bold text-indigo-700">🏆 {tp} TP</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => adjust(-delta)}
          className="h-6 w-6 rounded border border-indigo-200 bg-white text-xs font-bold text-indigo-600 hover:bg-indigo-100"
          title="Remover (ex: gastar em Rank Up / Golpe novo)"
        >
          −
        </button>
        <input
          type="number"
          value={delta}
          min={1}
          onChange={(e) => setDelta(Math.max(1, Number(e.target.value) || 1))}
          className="w-10 rounded border border-indigo-200 bg-white px-1 py-0.5 text-center text-xs font-bold text-indigo-700 focus:outline-none"
        />
        <button
          onClick={() => adjust(delta)}
          className="h-6 w-6 rounded border border-indigo-200 bg-white text-xs font-bold text-indigo-600 hover:bg-indigo-100"
          title="Adicionar (ex: pontos de batalha)"
        >
          +
        </button>
      </div>
    </div>
  )
}
