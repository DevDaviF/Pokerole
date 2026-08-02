// Tabelas de raridade por habitat. Só Plains/Grasslands e Forests/Jungle
// têm tabela oficial no Corebook 3.0 (p. 595, "Random Encounters"); o livro
// lista mais 6 biomas (p. 595) sem tabela pronta e diz "you can add your
// own biomes and fill them with any kind of pokémon you want" — as outras
// tabelas abaixo são uma extensão nossa nesse espírito, não RAW.
export interface Habitat {
  id: string
  label: string
  icon: string
  common: string[]
  uncommon: string[]
  rare: string[]
  official: boolean
}

export const HABITATS: Habitat[] = [
  {
    id: 'grasslands',
    label: 'Planícies/Campos',
    icon: '🌾',
    common: ['Normal', 'Flying', 'Ground', 'Grass', 'Poison', 'Bug'],
    uncommon: ['Fighting', 'Rock', 'Dark', 'Electric', 'Ghost', 'Fairy'],
    rare: ['Fire', 'Fairy', 'Psychic', 'Water', 'Ice', 'Dragon', 'Steel'],
    official: true,
  },
  {
    id: 'forest',
    label: 'Florestas/Selva',
    icon: '🌳',
    common: ['Bug', 'Grass', 'Poison', 'Flying'],
    uncommon: ['Fighting', 'Electric', 'Normal', 'Rock', 'Fire', 'Water', 'Ground', 'Psychic', 'Fairy'],
    rare: ['Ghost', 'Steel', 'Dark', 'Ice', 'Dragon'],
    official: true,
  },
  {
    id: 'towns',
    label: 'Cidades/Vilas',
    icon: '🏘️',
    common: ['Normal', 'Electric', 'Poison', 'Fairy', 'Fighting', 'Flying', 'Bug'],
    uncommon: ['Psychic', 'Steel', 'Dark', 'Water', 'Grass', 'Ground', 'Rock'],
    rare: ['Ghost', 'Dragon', 'Fire', 'Ice'],
    official: false,
  },
  {
    id: 'lake',
    label: 'Lagos/Mares',
    icon: '🌊',
    common: ['Water', 'Normal'],
    uncommon: ['Ice', 'Electric', 'Bug', 'Poison', 'Flying', 'Fairy'],
    rare: ['Dragon', 'Psychic', 'Fire', 'Grass', 'Fighting', 'Ground', 'Rock', 'Ghost', 'Dark', 'Steel'],
    official: false,
  },
  {
    id: 'riverside',
    label: 'Beira de Lagos/Rios',
    icon: '🏖️',
    common: ['Water', 'Normal', 'Bug', 'Grass'],
    uncommon: ['Ice', 'Electric', 'Flying', 'Fighting', 'Poison', 'Ground', 'Fairy'],
    rare: ['Dragon', 'Psychic', 'Rock', 'Fire', 'Ghost', 'Dark', 'Steel'],
    official: false,
  },
  {
    id: 'caves',
    label: 'Cavernas/Montanhas',
    icon: '⛰️',
    common: ['Rock', 'Ground', 'Dark', 'Normal'],
    uncommon: ['Fighting', 'Steel', 'Poison', 'Fire', 'Bug'],
    rare: ['Dragon', 'Psychic', 'Ghost', 'Water', 'Electric', 'Grass', 'Ice', 'Flying', 'Fairy'],
    official: false,
  },
  {
    id: 'desert',
    label: 'Desertos',
    icon: '🏜️',
    common: ['Ground', 'Rock', 'Normal', 'Electric'],
    uncommon: ['Fire', 'Poison', 'Steel', 'Fighting', 'Flying'],
    rare: ['Dragon', 'Dark', 'Psychic', 'Water', 'Grass', 'Ice', 'Bug', 'Ghost', 'Fairy'],
    official: false,
  },
  {
    id: 'volcano',
    label: 'Vulcões',
    icon: '🌋',
    common: ['Fire', 'Rock', 'Ground'],
    uncommon: ['Dark', 'Poison', 'Normal', 'Electric', 'Fighting'],
    rare: ['Dragon', 'Ghost', 'Water', 'Grass', 'Ice', 'Flying', 'Psychic', 'Bug', 'Fairy', 'Steel'],
    official: false,
  },
  {
    id: 'arctic',
    label: 'Regiões Árticas',
    icon: '❄️',
    common: ['Ice', 'Water', 'Normal'],
    uncommon: ['Flying', 'Steel', 'Rock', 'Fighting', 'Poison', 'Ground', 'Ghost', 'Dark'],
    rare: ['Dragon', 'Psychic', 'Fairy', 'Fire', 'Electric', 'Grass', 'Bug'],
    official: false,
  },
  {
    id: 'ruins',
    label: 'Ruínas/Cemitérios',
    icon: '💀',
    common: ['Ghost', 'Psychic', 'Normal', 'Dark', 'Poison', 'Ground', 'Bug', 'Rock'],
    uncommon: ['Fighting', 'Steel', 'Fire', 'Water', 'Electric', 'Flying'],
    rare: ['Dragon', 'Grass', 'Ice', 'Fairy'],
    official: true,
  }
]

export type RarityTier = 'common' | 'uncommon' | 'rare'

export type LuckyTier = 'unlucky' | 'average' | 'lucky'

export const POKEMON_APPEARANCES: Record<LuckyTier, Record<RarityTier, number>> = {
  unlucky: { common: 0.8, uncommon: 0.145, rare: 0.05 },
  average: { common: 0.5, uncommon: 0.395, rare: 0.1 },
  lucky: { common: 0.2, uncommon: 0.405, rare: 0.39 },
}

export interface PokeTier {
  pokemon: string,
  tier: number
}

export interface PokeTierBox {
  prob: PokeTier,
  alias: string
}

// Sugestão de quantidade/raridade a partir dos sucessos do roll de
// Insight + Alert do batedor. Não é regra oficial do livro — é a
// convenção descrita pelo usuário ("geralmente usamos os rolls... pra
// definir quantidade e raridade"); os controles no app ficam editáveis
// para a mesa ajustar o próprio critério.
export function suggestFromScoutRoll(successes: number): {
  quantity: number
  tier: LuckyTier
} {
  if (successes <= 1) return { quantity: 1, tier: 'unlucky' }
  if (successes <= 3) return { quantity: 2, tier: 'average' }
  if (successes === 4)
    return { quantity: 3, tier: 'lucky' }
  return { quantity: 4, tier: 'lucky' }
}

export const TIER_WEIGHT: Record<RarityTier, number> = {
  common: 3,
  uncommon: 2,
  rare: 1,
}
