import type { Attributes, Pokemon, PokemonSheet, Rank } from '../types'
import { MOVES, NATURES, moveById } from '../data'
import { rankIndex } from '../types'
import { rankAttributePoints, rankSkillPoints, rankSkillLimit, RANK_POINT_ATTRIBUTES } from './progression'
import { POKEMON_SKILL_GROUPS } from '../constants'

const ALL_POKEMON_SKILLS = POKEMON_SKILL_GROUPS.flatMap((g) => g.skills)

/**
 * Atributos de Pokémon selvagem = base da espécie (referência oficial do
 * livro, sem alteração) + os mesmos pontos de atributo por Rank que
 * qualquer Pokémon ganha (ver progression.ts), distribuídos aleatoriamente
 * entre os 5 Attributes (Strength/Dexterity/Vitality/Special/Insight — p.22
 * e p.112 confirmam que Special entra no mesmo pool). Não é um bônus
 * especial de "selvagem": são pontos comuns, então totalmente
 * re-treináveis depois da captura.
 */
function randomizeAttributes(species: Pokemon, rank: Rank): Attributes {
  const attrs: Attributes = { ...species.attributes }
  let points = rankAttributePoints(rank)
  // pontos distribuídos um de cada vez em atributos sorteados; se um
  // atributo bate no máximo da espécie, os pontos restantes vão pros outros
  let guard = points * 20 // evita loop infinito se todos os atributos baterem no teto
  while (points > 0 && guard-- > 0) {
    const key = RANK_POINT_ATTRIBUTES[Math.floor(Math.random() * RANK_POINT_ATTRIBUTES.length)]
    if (attrs[key] >= species.maxAttributes[key]) continue
    attrs[key] += 1
    points--
  }
  return attrs
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

// Gasta o orçamento REAL de Skill Points do Rank (mesmo rankSkillPoints
// que um Pokémon jogável tem, respeitando o limite por skill do Rank) —
// antes só marcava a skill de Acerto de cada golpe conhecido com um
// "nível" fixo, o que raramente chegava perto de gastar o total (um NPC
// Standard com 17 pontos disponíveis podia acabar usando só 4, um pra
// cada golpe único). Prioriza as skills de Acerto dos golpes conhecidos
// (é o que o NPC realmente rola), e só depois espalha o resto do
// orçamento pelas demais skills, igual um jogador faria sobrando pontos.
function estimateSkills(knownMoves: string[], rank: Rank): Record<string, number> {
  const limit = rankSkillLimit(rank)
  let points = rankSkillPoints(rank)
  const skills: Record<string, number> = {}

  const priority = shuffle([
    ...new Set(
      knownMoves
        .map((id) => moveById.get(id)?.accuracy.skill)
        .filter((s): s is string => Boolean(s)),
    ),
  ])

  let guard = points * 20
  while (points > 0 && guard-- > 0) {
    const candidates = priority.filter((s) => (skills[s] ?? 0) < limit)
    if (candidates.length === 0) break
    const key = candidates[Math.floor(Math.random() * candidates.length)]
    skills[key] = (skills[key] ?? 0) + 1
    points--
  }

  const rest = shuffle(ALL_POKEMON_SKILLS.filter((s) => !priority.includes(s)))
  guard = points * 20
  while (points > 0 && guard-- > 0) {
    const candidates = rest.filter((s) => (skills[s] ?? 0) < limit)
    if (candidates.length === 0) break
    const key = candidates[Math.floor(Math.random() * candidates.length)]
    skills[key] = (skills[key] ?? 0) + 1
    points--
  }

  return skills
}

export function generateNpcSheet(
  species: Pokemon,
  rank: Rank,
  npcKind: 'wild' | 'gym',
  mesaId: string,
  opts?: { trainerId?: number },
): PokemonSheet {
  const attributes = randomizeAttributes(species, rank)
  // Corebook 3.0 p. 114: golpes conhecidos = Insight + 3
  const knownMoves = pickMovesForRank(species, rank, attributes.insight + 3)
  const nature = NATURES[Math.floor(Math.random() * NATURES.length)]?.name ?? ''

  return {
    trainerId: opts?.trainerId ?? 0,
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
    happiness: 2, // "In the wild, Pokémon usually have 2 points on each" (p.28)
    loyalty: 2,
    isNpc: true,
    npcKind,
    mesaId,
    notes: `Gerado automaticamente pelo Mestre (${npcKind === 'wild' ? 'encontro selvagem' : 'Pokémon de ginásio'}). Atributos = base da espécie + pontos de Rank distribuídos aleatoriamente (mesma regra de qualquer Pokémon, totalmente re-treinável).`,
  }
}
