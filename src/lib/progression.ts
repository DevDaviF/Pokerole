import type { Rank } from '../types'
import { RANKS, rankIndex } from '../types'

// Custos em Training Points (Corebook 3.0, p. 107-112).

// Rank Up: custo depende do PRÓXIMO rank alcançado.
const RANK_UP_COST: Record<Rank, number> = {
  Starter: 5, // Starter -> Rookie
  Rookie: 15, // Rookie -> Standard
  Standard: 25, // Standard -> Advanced
  Advanced: 30, // Advanced -> Expert
  Expert: 35, // Expert -> Ace
  Ace: 40, // Ace -> Master
  Master: 50, // Master -> Champion
  Champion: Infinity,
}

export function nextRank(current: Rank): Rank | null {
  const idx = rankIndex(current)
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null
}

export function rankUpCost(current: Rank): number | null {
  const next = nextRank(current)
  return next ? RANK_UP_COST[current] : null
}

// Re-Train: custo depende do rank ATUAL do Pokémon.
const RETRAIN_COST: Record<Rank, number> = {
  Starter: 1,
  Rookie: 10,
  Standard: 20,
  Advanced: 25,
  Expert: 30,
  Ace: 35,
  Master: 40,
  Champion: 45,
}

export function retrainCost(current: Rank): number {
  return RETRAIN_COST[current]
}

// Evolução: custo depende do "Evolution Time" da espécie (Fast/Medium/Slow).
export type EvolutionSpeed = 'Fast' | 'Medium' | 'Slow'

const EVOLVE_COST: Record<EvolutionSpeed, number> = {
  Fast: 10,
  Medium: 30,
  Slow: 50,
}

export function evolveCost(speed: EvolutionSpeed): number {
  return EVOLVE_COST[speed]
}

// O import guarda "Speed: Fast/Medium/Slow" dentro do texto livre `detail`
// de cada evolução (nem toda evolução tem isso — Stone/Trade não têm).
export function parseEvolutionSpeed(detail: string): EvolutionSpeed | null {
  const m = detail.match(/Speed:\s*(Fast|Medium|Slow)/i)
  if (!m) return null
  const s = m[1]
  return (s[0].toUpperCase() + s.slice(1).toLowerCase()) as EvolutionSpeed
}
