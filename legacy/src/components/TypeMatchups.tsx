import { typeMatchupsFor } from '../lib/typeChart'
import TypeBadge from './TypeBadge'

// Fraquezas/resistências/imunidades de um Pokémon (Corebook p.52-53):
// dado extra (fraco), dado a menos (resiste), 2 dados (dual fraco nos 2),
// -2 dados (dual resiste nos 2), ou imunidade total (Physical/Special).
export default function TypeMatchups({ types }: { types: string[] }) {
  const { weak, doubleWeak, resist, doubleResist, immune } = typeMatchupsFor(types)

  const groups: Array<{ label: string; list: string[]; hint: string }> = [
    { label: '⚠️⚠️ Extremamente fraco (+2 dados)', list: doubleWeak, hint: 'x2' },
    { label: '⚠️ Fraco (+1 dado)', list: weak, hint: 'x1' },
    { label: '🛡️ Resiste (−1 dado)', list: resist, hint: 'x1' },
    { label: '🛡️🛡️ Resiste muito (−2 dados)', list: doubleResist, hint: 'x2' },
    { label: '🚫 Imune (Physical/Special)', list: immune, hint: 'x1' },
  ].filter((g) => g.list.length > 0)

  if (groups.length === 0) {
    return <p className="text-xs text-slate-400">Neutro contra todos os tipos.</p>
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1 text-xs font-bold text-slate-500 uppercase">{g.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.list.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
