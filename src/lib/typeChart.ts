// Tabela defensiva de tipos — a 3.0 usa os mesmos 18 tipos e as mesmas
// relações de fraqueza/resistência/imunidade da franquia principal
// (Corebook p.52-53 confirma "the Pokémon League recognizes 18 Types" e
// mostra o mesmo padrão de type chart, só a MATEMÁTICA do dano é que muda
// pro sistema de dados: não é multiplicador, é dado extra/a menos.
export interface TypeMatchup {
  weak: string[]
  resist: string[]
  immune: string[]
}

export const TYPE_CHART: Record<string, TypeMatchup> = {
  Normal: { weak: ['Fighting'], resist: [], immune: ['Ghost'] },
  Fire: {
    weak: ['Water', 'Ground', 'Rock'],
    resist: ['Fire', 'Grass', 'Ice', 'Bug', 'Steel', 'Fairy'],
    immune: [],
  },
  Water: {
    weak: ['Electric', 'Grass'],
    resist: ['Fire', 'Water', 'Ice', 'Steel'],
    immune: [],
  },
  Electric: { weak: ['Ground'], resist: ['Electric', 'Flying', 'Steel'], immune: [] },
  Grass: {
    weak: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
    resist: ['Water', 'Electric', 'Grass', 'Ground'],
    immune: [],
  },
  Ice: { weak: ['Fire', 'Fighting', 'Rock', 'Steel'], resist: ['Ice'], immune: [] },
  Fighting: {
    weak: ['Flying', 'Psychic', 'Fairy'],
    resist: ['Bug', 'Rock', 'Dark'],
    immune: [],
  },
  Poison: {
    weak: ['Ground', 'Psychic'],
    resist: ['Grass', 'Fighting', 'Poison', 'Bug', 'Fairy'],
    immune: [],
  },
  Ground: {
    weak: ['Water', 'Grass', 'Ice'],
    resist: ['Poison', 'Rock'],
    immune: ['Electric'],
  },
  Flying: {
    weak: ['Electric', 'Ice', 'Rock'],
    resist: ['Grass', 'Fighting', 'Bug'],
    immune: ['Ground'],
  },
  Psychic: { weak: ['Bug', 'Ghost', 'Dark'], resist: ['Fighting', 'Psychic'], immune: [] },
  Bug: {
    weak: ['Fire', 'Flying', 'Rock'],
    resist: ['Grass', 'Fighting', 'Ground'],
    immune: [],
  },
  Rock: {
    weak: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
    resist: ['Normal', 'Fire', 'Poison', 'Flying'],
    immune: [],
  },
  Ghost: { weak: ['Ghost', 'Dark'], resist: ['Poison', 'Bug'], immune: ['Normal', 'Fighting'] },
  Dragon: {
    weak: ['Ice', 'Dragon', 'Fairy'],
    resist: ['Fire', 'Water', 'Electric', 'Grass'],
    immune: [],
  },
  Dark: { weak: ['Fighting', 'Bug', 'Fairy'], resist: ['Ghost', 'Dark'], immune: ['Psychic'] },
  Steel: {
    weak: ['Fire', 'Fighting', 'Ground'],
    resist: [
      'Normal',
      'Grass',
      'Ice',
      'Flying',
      'Psychic',
      'Bug',
      'Rock',
      'Dragon',
      'Steel',
      'Fairy',
    ],
    immune: ['Poison'],
  },
  Fairy: { weak: ['Poison', 'Steel'], resist: ['Fighting', 'Bug', 'Dark'], immune: ['Dragon'] },
}

export const ALL_TYPES = Object.keys(TYPE_CHART)

// Modificador de dado pra um Pokémon (1 ou 2 tipos) recebendo uma Move de
// um certo tipo (Corebook p.52): Super-Efetivo +1, Não-Muito-Efetivo -1,
// Extremamente-Efetivo (dual, os 2 fracos) +2, Pouco-Efetivo (dual, os 2
// resistem) -2, Imunidade = sem dano de Physical/Special (Support ainda
// afeta). Quando um tipo é fraco e o outro resiste, os dois se cancelam
// (RAW só descreve os casos "os dois iguais").
export function damageModifier(
  defenderTypes: string[],
  attackType: string,
): { modifier: number; immune: boolean } {
  const immune = defenderTypes.some((t) => TYPE_CHART[t]?.immune.includes(attackType))
  if (immune) return { modifier: 0, immune: true }
  let modifier = 0
  for (const t of defenderTypes) {
    if (TYPE_CHART[t]?.weak.includes(attackType)) modifier += 1
    if (TYPE_CHART[t]?.resist.includes(attackType)) modifier -= 1
  }
  return { modifier, immune: false }
}

// Do ponto de vista do ATAQUE: contra quais tipos (1 só, não dual) esse
// tipo de golpe é super/pouco efetivo ou não tem efeito. Útil pra ver
// "vantagem de tipo" antes de escolher um golpe.
export function attackEffectivenessAgainstSingleTypes(attackType: string): {
  superEffective: string[]
  notVeryEffective: string[]
  noEffect: string[]
} {
  const superEffective: string[] = []
  const notVeryEffective: string[] = []
  const noEffect: string[] = []
  for (const defenderType of ALL_TYPES) {
    const { modifier, immune } = damageModifier([defenderType], attackType)
    if (immune) noEffect.push(defenderType)
    else if (modifier > 0) superEffective.push(defenderType)
    else if (modifier < 0) notVeryEffective.push(defenderType)
  }
  return { superEffective, notVeryEffective, noEffect }
}

// Fraquezas/resistências/imunidades EFETIVAS de um Pokémon (1 ou 2 tipos)
// contra cada um dos 18 tipos de ataque — já considerando cancelamento e
// os casos dual "extremo"/"pouco efetivo".
export function typeMatchupsFor(defenderTypes: string[]): {
  weak: string[]
  resist: string[]
  immune: string[]
  doubleWeak: string[]
  doubleResist: string[]
} {
  const weak: string[] = []
  const resist: string[] = []
  const immune: string[] = []
  const doubleWeak: string[] = []
  const doubleResist: string[] = []
  for (const attackType of ALL_TYPES) {
    const { modifier, immune: isImmune } = damageModifier(defenderTypes, attackType)
    if (isImmune) immune.push(attackType)
    else if (modifier >= 2) doubleWeak.push(attackType)
    else if (modifier === 1) weak.push(attackType)
    else if (modifier === -1) resist.push(attackType)
    else if (modifier <= -2) doubleResist.push(attackType)
  }
  return { weak, resist, immune, doubleWeak, doubleResist }
}
