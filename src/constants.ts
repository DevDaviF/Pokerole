// Listas de referência do sistema, conferidas contra o Corebook 3.0:
// - Treinadores NÃO têm o atributo Special (p. 34: "Only Pokémon have the
//   Special Attribute"); HP humano = 4 + Vitality; Will = Insight + 3.
// - Sucesso nos dados: 4, 5 ou 6 (p. 35).
import type { SocialAttributeName } from './types'

export type AttributeKey =
  | 'strength'
  | 'dexterity'
  | 'vitality'
  | 'special'
  | 'insight'

export const POKEMON_ATTRIBUTE_LABELS: Array<{
  key: AttributeKey
  label: string
}> = [
  { key: 'strength', label: 'Strength' },
  { key: 'dexterity', label: 'Dexterity' },
  { key: 'vitality', label: 'Vitality' },
  { key: 'special', label: 'Special' },
  { key: 'insight', label: 'Insight' },
]

// Humanos não têm Special
export const TRAINER_ATTRIBUTE_LABELS = POKEMON_ATTRIBUTE_LABELS.filter(
  (a) => a.key !== 'special',
)

export const SOCIAL_LABELS: Array<{
  key: 'tough' | 'cool' | 'beauty' | 'cute' | 'clever'
  label: SocialAttributeName
}> = [
  { key: 'tough', label: 'Tough' },
  { key: 'cool', label: 'Cool' },
  { key: 'beauty', label: 'Beauty' },
  { key: 'clever', label: 'Clever' },
  { key: 'cute', label: 'Cute' },
]

// Skills de treinador (Corebook 3.0, p. 25-26; Channel/Clash são de Pokémon,
// Throw/Weapons são humanas)
export const TRAINER_SKILL_GROUPS: Array<{ group: string; skills: string[] }> = [
  { group: 'Batalha', skills: ['Brawl', 'Throw', 'Evasion', 'Weapons'] },
  { group: 'Sobrevivência', skills: ['Alert', 'Athletic', 'Nature', 'Stealth'] },
  {
    group: 'Social',
    skills: ['Charm', 'Empathy', 'Etiquette', 'Intimidate', 'Perform'],
  },
  {
    group: 'Conhecimento',
    skills: ['Crafts', 'Lore', 'Medicine', 'Science'],
  },
]

// Skills da ficha oficial de Pokémon (p. 45; sem Empathy nem Conhecimento)
export const POKEMON_SKILL_GROUPS: Array<{ group: string; skills: string[] }> = [
  { group: 'Batalha', skills: ['Brawl', 'Channel', 'Clash', 'Evasion'] },
  { group: 'Sobrevivência', skills: ['Alert', 'Athletic', 'Nature', 'Stealth'] },
  {
    group: 'Social',
    skills: ['Charm', 'Etiquette', 'Intimidate', 'Perform'],
  },
]

export const STATUS_CONDITIONS = [
  'Burn 1',
  'Burn 2',
  'Burn 3',
  'Paralysis',
  'Frozen',
  'Poison',
  'Badly Poisoned',
  'Sleep',
  'Flinch',
  'Confused',
  'Disabled',
  'Infatuated',
]
