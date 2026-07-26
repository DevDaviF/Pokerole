// Preço vem do catálogo como texto livre ("200", "Not for Sale"...).
export function parsePrice(price: string | undefined): number | null {
  if (!price) return null
  const n = Number(price.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
