/**
 * Importa os dados do repositório Pokerole-Data (pasta v3.0) e gera os
 * JSONs normalizados que o app consome em src/data/.
 *
 * Uso:
 *   node scripts/import-data.ts <caminho-para-Pokerole-Data>
 *
 * Ex.:
 *   node scripts/import-data.ts ../Pokerole-Data
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

interface RawMove {
  Name: string
  Type: string
  Power: number | string
  Damage1: string
  Damage2: string
  Accuracy1: string
  Accuracy2: string
  Target: string
  Effect: string
  Description: string
  _id: string
  Category: string
}

interface RawPokemon {
  Number: number
  DexID: string
  Name: string
  Type1: string
  Type2: string
  BaseHP: number
  Strength: number
  MaxStrength: number
  Dexterity: number
  MaxDexterity: number
  Vitality: number
  MaxVitality: number
  Special: number
  MaxSpecial: number
  Insight: number
  MaxInsight: number
  Ability1: string
  Ability2: string
  HiddenAbility: string
  RecommendedRank: string
  Legendary: boolean
  GoodStarter: boolean
  _id: string
  DexCategory: string
  Height: { Meters: number; Feet: number }
  Weight: { Kilograms: number; Pounds: number }
  DexDescription: string
  Evolutions: Array<Record<string, unknown>>
  Moves: Array<{ Learned: string; Name: string }>
}

const sourceArg = process.argv[2]
if (!sourceArg) {
  console.error('Uso: node scripts/import-data.ts <caminho-para-Pokerole-Data>')
  process.exit(1)
}
const SRC = path.resolve(sourceArg, 'v3.0')
const OUT = path.resolve(import.meta.dirname, '..', 'src', 'data')
fs.mkdirSync(OUT, { recursive: true })

const warnings: string[] = []

function readDir<T>(dir: string): T[] {
  return fs
    .readdirSync(path.join(SRC, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(SRC, dir, f), 'utf8')
      return { ...JSON.parse(raw), __file: f } as T
    })
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// ── Moves ────────────────────────────────────────────────────────────

const rawMoves = readDir<RawMove & { __file: string }>('Moves')
const moves = rawMoves
  .map((m) => {
    const numericPower = typeof m.Power === 'number' ? m.Power : null
    const name = m.Name.trim()
    return {
      id: slug(name),
      name,
      type: m.Type,
      category: m.Category,
      power: numericPower,
      ...(typeof m.Power === 'string' && m.Power !== ''
        ? { powerLabel: m.Power }
        : {}),
      accuracy: { attribute: m.Accuracy1, skill: m.Accuracy2 },
      damagePool: m.Damage1
        ? {
            attribute: m.Damage1,
            bonus: numericPower ?? 0,
            ...(m.Damage2 ? { attribute2: m.Damage2 } : {}),
          }
        : null,
      target: m.Target,
      addedEffect: m.Effect,
      flavorText: m.Description,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const moveIdByName = new Map(
  moves.map((m) => [m.name.trim().toLowerCase(), m.id]),
)

// ── Pokedex ──────────────────────────────────────────────────────────

const rawDex = readDir<RawPokemon & { __file: string }>('Pokedex')
const seenIds = new Set<string>()

const pokedex = rawDex
  .map((p) => {
    // o nome do arquivo é único no repo (o _id tem duplicatas, ex: Tauros)
    const id = slug(p.__file.replace(/\.json$/, ''))
    if (seenIds.has(id)) warnings.push(`id duplicado: "${id}" (${p.__file})`)
    seenIds.add(id)

    const learnset = p.Moves.map((entry) => {
      const moveId = moveIdByName.get(entry.Name.trim().toLowerCase())
      if (!moveId) {
        warnings.push(`${p.Name}: golpe não encontrado no Movedex: "${entry.Name}"`)
        return null
      }
      return { rank: entry.Learned, moveId }
    }).filter((e): e is { rank: string; moveId: string } => e !== null)

    const evolutions = (p.Evolutions ?? []).map((ev) => {
      const direction = ev.From ? 'from' : 'to'
      const name = String(ev.From ?? ev.To ?? '')
      const kind = String(ev.Kind ?? '')
      const detail = Object.entries(ev)
        .filter(([k]) => !['From', 'To', 'Kind'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      return { direction, name, kind, detail }
    })

    return {
      id,
      dexNumber: p.DexID,
      name: p.Name,
      types: [p.Type1, p.Type2].filter(Boolean),
      baseHp: p.BaseHP,
      suggestedRank: p.RecommendedRank,
      attributes: {
        strength: p.Strength,
        dexterity: p.Dexterity,
        vitality: p.Vitality,
        special: p.Special,
        insight: p.Insight,
      },
      maxAttributes: {
        strength: p.MaxStrength,
        dexterity: p.MaxDexterity,
        vitality: p.MaxVitality,
        special: p.MaxSpecial,
        insight: p.MaxInsight,
      },
      height: `${p.Height?.Meters ?? '?'} m`,
      weight: `${p.Weight?.Kilograms ?? '?'} kg`,
      abilities: [p.Ability1, p.Ability2].filter(Boolean),
      ...(p.HiddenAbility ? { hiddenAbility: p.HiddenAbility } : {}),
      dexCategory: p.DexCategory,
      dexDescription: p.DexDescription,
      legendary: p.Legendary,
      goodStarter: p.GoodStarter,
      evolutions,
      learnset,
    }
  })
  .sort((a, b) => a.dexNumber.localeCompare(b.dexNumber) || a.name.localeCompare(b.name))

// ── Abilities / Natures / Items ──────────────────────────────────────

interface RawSimple {
  Name: string
  _id: string
  __file: string
  [k: string]: unknown
}

const abilities = readDir<RawSimple>('Abilities')
  .map((a) => ({
    id: a._id || slug(a.Name),
    name: a.Name,
    effect: String(a.Effect ?? ''),
    description: String(a.Description ?? ''),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const natures = readDir<RawSimple>('Natures')
  .map((n) => ({
    id: n._id || slug(n.Name),
    name: n.Name,
    confidence: Number(n.Confidence ?? 0),
    keywords: String(n.Keywords ?? ''),
    description: String(n.Description ?? ''),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const items = readDir<RawSimple>('Items')
  .map((i) => ({
    id: i._id || slug(i.Name),
    name: i.Name,
    pocket: String(i.Pocket ?? ''),
    category: String(i.Category ?? ''),
    description: String(i.Description ?? ''),
    ...(i.TrainerPrice ? { price: String(i.TrainerPrice) } : {}),
    ...(i.OneUse !== undefined ? { oneUse: Boolean(i.OneUse) } : {}),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

// ── Escrita ──────────────────────────────────────────────────────────

const write = (file: string, data: unknown[]) => {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 1))
  console.log(`${file}: ${data.length} registros`)
}

write('moves.json', moves)
write('pokedex.json', pokedex)
write('abilities.json', abilities)
write('natures.json', natures)
write('items.json', items)

if (warnings.length) {
  console.log(`\n${warnings.length} avisos:`)
  for (const w of [...new Set(warnings)]) console.log(`  - ${w}`)
}
