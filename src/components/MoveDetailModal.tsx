import { useState } from 'react'
import type { Move } from '../types'
import { typeColor, moveAccuracyLabel, moveDamageLabel } from '../data'
import { attackEffectivenessAgainstSingleTypes } from '../lib/typeChart'
import { useMesa } from '../lib/mesa'
import { supabase } from '../lib/supabase'
import TypeBadge from './TypeBadge'

const CATEGORY_STYLES: Record<string, string> = {
  Physical: 'bg-orange-100 text-orange-800',
  Special: 'bg-indigo-100 text-indigo-800',
  Support: 'bg-emerald-100 text-emerald-800',
}

export function CategoryBadge({ category }: { category: string }) {
  const base = category.split('/')[0]
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
        CATEGORY_STYLES[base] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {category}
    </span>
  )
}

export default function MoveDetailModal({
  move,
  onClose,
}: {
  move: Move | null
  onClose: () => void
}) {
  const { session, activeMesa } = useMesa()
  const [sent, setSent] = useState(false)

  if (!move) return null

  const sendToChat = async () => {
    if (!supabase || !session || !activeMesa || !move) return
    const parts = [`📖 ${move.name} (${move.type})`]
    if (move.addedEffect) parts.push(move.addedEffect)
    await supabase.from('messages').insert({
      mesa_id: activeMesa.id,
      user_id: session.user.id,
      kind: 'chat',
      content: parts.join(' — '),
    })
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  const { superEffective, notVeryEffective, noEffect } =
    attackEffectivenessAgainstSingleTypes(move.type)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-t-xl px-5 py-4 text-white"
          style={{ backgroundColor: typeColor(move.type) }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{move.name}</h2>
            <button
              onClick={onClose}
              className="rounded-full px-2 text-2xl leading-none text-white/80 hover:text-white"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={move.type} />
              <CategoryBadge category={move.category} />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Alvo: {move.target || '—'}
              </span>
            </div>
            {activeMesa && session && (
              <button
                onClick={sendToChat}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {sent ? '✓ Enviado!' : '📤 Mandar pro chat'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500 uppercase">
                Power
              </div>
              <div className="text-lg font-bold text-slate-800">
                {move.powerLabel ?? move.power ?? '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500 uppercase">
                Accuracy
              </div>
              <div className="text-sm font-bold text-slate-800">
                {moveAccuracyLabel(move)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500 uppercase">
                Damage Pool
              </div>
              <div className="text-sm font-bold text-slate-800">
                {moveDamageLabel(move)}
              </div>
            </div>
          </div>

          {move.powerLabel && move.category.split('/').length > 1 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚡ Z-Move: a categoria (e o dano) seguem o golpe base usado
              pra ativá-lo — por isso aparece com as três categorias.
            </p>
          )}

          {(move.category.includes('Physical') || move.category.includes('Special')) && (
            <div className="space-y-1.5 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-500 uppercase">
                Vantagem de tipo (contra Pokémon de 1 tipo só)
              </p>
              <div className="flex flex-wrap gap-1">
                {superEffective.map((t) => (
                  <span key={t} className="flex items-center gap-1">
                    <TypeBadge type={t} size="sm" />
                  </span>
                ))}
                {superEffective.length === 0 && (
                  <span className="text-xs text-slate-400">
                    Nenhum tipo puro fraco a {move.type}.
                  </span>
                )}
              </div>
              {(notVeryEffective.length > 0 || noEffect.length > 0) && (
                <p className="text-[11px] text-slate-400">
                  Resiste: {notVeryEffective.join(', ') || '—'}
                  {noEffect.length > 0 && ` · Imune: ${noEffect.join(', ')}`}
                </p>
              )}
            </div>
          )}

          {move.addedEffect && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">
                Efeito
              </h3>
              <p className="text-sm text-slate-600">{move.addedEffect}</p>
            </div>
          )}

          {move.flavorText && (
            <p className="border-t border-slate-100 pt-3 text-sm text-slate-400 italic">
              {move.flavorText}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
