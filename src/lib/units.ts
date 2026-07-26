// Altura/peso vêm do Pokédex só em métrico ("0.4 m" / "6 kg") — converte
// pro sistema imperial na hora, sem precisar re-importar os dados.
const UNIT_PREF_KEY = 'unitSystem'
export type UnitSystem = 'metric' | 'imperial'

export function getUnitPreference(): UnitSystem {
  return localStorage.getItem(UNIT_PREF_KEY) === 'imperial' ? 'imperial' : 'metric'
}

export function setUnitPreference(system: UnitSystem): void {
  localStorage.setItem(UNIT_PREF_KEY, system)
}

function parseMeters(height: string): number | null {
  const m = height.match(/([\d.]+)\s*m/)
  return m ? Number(m[1]) : null
}

function parseKg(weight: string): number | null {
  const m = weight.match(/([\d.]+)\s*kg/)
  return m ? Number(m[1]) : null
}

export function formatHeight(height: string, system: UnitSystem): string {
  if (system === 'metric') return height
  const meters = parseMeters(height)
  if (meters == null) return height
  const totalInches = meters * 39.3701
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches}"`
}

export function formatWeight(weight: string, system: UnitSystem): string {
  if (system === 'metric') return weight
  const kg = parseKg(weight)
  if (kg == null) return weight
  const lbs = kg * 2.20462
  return `${lbs % 1 === 0 ? lbs : lbs.toFixed(1)} lbs`
}
