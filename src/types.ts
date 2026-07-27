// ── Dados estáticos (gerados por scripts/import-data.ts) ─────────────

export type AttributeName =
  | 'Strength'
  | 'Dexterity'
  | 'Vitality'
  | 'Special'
  | 'Insight'

export type SocialAttributeName =
  | 'Tough'
  | 'Cool'
  | 'Beauty'
  | 'Cute'
  | 'Clever'

// Na 3.0 existem categorias mistas ("Physical/Special", "Support/Physical/Special")
export type MoveCategory = 'Physical' | 'Special' | 'Support'

export interface Move {
  id: string
  name: string
  type: string // "Fire", "Water", "Typeless"...
  category: string // "Physical" | "Special" | "Support" | combinações
  power: number | null
  powerLabel?: string // quando o Power do livro não é numérico (ex: "Happiness + Loyalty")
  accuracy: { attribute: string; skill: string }
  damagePool: { attribute: string; bonus: number; attribute2?: string } | null
  target: string
  addedEffect: string
  flavorText: string
}

export interface LearnsetEntry {
  rank: string // rank de aprendizado ("Starter", "Rookie"...)
  moveId: string
}

export interface EvolutionInfo {
  direction: 'from' | 'to'
  name: string
  kind: string // "Level", "Stone", "Mega", "Trade"...
  detail: string // velocidade, item, condição etc.
}

export interface Attributes {
  strength: number
  dexterity: number
  vitality: number
  special: number
  insight: number
}

export interface Pokemon {
  id: string
  dexNumber: string
  name: string
  types: string[]
  baseHp: number
  suggestedRank: string
  attributes: Attributes // valores iniciais da espécie
  maxAttributes: Attributes // máximos da espécie
  height: string
  weight: string
  abilities: string[]
  hiddenAbility?: string
  dexCategory: string
  dexDescription: string
  legendary: boolean
  goodStarter: boolean
  evolutions: EvolutionInfo[]
  learnset: LearnsetEntry[]
}

export interface Ability {
  id: string
  name: string
  effect: string
  description: string
}

export interface Nature {
  id: string
  name: string
  confidence: number
  keywords: string
  description: string
}

export interface Item {
  id: string
  name: string
  pocket: string
  category: string
  description: string
  price?: string
  oneUse?: boolean
}

// ── Fichas persistidas no IndexedDB (Dexie) ──────────────────────────

// Ranks da edição 3.0 (ordem de progressão)
export const RANKS = [
  'Starter',
  'Rookie',
  'Standard',
  'Advanced',
  'Expert',
  'Ace',
  'Master',
  'Champion',
] as const

export type Rank = (typeof RANKS)[number]

export const rankIndex = (rank: string): number =>
  RANKS.indexOf(rank as Rank)

export interface SocialAttributes {
  tough: number
  cool: number
  beauty: number
  cute: number
  clever: number
}

export interface InventoryEntry {
  itemId: string
  qty: number
}

export interface Trainer {
  id?: number
  name: string
  rank: Rank
  age?: 'Child' | 'Teen' | 'Adult' | 'Senior'
  attributes: Attributes
  social: SocialAttributes
  skills: Record<string, number>
  hp: number
  currentHp: number
  currentWill?: number // Will Points atuais (Score = Insight + 3, p.28); undefined = cheio
  notes: string
  money?: number
  inventory?: InventoryEntry[]
  imageUrl?: string
  isNpc?: boolean // treinador de NPC/ginásio controlado pelo Mestre numa mesa
  // Mesa a que este Treinador pertence — jogador ou NPC. Sem isso, um
  // personagem de uma mesa vazava pra "minhas fichas"/Ordem de Combate de
  // qualquer outra mesa que a mesma conta participasse. undefined = ainda
  // não vinculado a nenhuma mesa (uso local, fora do modo multiplayer).
  mesaId?: string
}

export interface PokemonSheet {
  id?: number
  trainerId: number
  species: string // id do Pokémon no Pokédex
  nickname: string
  rank: Rank
  nature: string
  ability: string
  heldItem: string
  attributes: Attributes
  social: SocialAttributes
  skills: Record<string, number>
  knownMoves: string[] // até 4 moveIds
  currentHp: number
  statusConditions: string[]
  inTeam: boolean
  trainingPoints?: number // TP acumulados (treinos somam automático)
  isNpc?: boolean // gerado pelo Mestre (encontro selvagem / Pokémon de ginásio)
  npcKind?: 'wild' | 'gym'
  mesaId?: string // mesa onde este NPC foi gerado — evita vazar entre mesas diferentes
  isStarter?: boolean // Pokémon inicial do treinador (1 por treinador)
  happiness?: number
  loyalty?: number
  currentWill?: number // Will Points atuais (Score = Insight + 3, p.28); undefined = cheio
  overRankMoveId?: string // golpe atual aprendido via Over-Rank (só 1 por vez)
  notes: string
}
