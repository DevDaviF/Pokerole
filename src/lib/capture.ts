import { useEffect, useRef, useState } from 'react'
import type { Rank } from '../types'
import { supabase } from './supabase'

export type CaptureBonusMode = 'dice' | 'flat'

// Modo de cálculo do bônus de captura, configurável por mesa (só o Mestre
// pode trocar — RLS de UPDATE em `mesas` exige is_mesa_gm). "dice" = os
// pontos de bônus viram dados extras na rolagem de Captura (padrão);
// "flat" = somam direto no total de sucessos, como um modificador.
export function useCaptureBonusMode(mesaId: string | null): CaptureBonusMode {
  const [mode, setMode] = useState<CaptureBonusMode>('dice')
  const instanceId = useRef(Math.random().toString(36).slice(2))

  useEffect(() => {
    if (!supabase || !mesaId) return
    let cancelled = false

    supabase
      .from('mesas')
      .select('capture_bonus_mode')
      .eq('id', mesaId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setMode((data.capture_bonus_mode as CaptureBonusMode) ?? 'dice')
      })

    const channel = supabase
      .channel(`mesa-settings-${mesaId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mesas',
          filter: `id=eq.${mesaId}`,
        },
        (payload) => {
          const row = payload.new as { capture_bonus_mode?: CaptureBonusMode }
          if (row.capture_bonus_mode) setMode(row.capture_bonus_mode)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId])

  return mode
}

export async function setCaptureBonusMode(mesaId: string, mode: CaptureBonusMode) {
  if (!supabase) return
  await supabase.from('mesas').update({ capture_bonus_mode: mode }).eq('id', mesaId)
}

// Captura de Pokémon selvagem (Corebook 3.0, p. 99-100 e 122).
// Sucessos necessários pelo Rank do Pokémon selvagem. Master/Champion não
// têm valor definido no livro — fica a critério do Mestre.
export const CAPTURE_REQUIRED_SUCCESSES: Partial<Record<Rank, number>> = {
  Starter: 3,
  Rookie: 4,
  Standard: 6,
  Advanced: 8,
  Expert: 9,
  Ace: 10,
}

export interface BallDef {
  id: string
  label: string
  hint: string
  // 'fixed' = potência fixa; 'guaranteed' = captura automática, sem rolar
  // (Master Ball); outras chaves precisam de dados extras (ver CaptureRoll)
  kind: 'fixed' | 'fast' | 'heavy' | 'quick' | 'dusk' | 'manual' | 'guaranteed'
  basePotency?: number
}

export const POKEBALLS: BallDef[] = [
  { id: 'pokeball', label: 'Poké Bola', hint: 'Selo de 4 dados', kind: 'fixed', basePotency: 4 },
  { id: 'greatball', label: 'Great Ball', hint: 'Selo de 6 dados', kind: 'fixed', basePotency: 6 },
  { id: 'ultraball', label: 'Ultra Ball', hint: 'Selo de 8 dados', kind: 'fixed', basePotency: 8 },
  { id: 'fast-ball', label: 'Fast Ball', hint: 'Selo = Destreza do alvo (máx. 9)', kind: 'fast' },
  { id: 'heavy-ball', label: 'Heavy Ball', hint: '+1 a cada 25kg do alvo (máx. 5)', kind: 'heavy' },
  { id: 'quick-ball', label: 'Quick Ball', hint: '9 dados na 1ª rodada, -2 por rodada seguinte', kind: 'quick' },
  { id: 'dusk-ball', label: 'Dusk Ball', hint: '+4 em caverna, +5 à noite (base manual)', kind: 'dusk' },
  { id: 'luxury-ball', label: 'Luxury Ball', hint: 'Potência não definida no livro — o Mestre define manualmente', kind: 'manual' },
  {
    id: 'masterball',
    label: 'Master Ball',
    hint: 'Captura garantida — sempre funciona, sem rolar dados. Única forma de capturar Pokémon acima do Rank Ace (Master/Champion).',
    kind: 'guaranteed',
  },
  { id: 'old-pokeball', label: 'Old Pokébola', hint: 'Potência não definida no livro — o Mestre define manualmente', kind: 'manual' },
]

// Rank sem valor de sucessos necessários no livro (Master/Champion, acima
// de Ace) só pode ser capturado com a Master Ball (captura garantida) — do
// contrário não haveria como saber quantos sucessos contam como sucesso.
export function canUseBall(ball: BallDef, rank: Rank): boolean {
  return ball.kind === 'guaranteed' || CAPTURE_REQUIRED_SUCCESSES[rank] !== undefined
}

export function parseWeightKg(weight: string): number {
  const m = weight.match(/[\d.]+/)
  return m ? Number(m[0]) : 0
}

// Sucessos extras (não são dados a mais, somam depois da rolagem de Selo).
// Se o alvo estiver com 0 HP (desmaiado), TODO bônus é perdido.
export function captureBonusSuccesses(currentHp: number, maxHp: number, statusCount: number) {
  if (currentHp <= 0) return { hpBonus: 0, statusBonus: 0, total: 0 }
  const hpBonus = currentHp === 1 ? 2 : currentHp <= Math.floor(maxHp / 2) ? 1 : 0
  const statusBonus = statusCount
  return { hpBonus, statusBonus, total: hpBonus + statusBonus }
}

export type CaptureOutcome = 'success' | 'escape' | 'critical-fail'

export function captureOutcome(totalSuccesses: number, required: number): CaptureOutcome {
  if (totalSuccesses >= required) return 'success'
  if (totalSuccesses <= required - 3) return 'critical-fail'
  return 'escape'
}
