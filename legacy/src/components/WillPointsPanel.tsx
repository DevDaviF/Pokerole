import { db } from '../db'
import type { PokemonSheet, Trainer } from '../types'

// Will Score = Insight + 3 (Corebook p.28). Gasto em 3 usos (Aguentar a
// Dor, Arriscar a Sorte, Forçar o Destino) e recuperado descansando,
// treinando, vencendo uma batalha ou completando uma conquista — aqui só
// oferecemos o rastreamento manual +/- pro jogador anotar o gasto/
// recuperação narrativamente, mais a recuperação automática de Treino e
// Descanso (ver TreinoRoll.tsx e DayPassPanel.tsx).
function willMax(insight: number): number {
  return insight + 3
}

function WillRow({
  label,
  current,
  max,
  onChange,
}: {
  label: string
  current: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{label}</span>
      <button
        onClick={() => onChange(Math.max(0, current - 1))}
        className="h-6 w-6 rounded border border-slate-300 text-xs font-bold text-slate-500 hover:bg-slate-100"
      >
        −
      </button>
      <span className="w-12 text-center text-sm font-bold text-indigo-700">
        {current}/{max}
      </span>
      <button
        onClick={() => onChange(Math.min(max, current + 1))}
        className="h-6 w-6 rounded border border-slate-300 text-xs font-bold text-slate-500 hover:bg-slate-100"
      >
        +
      </button>
    </div>
  )
}

export default function WillPointsPanel({
  myTrainer,
  myPokemonSheets,
}: {
  myTrainer: Trainer | undefined
  myPokemonSheets: PokemonSheet[]
}) {
  const team = myPokemonSheets.filter((s) => s.inTeam)

  if (!myTrainer && team.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
      <div className="bg-indigo-600 px-4 py-2.5 text-white">
        <b>🧠 Will Points</b>
        <span className="ml-2 text-xs opacity-80">
          gasta em Aguentar a Dor / Arriscar a Sorte / Forçar o Destino (p.28)
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        {myTrainer && (
          <WillRow
            label={myTrainer.name}
            current={myTrainer.currentWill ?? willMax(myTrainer.attributes.insight)}
            max={willMax(myTrainer.attributes.insight)}
            onChange={(v) => db.trainers.update(myTrainer.id!, { currentWill: v })}
          />
        )}
        {team.map((s) => (
          <WillRow
            key={s.id}
            label={s.nickname || 'Pokémon'}
            current={s.currentWill ?? willMax(s.attributes.insight)}
            max={willMax(s.attributes.insight)}
            onChange={(v) => db.pokemonSheets.update(s.id!, { currentWill: v })}
          />
        ))}
      </div>
    </div>
  )
}
