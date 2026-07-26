// Avatares de Treinador em estilo "8-bit" (pixel art original, tipo card de
// treinador de um jogo retrô) — desenhados aqui como grade de retângulos SVG,
// não são sprites de nenhum jogo. Cada avatar é só uma string curta (o SVG
// gerado na hora), então não pesa nada no armazenamento local.
const CELL = 8

// "." = transparente. Duas silhuetas: uma de boné (C = boné, B = aba) e
// outra de cabelo solto (H nas linhas de cima no lugar do boné).
const CAP_ROWS = [
  '...CCCCCC...',
  '..CCCCCCCC..',
  '..CCCCCCCC..',
  '.BBBBBBBBBB.',
  '..HSSSSSSH..',
  '..HSSSSSSH..',
  '..SSESSESS..',
  '..SSSSSSSS..',
  '..SSSSSSSS..',
  '...SSSSSS...',
  '..TTTTTTTT..',
  '.TTTTTTTTTT.',
  'TTTTTTTTTTTT',
  'TTTTTTTTTTTT',
].map((r) => r.padEnd(12, '.'))

const HAIR_ROWS = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '.HHHHHHHHHH.',
  '..HSSSSSSH..',
  '..HSSSSSSH..',
  '..SSESSESS..',
  '..SSSSSSSS..',
  '..SSSSSSSS..',
  '...SSSSSS...',
  '..TTTTTTTT..',
  '.TTTTTTTTTT.',
  'TTTTTTTTTTTT',
  'TTTTTTTTTTTT',
  'TTTTTTTTTTTT',
].map((r) => r.padEnd(12, '.'))

const EYE = '#1e293b'

interface PixelPreset {
  id: string
  label: string
  shape: 'cap' | 'hair'
  skin: string
  top: string // cor do boné ou do cabelo
  shirt: string
}

const PRESETS: PixelPreset[] = [
  { id: 'cap-red', label: 'Boné vermelho', shape: 'cap', skin: '#f4c294', top: '#dc2626', shirt: '#2563eb' },
  { id: 'cap-blue', label: 'Boné azul', shape: 'cap', skin: '#c78a55', top: '#2563eb', shirt: '#f59e0b' },
  { id: 'cap-green', label: 'Boné verde', shape: 'cap', skin: '#8a5a34', top: '#16a34a', shirt: '#a855f7' },
  { id: 'cap-orange', label: 'Boné laranja', shape: 'cap', skin: '#f4c294', top: '#f59e0b', shirt: '#0f766e' },
  { id: 'cap-purple', label: 'Boné roxo', shape: 'cap', skin: '#c78a55', top: '#7c3aed', shirt: '#dc2626' },
  { id: 'hair-brown', label: 'Cabelo castanho', shape: 'hair', skin: '#f4c294', top: '#7a4a1f', shirt: '#dc2626' },
  { id: 'hair-black', label: 'Cabelo preto', shape: 'hair', skin: '#8a5a34', top: '#1c1c1c', shirt: '#2563eb' },
  { id: 'hair-red', label: 'Cabelo ruivo', shape: 'hair', skin: '#c78a55', top: '#e11d48', shirt: '#eab308' },
  { id: 'hair-blonde', label: 'Cabelo loiro', shape: 'hair', skin: '#f4c294', top: '#facc15', shirt: '#16a34a' },
  { id: 'hair-teal', label: 'Cabelo azul-petróleo', shape: 'hair', skin: '#8a5a34', top: '#0e7490', shirt: '#f97316' },
]

function svgFor(preset: PixelPreset): string {
  const rows = preset.shape === 'cap' ? CAP_ROWS : HAIR_ROWS
  const palette: Record<string, string> = {
    C: preset.top,
    B: preset.top,
    H: preset.top,
    S: preset.skin,
    E: EYE,
    T: preset.shirt,
  }
  const cols = rows[0].length
  const width = cols * CELL
  const height = rows.length * CELL
  let rects = ''
  rows.forEach((row, y) => {
    for (let x = 0; x < cols; x++) {
      const ch = row[x]
      const color = palette[ch]
      if (!color) continue
      rects += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${color}"/>`
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${rects}</svg>`
}

export interface PixelAvatarOption {
  id: string
  label: string
  uri: string
}

export const PIXEL_AVATARS: PixelAvatarOption[] = PRESETS.map((p) => ({
  id: p.id,
  label: p.label,
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(svgFor(p))}`,
}))

export const DEFAULT_PIXEL_AVATAR = PIXEL_AVATARS[0].uri
