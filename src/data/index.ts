import type { Move, Pokemon, Ability, Nature, Item } from '../types'
import movesJson from './moves.json'
import pokedexJson from './pokedex.json'
import abilitiesJson from './abilities.json'
import naturesJson from './natures.json'
import itemsJson from './items.json'

export const MOVES = movesJson as Move[]
export const POKEDEX = pokedexJson as Pokemon[]
export const ABILITIES = abilitiesJson as Ability[]
export const NATURES = naturesJson as Nature[]
export const ITEMS = itemsJson as Item[]

export const moveById = new Map(MOVES.map((m) => [m.id, m]))
export const pokemonById = new Map(POKEDEX.map((p) => [p.id, p]))
export const abilityByName = new Map(ABILITIES.map((a) => [a.name, a]))
export const itemById = new Map(ITEMS.map((i) => [i.id, i]))
export const itemByName = new Map(ITEMS.map((i) => [i.name, i]))

export const POKEMON_TYPES = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
] as const

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a878',
  Fire: '#f08030',
  Water: '#6890f0',
  Electric: '#e0b020',
  Grass: '#78c850',
  Ice: '#58c8c8',
  Fighting: '#c03028',
  Poison: '#a040a0',
  Ground: '#d8a848',
  Flying: '#a890f0',
  Psychic: '#f85888',
  Bug: '#a8b820',
  Rock: '#b8a038',
  Ghost: '#705898',
  Dragon: '#7038f8',
  Dark: '#705848',
  Steel: '#9090a8',
  Fairy: '#e878a0',
  Typeless: '#68a090',
  Varies: '#68a090',
}

export const typeColor = (type: string) => TYPE_COLORS[type] ?? '#68a090'

// Alguns golpes (Z-Moves, Max Moves, Copycat) têm Accuracy/Damage Pool que
// os dados de origem marcam como "SameAsBaseMove"/"SameAsBasePower"/
// "SameAsCopiedMove" — texto interno, não pra mostrar cru. Z-Moves usam
// powerLabel (ex: "Happiness + Loyalty") pros três campos igual; os outros
// ganham um texto amigável explicando que depende do golpe base/copiado.
const SAME_AS_FALLBACK: Record<string, string> = {
  SameAsBaseMove: 'Mesmo do golpe base',
  SameAsBasePower: 'Mesmo do golpe base',
  SameAsCopiedMove: 'Mesmo do golpe copiado',
}

function resolveSameAs(value: string, powerLabel?: string): string | null {
  if (!(value in SAME_AS_FALLBACK)) return null
  return powerLabel ?? SAME_AS_FALLBACK[value]
}

export function moveAccuracyLabel(move: {
  accuracy: { attribute: string; skill: string }
  powerLabel?: string
}): string {
  const resolved = resolveSameAs(move.accuracy.attribute, move.powerLabel)
  if (resolved) return resolved
  return move.accuracy.skill
    ? `${move.accuracy.attribute} + ${move.accuracy.skill}`
    : move.accuracy.attribute
}

export function moveDamageLabel(move: {
  damagePool: { attribute: string; bonus: number; attribute2?: string } | null
  powerLabel?: string
}): string {
  if (!move.damagePool) return '—'
  const resolved = resolveSameAs(move.damagePool.attribute, move.powerLabel)
  if (resolved) return resolved
  return (
    `${move.damagePool.attribute} + ${move.damagePool.bonus}` +
    (move.damagePool.attribute2 ? ` + ${move.damagePool.attribute2}` : '')
  )
}

// Nomes de arquivo do BookSprites que não seguem o mesmo slug do nosso id
// (apóstrofo removido em vez de virar hífen, grafias alternativas etc.)
const SPRITE_ALIASES: Record<string, string> = {
  'farfetch-d': 'farfetchd',
  'farfetch-d-galarian-form': 'farfetchd-galarian-form',
  'lilligant-hisiuan-form': 'lilligant-hisuian-form',
  'oricorio-pa-u-form': 'oricorio-pau-form',
  'sirfetch-d': 'sirfetchd',
}

export const spriteUrl = (pokemonId: string) =>
  `/sprites/${SPRITE_ALIASES[pokemonId] ?? pokemonId}.png`
