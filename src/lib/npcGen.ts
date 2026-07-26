import type { Attributes, Pokemon, PokemonSheet, Rank } from '../types'
import { RANKS, rankIndex } from '../types'
import { MOVES, NATURES, moveById } from '../data'

/**
 * Geração rápida de fichas de NPC (Pokémon selvagem / de ginásio) para o
 * Mestre. O Corebook não dá uma fórmula fixa de "atributos por Rank" para
 * Pokémon fora do Trainer — só diz que o Pokédex mostra os valores em
 * Starter e que o jogador soma pontos ao subir de Rank (p. 44). Aqui
 * interpolamos entre o inicial (Starter) e o máximo da espécie conforme o
 * Rank escolhido, como ponto de partida rápido para o Mestre ajustar à mão.
 */
function interpolateAttributes(species: Pokemon, rank: Rank): Attributes {
  const t = rankIndex(rank) / (RANKS.length - 1)
  const lerp = (base: number, max: number) =>
    Math.min(max, Math.max(base, Math.round(base + (max - base) * t)))
  return {
    strength: lerp(species.attributes.strength, species.maxAttributes.strength),
    dexterity: lerp(species.attributes.dexterity, species.maxAttributes.dexterity),
    vitality: lerp(species.attributes.vitality, species.maxAttributes.vitality),
    special: lerp(species.attributes.special, species.maxAttributes.special),
    insight: lerp(species.attributes.insight, species.maxAttributes.insight),
  }
}

function pickRandomAbility(species: Pokemon): string {
  const pool = [...species.abilities]
  // habilidade oculta é mais rara: só entra no sorteio 1 em 4 vezes
  if (species.hiddenAbility && Math.random() < 0.25) return species.hiddenAbility
  return pool[Math.floor(Math.random() * pool.length)] ?? ''
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickMovesForRank(species: Pokemon, rank: Rank, count: number): string[] {
  const maxIdx = rankIndex(rank)
  if (species.name === 'Mew') {
    return shuffle(MOVES.map((m) => m.id)).slice(0, count)
  }
  const available = species.learnset.filter((e) => rankIndex(e.rank) <= maxIdx)
  // prioriza golpes de rank mais alto (mais fortes), com sorteio dentro de cada rank
  const byRankDesc = [...available].sort(
    (a, b) => rankIndex(b.rank) - rankIndex(a.rank),
  )
  const grouped = new Map<number, typeof available>()
  for (const e of byRankDesc) {
    const key = rankIndex(e.rank)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  }
  const ordered = [...grouped.keys()]
    .sort((a, b) => b - a)
    .flatMap((k) => shuffle(grouped.get(k)!))

  const seen = new Set<string>()
  const result: string[] = []
  for (const e of ordered) {
    if (seen.has(e.moveId)) continue
    seen.add(e.moveId)
    result.push(e.moveId)
    if (result.length >= count) break
  }
  return result
}

// Estimativa simples de pontos de skill (não é regra oficial): cresce com o
// Rank, aplicada às skills de Accuracy dos golpes escolhidos.
function estimateSkills(knownMoves: string[], rank: Rank): Record<string, number> {
  const level = Math.min(5, 1 + Math.floor(rankIndex(rank) / 2))
  const skills: Record<string, number> = {}
  for (const moveId of knownMoves) {
    const skill = moveById.get(moveId)?.accuracy.skill
    if (skill) skills[skill] = level
  }
  return skills
}

export function generateNpcSheet(
  species: Pokemon,
  rank: Rank,
  npcKind: 'wild' | 'gym',
): PokemonSheet {
  const attributes = interpolateAttributes(species, rank)
  // Corebook 3.0 p. 114: golpes conhecidos = Insight + 3
  const knownMoves = pickMovesForRank(species, rank, attributes.insight + 3)
  const nature = NATURES[Math.floor(Math.random() * NATURES.length)]?.name ?? ''

  return {
    trainerId: 0,
    species: species.id,
    nickname: `${npcKind === 'wild' ? 'Selvagem' : 'Ginásio'} ${species.name}`,
    rank,
    nature,
    ability: pickRandomAbility(species),
    heldItem: '',
    attributes,
    social: { tough: 1, cool: 1, beauty: 1, cute: 1, clever: 1 },
    skills: estimateSkills(knownMoves, rank),
    knownMoves,
    currentHp: species.baseHp + attributes.vitality,
    statusConditions: [],
    inTeam: false,
    trainingPoints: 0,
    isNpc: true,
    npcKind,
    notes: `Gerado automaticamente pelo Mestre (${npcKind === 'wild' ? 'encontro selvagem' : 'Pokémon de ginásio'}). Atributos estimados por interpolação de Rank — ajuste à mão se quiser seguir à risca as regras da sua mesa.`,
  }
}
