import { useEffect, useState } from 'react'
import { getDiceDisplay, setDiceDisplay, onDiceDisplayChange } from '../lib/diceDisplay'

// Regra 3.0 (Corebook p. 35): dados que caem em 4, 5 ou 6 são sucessos.
//
// Chance Dice (p. 76) é uma mecânica DIFERENTE: uma rolagem SEPARADA, feita
// depois que o golpe já acertou/causou dano, com uma quantidade própria de
// dados definida pelo Added Effect do golpe (ex: "Roll 1 Chance Die to
// inflict Burn"). O efeito ativa se PELO MENOS UM dado cair em 6 — não tem
// relação com quantos 6 saíram na rolagem de Acerto/Dano.
export interface RollResult {
  label: string
  pool: number
  dice: number[]
  successes: number
  sixes: number
  at: number
  mode?: 'chance' | 'additive' // ver rollChanceDice / rollAdditive
  triggered?: boolean // para mode 'chance': algum dado saiu 6?
  bonus?: number // para mode 'additive': número fixo somado ao dado
  total?: number // para mode 'additive': dado + bonus
  icon?: string // sprite do Pokémon ou avatar do Treinador dono do roll
}

export function rollDice(pool: number, label = ''): RollResult {
  const dice = Array.from(
    { length: pool },
    () => 1 + Math.floor(Math.random() * 6),
  )
  return {
    label,
    pool,
    dice,
    successes: dice.filter((d) => d >= 4).length,
    sixes: dice.filter((d) => d === 6).length,
    at: Date.now(),
  }
}

export function rollChanceDice(pool: number, label = ''): RollResult {
  const dice = Array.from(
    { length: pool },
    () => 1 + Math.floor(Math.random() * 6),
  )
  const sixes = dice.filter((d) => d === 6).length
  return {
    label,
    pool,
    dice,
    successes: sixes,
    sixes,
    at: Date.now(),
    mode: 'chance',
    triggered: sixes > 0,
  }
}

// Iniciativa (p. 56): NÃO é uma pool de sucessos. É 1d6 + um número fixo
// (Dexterity + Alert) somados direto — o resultado é comparado entre todos
// os combatentes para definir a ordem de turno.
export function rollAdditive(bonus: number, label = ''): RollResult {
  const die = 1 + Math.floor(Math.random() * 6)
  return {
    label,
    pool: 1,
    dice: [die],
    successes: 0,
    sixes: die === 6 ? 1 : 0,
    at: Date.now(),
    mode: 'additive',
    bonus,
    total: bonus + die,
  }
}

// Extrai "Roll N Chance Die(s)" do texto de efeito de um golpe (ex:
// "Roll 1 Chance Die to inflict 2nd Degree Burn"). Retorna null se o golpe
// não tiver esse tipo de efeito ou usar um texto não-padrão.
export function parseChanceDiceCount(addedEffect: string): number | null {
  const m = addedEffect.match(/Roll (\d+) Chance Dic?e/i)
  return m ? Number(m[1]) : null
}

const DIE_FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

export function DiceRow({ r }: { r: RollResult }) {
  const isChance = r.mode === 'chance'
  const isAdditive = r.mode === 'additive'
  const [display, setDisplay] = useState(getDiceDisplay())

  useEffect(() => onDiceDisplayChange(() => setDisplay(getDiceDisplay())), [])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {r.dice.map((d, i) => (
          <span
            key={i}
            className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1 leading-none shadow-sm ${
              display === 'numbers' ? 'text-sm font-bold' : 'text-lg'
            } ${
              d === 6
                ? 'bg-amber-400 text-white'
                : isChance
                  ? 'bg-slate-200 text-slate-500'
                  : d >= 4
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
            }`}
          >
            {display === 'icons' ? DIE_FACE[d] : display === 'numbers' ? d : `${DIE_FACE[d]} ${d}`}
          </span>
        ))}
      </div>
      {isAdditive ? (
        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-700">
          {r.dice[0]} + {r.bonus} = {r.total}
        </span>
      ) : isChance ? (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            r.triggered
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {r.triggered ? '✨ Efeito ativado!' : 'Sem efeito desta vez'}
        </span>
      ) : (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
          {r.successes} {r.successes === 1 ? 'sucesso' : 'sucessos'}
        </span>
      )}
    </div>
  )
}

export default function DiceRoller({
  onRoll,
}: {
  onRoll?: (r: RollResult) => void
}) {
  const [open, setOpen] = useState(false)
  const [pool, setPool] = useState(3)
  const [label, setLabel] = useState('')
  const [history, setHistory] = useState<RollResult[]>([])
  const [display, setDisplay] = useState(getDiceDisplay())

  const roll = () => {
    const r = rollDice(pool, label.trim())
    setHistory((h) => [r, ...h].slice(0, 20))
    onRoll?.(r)
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        title="Rolador de dados"
        className="fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-2xl text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        🎲
      </button>

      {open && (
        <div className="fixed right-4 bottom-20 z-40 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">🎲 Rolador de dados</p>
              <div className="flex overflow-hidden rounded-lg border border-white/30 text-[10px] font-bold">
                {(['icons', 'numbers', 'both'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDiceDisplay(d)
                      setDisplay(d)
                    }}
                    className={`px-1.5 py-0.5 ${
                      display === d ? 'bg-white text-slate-800' : 'hover:bg-white/10'
                    }`}
                    title="Como mostrar os dados no chat e aqui"
                  >
                    {d === 'icons' ? '⚄' : d === 'numbers' ? '123' : '⚄123'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-300">sucesso em 4, 5 ou 6</p>
          </div>
          <div className="space-y-3 p-4">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Rótulo (ex: Dexterity + Channel)"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-red-400 focus:bg-white focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPool(Math.max(1, pool - 1))}
                className="h-9 w-9 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-100"
              >
                −
              </button>
              <span className="flex-1 text-center text-lg font-extrabold text-slate-800">
                {pool} {pool === 1 ? 'dado' : 'dados'}
              </span>
              <button
                onClick={() => setPool(Math.min(20, pool + 1))}
                className="h-9 w-9 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-100"
              >
                +
              </button>
              <button
                onClick={roll}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-red-700 active:scale-95"
              >
                Rolar!
              </button>
            </div>

            {history.length > 0 && (
              <div className="max-h-64 space-y-2.5 overflow-y-auto border-t border-slate-100 pt-3">
                {history.map((r) => (
                  <div key={r.at} className="rounded-lg bg-slate-50 p-2">
                    <p className="mb-1 truncate text-xs font-semibold text-slate-700">
                      {r.label || `${r.pool}d6`}
                    </p>
                    <DiceRow r={r} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
