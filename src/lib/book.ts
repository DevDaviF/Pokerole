// PDF do Corebook hospedado no Supabase Storage (bucket público "corebook"
// — ver migration-11-book-storage.sql). O upload do arquivo em si é
// manual, feito pelo Mestre no Dashboard do Supabase.
export const BOOK_BUCKET = 'corebook'
export const BOOK_PATH = 'pokerole-corebook-3.0.pdf'

export function bookPageUrl(page: number): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!base) return null
  return `${base}/storage/v1/object/public/${BOOK_BUCKET}/${BOOK_PATH}#page=${Math.max(1, Math.floor(page))}`
}

// Textos de golpes/habilidades/itens às vezes citam "p. 610" ou "p.114"
// pra indicar onde ver mais detalhes no livro — extrai o(s) número(s) de
// página pra virar link direto.
export function extractPageRefs(text: string): number[] {
  const matches = [...text.matchAll(/\bp\.?\s*(\d{1,4})\b/gi)]
  return [...new Set(matches.map((m) => Number(m[1])))]
}
