import Dexie, { type EntityTable } from 'dexie'
import type { Trainer, PokemonSheet } from './types'

type PokeroleDb = Dexie & {
  trainers: EntityTable<Trainer, 'id'>
  pokemonSheets: EntityTable<PokemonSheet, 'id'>
}

function openDb(name: string): PokeroleDb {
  const instance = new Dexie(name) as PokeroleDb
  instance.version(1).stores({
    trainers: '++id, name',
    pokemonSheets: '++id, trainerId, species, nickname',
  })
  // v2: fichas de Pokémon não têm mais imagem própria (usam só o sprite
  // da espécie) — limpa o campo de quem já tinha uma foto salva, pra não
  // carregar base64 morto no IndexedDB pra sempre.
  instance
    .version(2)
    .stores({
      trainers: '++id, name',
      pokemonSheets: '++id, trainerId, species, nickname',
    })
    .upgrade(async (tx) => {
      await tx
        .table('pokemonSheets')
        .toCollection()
        .modify((sheet: { imageUrl?: string }) => {
          delete sheet.imageUrl
        })
    })
  // v3: a lista de texto livre "Itens (um por linha)" do Treinador foi
  // substituída pelo inventário estruturado da Loja — limpa o campo
  // morto de quem ainda tinha isso salvo.
  instance
    .version(3)
    .stores({
      trainers: '++id, name',
      pokemonSheets: '++id, trainerId, species, nickname',
    })
    .upgrade(async (tx) => {
      await tx
        .table('trainers')
        .toCollection()
        .modify((trainer: { items?: string[] }) => {
          delete trainer.items
        })
    })
  return instance
}

const DB_SCOPE_KEY = 'dbScope'

function dbNameForScope(scope: string | null): string {
  if (!scope || scope === 'guest') return 'pokerole'
  return `pokerole-${scope}`
}

const dbName = dbNameForScope(localStorage.getItem(DB_SCOPE_KEY))

// Fichas de Treinador/Pokémon moram no IndexedDB do navegador, que é por
// ORIGEM — não por conta. Sem isolamento, uma conta nova no mesmo
// navegador via a app veria (e podia até misturar) os dados de quem usou
// antes. Ver syncDbScope: cada conta ganha seu próprio banco.
export const db = openDb(dbName)

// Chamado pelo MesaProvider sempre que a sessão do Supabase é resolvida
// (login, logout, troca de conta). Na primeira vez que rodar (nenhum dono
// decidido ainda), o banco legado 'pokerole' é adotado por quem estiver
// logado nesse instante — cópia única pro banco da conta, sem apagar o
// original, sem interromper a aba atual. Numa troca de verdade depois
// disso, recarrega a página pra abrir o banco certo do zero.
export async function syncDbScope(scope: string): Promise<void> {
  const stored = localStorage.getItem(DB_SCOPE_KEY)
  if (stored === scope) return

  if (stored === null) {
    localStorage.setItem(DB_SCOPE_KEY, scope)
    const targetName = dbNameForScope(scope)
    if (targetName === dbName) return
    try {
      const [trainers, sheets] = await Promise.all([
        db.trainers.toArray(),
        db.pokemonSheets.toArray(),
      ])
      if (trainers.length === 0 && sheets.length === 0) return
      const target = openDb(targetName)
      const [existingTrainers, existingSheets] = await Promise.all([
        target.trainers.count(),
        target.pokemonSheets.count(),
      ])
      if (existingTrainers === 0 && trainers.length > 0) {
        await target.trainers.bulkAdd(trainers)
      }
      if (existingSheets === 0 && sheets.length > 0) {
        await target.pokemonSheets.bulkAdd(sheets)
      }
      target.close()
    } catch (err) {
      console.error('Não deu para migrar os dados locais pra conta:', err)
    }
    return
  }

  localStorage.setItem(DB_SCOPE_KEY, scope)
  window.location.reload()
}
