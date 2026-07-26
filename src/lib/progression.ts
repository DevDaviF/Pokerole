import type { EvolutionInfo, Rank } from '../types'
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

// Benefícios por Rank (Corebook 3.0, p.30-31) — vale pra Treinador e
// Pokémon. NÃO é uma progressão linear: Master repete o total de
// atributos/sociais de Ace (o extra vira +2 dados em rolagens de skill),
// só Champion salta de novo. Válido pra qualquer Pokémon (capturado ou
// selvagem): não é bônus especial, então é totalmente realocável via
// Re-Treino.
const RANK_BENEFITS: Record<
  Rank,
  { attr: number; skill: number; skillLimit: number }
> = {
  Starter: { attr: 0, skill: 5, skillLimit: 1 },
  Rookie: { attr: 2, skill: 10, skillLimit: 2 },
  Standard: { attr: 4, skill: 14, skillLimit: 3 },
  Advanced: { attr: 6, skill: 17, skillLimit: 4 },
  Expert: { attr: 8, skill: 19, skillLimit: 5 },
  Ace: { attr: 10, skill: 20, skillLimit: 5 },
  Master: { attr: 10, skill: 22, skillLimit: 5 },
  Champion: { attr: 14, skill: 25, skillLimit: 5 },
}

export function rankAttributePoints(rank: Rank): number {
  return RANK_BENEFITS[rank].attr
}

// Mesmo valor que os atributos físicos, por regra (p.30-31).
export function rankSocialPoints(rank: Rank): number {
  return RANK_BENEFITS[rank].attr
}

export function rankSkillPoints(rank: Rank): number {
  return RANK_BENEFITS[rank].skill
}

// Máximo de pontos numa única Skill nesse Rank.
export function rankSkillLimit(rank: Rank): number {
  return RANK_BENEFITS[rank].skillLimit
}

// Física apenas — Special fica de fora da distribuição por Rank (Pokérole
// trata Special como um atributo à parte na 3.0).
export const RANK_POINT_ATTRIBUTES = [
  'strength',
  'dexterity',
  'vitality',
  'insight',
] as const

// ── Idade do Treinador (Corebook 3.0, p.41) ─────────────────────────
// Só Treinadores (humanos) recebem pontos extra por idade — Pokémon não
// (p.41: "Humans get their Attributes and Social Attributes affected by
// how old they are"). Esses pontos SOMAM aos pontos de Rank no mesmo
// orçamento livre pra distribuir.
export const AGES = ['Child', 'Teen', 'Adult', 'Senior'] as const
export type Age = (typeof AGES)[number]

export const AGE_LABELS: Record<Age, string> = {
  Child: 'Criança',
  Teen: 'Adolescente',
  Adult: 'Adulto',
  Senior: 'Idoso',
}

const AGE_BENEFITS: Record<Age, { attr: number; social: number }> = {
  Child: { attr: 0, social: 0 },
  Teen: { attr: 2, social: 2 }, // padrão pra novos jogos (p.41)
  Adult: { attr: 4, social: 4 },
  Senior: { attr: 3, social: 6 },
}

export function ageAttributePoints(age: Age): number {
  return AGE_BENEFITS[age].attr
}

export function ageSocialPoints(age: Age): number {
  return AGE_BENEFITS[age].social
}

// O import guarda "Speed: Fast/Medium/Slow" dentro do texto livre `detail`
// de cada evolução (nem toda evolução tem isso — Stone/Trade não têm).
export function parseEvolutionSpeed(detail: string): EvolutionSpeed | null {
  const m = detail.match(/Speed:\s*(Fast|Medium|Slow)/i)
  if (!m) return null
  const s = m[1]
  return (s[0].toUpperCase() + s.slice(1).toLowerCase()) as EvolutionSpeed
}

// ── Aprender Golpes (Corebook 3.0, p.109-111) ───────────────────────
// Três mecânicas DIFERENTES, cada uma com seu próprio custo — nenhuma é
// "5 TP fixo pra tudo":
//  1. Golpe do Rank atual/anterior (já no learnset, só quando no limite
//     de golpes): custo por Estágio Evolutivo, mais barato se o golpe for
//     de um Rank anterior ao atual (p.109).
//  2. Over-Rank (golpe ACIMA do Rank atual, ainda dentro do learnset):
//     custo por Estágio Evolutivo × quantos Ranks acima; exige
//     Happiness+Loyalty >= 7; só 1 golpe Over-Rank por vez (p.111).
//  3. TM/TR (qualquer golpe, dentro ou fora do learnset): 5 TP fixo,
//     independe de Rank/Estágio (p.110) — já implementado à parte.

export type EvolutiveStage = 'First' | 'Second' | 'Final'

// Primeiro Estágio: nada evolui PRA essa espécie. Estágio Final: essa
// espécie não evolui PRA mais nada (Mega não conta como estágio).
export function evolutiveStage(evolutions: EvolutionInfo[]): EvolutiveStage {
  const evolvesFrom = evolutions.some((e) => e.direction === 'from' && e.kind !== 'Mega')
  const evolvesTo = evolutions.some((e) => e.direction === 'to' && e.kind !== 'Mega')
  if (!evolvesFrom) return 'First'
  if (evolvesTo) return 'Second'
  return 'Final'
}

const LEARN_MOVE_COST: Record<EvolutiveStage, { current: number; previous: number }> = {
  First: { current: 2, previous: 1 },
  Second: { current: 4, previous: 2 },
  Final: { current: 6, previous: 3 },
}

// tier: "current" = golpe do Rank atual do Pokémon; "previous" = golpe de
// um Rank que ele já passou (mais barato de relembrar/trocar).
export function learnMoveCost(stage: EvolutiveStage, tier: 'current' | 'previous'): number {
  return LEARN_MOVE_COST[stage][tier]
}

const OVER_RANK_COST_PER_STEP: Record<EvolutiveStage, number> = {
  First: 5,
  Second: 15,
  Final: 20,
}

export function overRankCost(stage: EvolutiveStage, ranksAbove: number): number {
  return OVER_RANK_COST_PER_STEP[stage] * Math.max(1, ranksAbove)
}
