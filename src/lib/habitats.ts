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
    common: ['Normal', 'Flying', 'Ground', 'Grass'],
    uncommon: ['Fighting', 'Rock', 'Dark', 'Electric'],
    rare: ['Fire', 'Fairy', 'Psychic'],
    official: true,
  },
  {
    id: 'forest',
    label: 'Florestas/Selva',
    icon: '🌳',
    common: ['Bug', 'Grass', 'Poison', 'Flying'],
    uncommon: ['Fighting', 'Electric', 'Normal', 'Rock'],
    rare: ['Ghost', 'Steel', 'Dark'],
    official: true,
  },
  {
    id: 'towns',
    label: 'Cidades/Vilas',
    icon: '🏘️',
    common: ['Normal', 'Electric', 'Poison', 'Fairy'],
    uncommon: ['Psychic', 'Steel', 'Dark'],
    rare: ['Ghost', 'Dragon'],
    official: false,
  },
  {
    id: 'lake',
    label: 'Lagos/Mares',
    icon: '🌊',
    common: ['Water', 'Normal'],
    uncommon: ['Ice', 'Electric', 'Bug'],
    rare: ['Dragon', 'Psychic'],
    official: false,
  },
  {
    id: 'riverside',
    label: 'Beira de Lagos/Rios',
    icon: '🏖️',
    common: ['Water', 'Normal', 'Bug'],
    uncommon: ['Ice', 'Electric', 'Flying'],
    rare: ['Dragon', 'Psychic', 'Rock'],
    official: false,
  },
  {
    id: 'caves',
    label: 'Cavernas/Montanhas',
    icon: '⛰️',
    common: ['Rock', 'Ground', 'Dark'],
    uncommon: ['Fighting', 'Steel', 'Poison'],
    rare: ['Dragon', 'Psychic', 'Ghost'],
    official: false,
  },
  {
    id: 'desert',
    label: 'Desertos',
    icon: '🏜️',
    common: ['Ground', 'Rock', 'Normal'],
    uncommon: ['Fire', 'Poison', 'Steel'],
    rare: ['Dragon', 'Dark', 'Psychic'],
    official: false,
  },
  {
    id: 'volcano',
    label: 'Vulcões',
    icon: '🌋',
    common: ['Fire', 'Rock', 'Ground'],
    uncommon: ['Dark', 'Poison', 'Steel'],
    rare: ['Dragon', 'Ghost'],
    official: false,
  },
  {
    id: 'arctic',
    label: 'Regiões Árticas',
    icon: '❄️',
    common: ['Ice', 'Water', 'Normal'],
    uncommon: ['Flying', 'Steel', 'Rock'],
    rare: ['Dragon', 'Psychic', 'Fairy'],
    official: false,
  },
  {
    id: 'ruins',
    label: 'Ruínas/Cemitérios',
    icon: '💀',
    common: ['Ghost', 'Psychic', 'Normal'],
    uncommon: ['Fighting', 'Steel', 'Dark'],
    rare: ['Dragon'],
    official: true,
  }
]

export type RarityTier = 'common' | 'uncommon' | 'rare'

// Sugestão de quantidade/raridade a partir dos sucessos do roll de
// Insight + Alert do batedor. Não é regra oficial do livro — é a
// convenção descrita pelo usuário ("geralmente usamos os rolls... pra
// definir quantidade e raridade"); os controles no app ficam editáveis
// para a mesa ajustar o próprio critério.
export function suggestFromScoutRoll(successes: number): {
  quantity: number
  tiers: RarityTier[]
} {
  if (successes <= 1) return { quantity: 1, tiers: ['common'] }
  if (successes <= 3) return { quantity: 2, tiers: ['common', 'uncommon'] }
  if (successes === 4)
    return { quantity: 3, tiers: ['common', 'uncommon', 'rare'] }
  return { quantity: 4, tiers: ['common', 'uncommon', 'rare'] }
}

export const TIER_WEIGHT: Record<RarityTier, number> = {
  common: 3,
  uncommon: 2,
  rare: 1,
}
