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

// Pontos de atributo acumulados por Rank (o livro não fixa uma tabela — aqui
// usamos +2 por degrau de Rank, começando do zero em Starter). Válido pra
// qualquer Pokémon (capturado ou selvagem): não é um bônus especial, então é
// totalmente realocável via Re-Treino.
const ATTR_POINTS_PER_RANK_STEP = 2

export function rankAttributePoints(rank: Rank): number {
  return rankIndex(rank) * ATTR_POINTS_PER_RANK_STEP
}

// Física apenas — Special fica de fora da distribuição por Rank (Pokérole
// trata Special como um atributo à parte na 3.0).
export const RANK_POINT_ATTRIBUTES = [
  'strength',
  'dexterity',
  'vitality',
  'insight',
] as const

// O import guarda "Speed: Fast/Medium/Slow" dentro do texto livre `detail`
// de cada evolução (nem toda evolução tem isso — Stone/Trade não têm).
export function parseEvolutionSpeed(detail: string): EvolutionSpeed | null {
  const m = detail.match(/Speed:\s*(Fast|Medium|Slow)/i)
  if (!m) return null
  const s = m[1]
  return (s[0].toUpperCase() + s.slice(1).toLowerCase()) as EvolutionSpeed
}
