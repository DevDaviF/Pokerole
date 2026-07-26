import Dexie, { type EntityTable } from 'dexie'
import type { Trainer, PokemonSheet } from './types'

export const db = new Dexie('pokerole') as Dexie & {
  trainers: EntityTable<Trainer, 'id'>
  pokemonSheets: EntityTable<PokemonSheet, 'id'>
}

db.version(1).stores({
  trainers: '++id, name',
  pokemonSheets: '++id, trainerId, species, nickname',
})
