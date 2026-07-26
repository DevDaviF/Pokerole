import breedingData from '../data/breeding.json'

export interface BreedingInfo {
  genderRate: number // -1 = sem gênero, 0-8 = oitavos de chance de ser fêmea
  eggGroups: string[]
}

const DATA = breedingData as Record<string, BreedingInfo>

// Dado de gênero/grupo de ovo não existe no Pokerole-Data (o sistema
// oficial da 3.0 não formaliza reprodução/breeding) — puxado à parte da
// PokeAPI só como referência de RP, já que os grupos de ovo e a razão de
// gênero seguem os jogos principais.
export function breedingInfoFor(speciesId: string): BreedingInfo | null {
  return DATA[speciesId] ?? null
}

const EGG_GROUP_LABELS: Record<string, string> = {
  monster: 'Monstro',
  water1: 'Água 1',
  water2: 'Água 2',
  water3: 'Água 3',
  bug: 'Inseto',
  flying: 'Voador',
  field: 'Campo',
  fairy: 'Fada',
  grass: 'Planta',
  plant: 'Planta',
  humanshape: 'Humanoide',
  mineral: 'Mineral',
  amorphous: 'Amorfo',
  ditto: 'Ditto',
  dragon: 'Dragão',
  'no-eggs': 'Sem ovos',
  ground: 'Terrestre',
  indeterminate: 'Indeterminado',
}

export function eggGroupLabel(group: string): string {
  return EGG_GROUP_LABELS[group] ?? group
}

export function genderLabel(genderRate: number): string {
  if (genderRate === -1) return 'Sem gênero'
  if (genderRate === 0) return '100% Macho'
  if (genderRate === 8) return '100% Fêmea'
  const femalePct = (genderRate / 8) * 100
  const malePct = 100 - femalePct
  return `♂ ${malePct}% · ♀ ${femalePct}%`
}
