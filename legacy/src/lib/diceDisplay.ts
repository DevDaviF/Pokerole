// Preferência de exibição dos dados no chat/rolador — só ícone (⚁⚄...),
// só número, ou os dois juntos. Fica local (cada jogador escolhe o seu).
const KEY = 'diceDisplay'
export type DiceDisplay = 'icons' | 'numbers' | 'both'

export function getDiceDisplay(): DiceDisplay {
  const v = localStorage.getItem(KEY)
  return v === 'numbers' || v === 'both' ? v : 'icons'
}

const EVENT = 'dice-display-changed'

export function setDiceDisplay(v: DiceDisplay): void {
  localStorage.setItem(KEY, v)
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function onDiceDisplayChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}
