// PDF do Corebook hospedado no Supabase Storage (bucket público "corebook"
// — ver migration-11-book-storage.sql). Dividido em partes porque o plano
// free do Supabase Storage limita upload a 50MB por arquivo (o PDF
// original tem ~172MB) — cada parte fica bem abaixo disso, e o
// visualizador só carrega UMA parte por vez (a que contém a página
// pedida), nunca o livro inteiro.
export const BOOK_BUCKET = 'corebook'

export interface BookPart {
  file: string
  startPage: number
  endPage: number
}

// Gerado a partir do PDF original (641 páginas) — ver script de split.
export const BOOK_PARTS: BookPart[] = [
  { file: 'pokerole-corebook-3.0-part1.pdf', startPage: 1, endPage: 107 },
  { file: 'pokerole-corebook-3.0-part2.pdf', startPage: 108, endPage: 214 },
  { file: 'pokerole-corebook-3.0-part3.pdf', startPage: 215, endPage: 321 },
  { file: 'pokerole-corebook-3.0-part4.pdf', startPage: 322, endPage: 428 },
  { file: 'pokerole-corebook-3.0-part5.pdf', startPage: 429, endPage: 535 },
  { file: 'pokerole-corebook-3.0-part6.pdf', startPage: 536, endPage: 641 },
]

export function findBookPart(page: number): BookPart {
  return (
    BOOK_PARTS.find((p) => page >= p.startPage && page <= p.endPage) ??
    BOOK_PARTS[BOOK_PARTS.length - 1]
  )
}

export function bookPageUrl(page: number): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!base) return null
  const clamped = Math.max(1, Math.floor(page))
  const part = findBookPart(clamped)
  const relativePage = clamped - part.startPage + 1
  return `${base}/storage/v1/object/public/${BOOK_BUCKET}/${part.file}#page=${relativePage}`
}

// Textos de golpes/habilidades/itens às vezes citam "p. 610" ou "p.114"
// pra indicar onde ver mais detalhes no livro — extrai o(s) número(s) de
// página pra virar link direto.
export function extractPageRefs(text: string): number[] {
  const matches = [...text.matchAll(/\bp\.?\s*(\d{1,4})\b/gi)]
  return [...new Set(matches.map((m) => Number(m[1])))]
}
