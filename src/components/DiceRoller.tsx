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
  mode?: 'chance' | 'additive' | 'sum' // ver rollChanceDice / rollAdditive / rollSum
  triggered?: boolean // para mode 'chance': algum dado saiu 6?
  bonus?: number // para mode 'additive'/'sum': número fixo somado ao(s) dado(s)
  total?: number // para mode 'additive'/'sum': soma dos dados + bonus
  sides?: number // para mode 'sum': faces do dado (4/6/8/10/12/20/100) — d6 comum quando ausente
  icon?: string // sprite do Pokémon ou avatar do Treinador dono do roll
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return result
}

// Chance de tirar >= difficulty sucessos numa pool de d6 (sucesso em 4/5/6,
// ou seja p=0.5 por dado).
function successChance(pool: number, difficulty: number): number {
  if (difficulty <= 0) return 1
  if (difficulty > pool) return 0
  let p = 0
  for (let k = difficulty; k <= pool; k++) p += combinations(pool, k)
  return p / 2 ** pool
}

// Já considerando a 2ª chance do Corebook (falhou, rola de novo).
export function successChanceWithRetry(pool: number, difficulty: number): number {
  const p1 = successChance(pool, difficulty)
  return 1 - (1 - p1) ** 2
}

// Trunca (não arredonda pra cima) pra 1 casa decimal — 99.96% deve
// aparecer como "99.9%", não "100.0%".
export function truncatedPercent(p: number): string {
  return (Math.floor(p * 1000) / 10).toFixed(1)
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

// Dados "avulsos" fora do sistema de sucessos do Pokérole — d4/d6/d8/d10/
// d12/d20/d100, com modificador fixo somado ao total (ex: "3d6+20" digitado
// no chat). Sem noção de sucesso/6 especial: o que importa é a SOMA.
export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const

export function rollSum(pool: number, sides: number, bonus = 0, label = ''): RollResult {
  const dice = Array.from(
    { length: pool },
    () => 1 + Math.floor(Math.random() * sides),
  )
  const total = dice.reduce((sum, d) => sum + d, 0) + bonus
  return {
    label,
    pool,
    dice,
    successes: 0,
    sixes: dice.filter((d) => d === 6).length,
    at: Date.now(),
    mode: 'sum',
    sides,
    bonus,
    total,
  }
}

// Extrai "Roll N Chance Die(s)" do texto de efeito de um golpe (ex:
// "Roll 1 Chance Die to inflict 2nd Degree Burn"). Retorna null se o golpe
// não tiver esse tipo de efeito ou usar um texto não-padrão.
export function parseChanceDiceCount(addedEffect: string): number | null {
  const m = addedEffect.match(/Roll (\d+) Chance Dic?e/i)
  return m ? Number(m[1]) : null
}

// Isola só a cláusula do efeito em si (ex: "Flinch the Foe" de "Roll 3
// Chance Dice to Flinch the Foe.") pra poder destacar visualmente no
// chat, sem o resto do texto de regras do golpe. null se não achar o
// padrão "Roll N Chance Dice to <efeito>." (texto não-padrão).
export function parseChanceDiceEffect(addedEffect: string): string | null {
  const m = addedEffect.match(/Roll \d+ Chance Dic?e[a-z\s]*? to ([^.]+)\.?/i)
  return m ? m[1].trim() : null
}

const DIE_FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

export function DiceRow({ r }: { r: RollResult }) {
  const isChance = r.mode === 'chance'
  const isAdditive = r.mode === 'additive'
  const isSum = r.mode === 'sum'
  const [display, setDisplay] = useState(getDiceDisplay())

  useEffect(() => onDiceDisplayChange(() => setDisplay(getDiceDisplay())), [])

  // d4/d8/d10/d12/d20/d100 não têm face ⚀-⚅ pra representar — só d6
  // (sides ausente ou 6) usa os ícones de dado.
  const forceNumeric = isSum && r.sides !== undefined && r.sides !== 6

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {r.dice.map((d, i) => (
          <span
            key={i}
            className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1 leading-none shadow-sm ${
              display === 'numbers' || forceNumeric ? 'text-sm font-bold' : 'text-lg'
            } ${
              isSum
                ? 'bg-slate-200 text-slate-600'
                : d === 6
                  ? 'bg-amber-400 text-white'
                  : isChance
                    ? 'bg-slate-200 text-slate-500'
                    : d >= 4
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
            }`}
          >
            {forceNumeric
              ? d
              : display === 'icons'
                ? DIE_FACE[d]
                : display === 'numbers'
                  ? d
                  : `${DIE_FACE[d]} ${d}`}
          </span>
        ))}
      </div>
      {isSum ? (
        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-700">
          {r.pool}d{r.sides ?? 6}
          {r.bonus ? ` ${r.bonus > 0 ? '+' : ''}${r.bonus}` : ''} = {r.total}
        </span>
      ) : isAdditive ? (
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
  // Pede o roll (pool + rótulo, mais modo/faces/bônus quando é "dado
  // avulso") e recebe de volta o resultado JÁ validado — quando há mesa
  // ativa, quem implementa isso (App.tsx → rollShared) roda o RNG no
  // servidor, não aqui. Sem essa prop (uso standalone), rola localmente.
  onRoll?: (opts: {
    pool: number
    label: string
    mode?: 'chance' | 'additive' | 'sum'
    sides?: number
    bonus?: number
  }) => Promise<RollResult>
}) {
  const [open, setOpen] = useState(false)
  // "pool": sistema de sucessos do Pokérole (Nd6, 4/5/6 = sucesso).
  // "sum": dado avulso (d4/d8/d10/d12/d20/d100 etc.), soma + modificador.
  const [kind, setKind] = useState<'pool' | 'sum'>('pool')
  const [pool, setPool] = useState(3)
  const [sides, setSides] = useState(6)
  const [bonus, setBonus] = useState(0)
  const [label, setLabel] = useState('')
  const [history, setHistory] = useState<RollResult[]>([])
  const [display, setDisplay] = useState(getDiceDisplay())

  const roll = async () => {
    const r =
      kind === 'sum'
        ? onRoll
          ? await onRoll({ pool, label: label.trim(), mode: 'sum', sides, bonus })
          : rollSum(pool, sides, bonus, label.trim())
        : onRoll
          ? await onRoll({ pool, label: label.trim() })
          : rollDice(pool, label.trim())
    setHistory((h) => [r, ...h].slice(0, 20))
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
            <p className="text-xs text-slate-300">
              {kind === 'pool' ? 'sucesso em 4, 5 ou 6' : `soma de ${pool}d${sides}${bonus ? ` ${bonus > 0 ? '+' : ''}${bonus}` : ''}`}
            </p>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-bold">
              {(
                [
                  ['pool', '🎲 Sucessos'],
                  ['sum', '🔢 Dado avulso'],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`flex-1 px-2 py-1.5 ${
                    kind === k ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                kind === 'pool' ? 'Rótulo (ex: Dexterity + Channel)' : 'Rótulo (ex: Teste de resistência)'
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-red-400 focus:bg-white focus:outline-none"
            />
            {kind === 'sum' && (
              <div className="flex flex-wrap items-center gap-1">
                {DIE_SIDES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSides(s)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      sides === s
                        ? 'bg-cyan-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    d{s}
                  </button>
                ))}
                <label
                  className="flex items-center gap-1 text-xs text-slate-500"
                  title="Qualquer dado, mesmo que não exista de verdade (ex: d32)"
                >
                  d
                  <input
                    type="number"
                    min={2}
                    max={1000}
                    value={sides}
                    onChange={(e) =>
                      setSides(Math.max(2, Math.min(1000, Number(e.target.value) || 2)))
                    }
                    className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 text-center text-xs font-bold focus:border-red-400 focus:outline-none"
                  />
                </label>
              </div>
            )}
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
                onClick={() => setPool(Math.min(100, pool + 1))}
                className="h-9 w-9 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-100"
              >
                +
              </button>
              {kind === 'pool' && (
                <button
                  onClick={roll}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-red-700 active:scale-95"
                >
                  Rolar!
                </button>
              )}
            </div>
            {kind === 'sum' && (
              <div className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-1.5 text-xs text-slate-500">
                  modificador
                  <input
                    type="number"
                    value={bonus}
                    onChange={(e) => setBonus(Number(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-bold focus:border-red-400 focus:outline-none"
                  />
                </label>
                <button
                  onClick={roll}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-red-700 active:scale-95"
                >
                  Rolar!
                </button>
              </div>
            )}

            {history.length > 0 && (
              <div className="max-h-64 space-y-2.5 overflow-y-auto border-t border-slate-100 pt-3">
                {history.map((r) => (
                  <div key={r.at} className="rounded-lg bg-slate-50 p-2">
                    <p className="mb-1 truncate text-xs font-semibold text-slate-700">
                      {r.label || `${r.pool}d${r.sides ?? 6}`}
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
