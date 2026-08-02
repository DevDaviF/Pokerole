import { useState } from 'react'
import type { Trainer } from '../types'
import { sheetAttrValue } from './MoveRoll'
import { useMesa } from '../lib/mesa'
import { useScoutRolls, contributeScoutRoll } from '../lib/scoutRolls'
import { DEFAULT_AVATAR } from './ImagePicker'

export default function ScoutRollWidget({
  mesaId,
  myTrainer,
}: {
  mesaId: string
  myTrainer: Trainer | undefined
}) {
  const { rollShared, session } = useMesa()
  const row = useScoutRolls(mesaId)
  const [notice, setNotice] = useState('')

  const alreadyContributed = Boolean(
    session && row?.contributors.some((c) => c.userId === session.user.id),
  )

  const contribute = async () => {
    if (!myTrainer || !row || alreadyContributed) return
    const pool = Math.max(
      1,
      sheetAttrValue(myTrainer, 'Insight') + (myTrainer.skills['Alert'] ?? 0),
    )
    const r = await rollShared({
      pool,
      label: `${myTrainer.name} · Insight + Alert (batedor)`,
      icon: myTrainer.imageUrl || DEFAULT_AVATAR,
    })
    const applied = await contributeScoutRoll(mesaId, row, myTrainer.name, r.successes)
    if (!applied) setNotice('Você já contribuiu nesta rodada de batedores.')
  }

  if (!row) return null

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-cyan-600 px-4 py-2.5 text-white">
        <b>🔍 Batedores</b>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
          {row.total} sucessos somados
        </span>
        <button
          onClick={contribute}
          disabled={!myTrainer || alreadyContributed}
          title={
            !myTrainer
              ? 'Crie um Treinador para contribuir'
              : alreadyContributed
                ? 'Você já contribuiu nesta rodada'
                : `Rolar Insight + Alert de ${myTrainer.name}`
          }
          className="ml-auto rounded-full bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30 disabled:opacity-40"
        >
          {alreadyContributed ? '✓ Contribuiu' : '🎲 Contribuir'}
        </button>
      </div>
      {notice && (
        <p
          className="cursor-pointer px-4 pt-2 text-xs text-amber-600"
          onClick={() => setNotice('')}
        >
          {notice}
        </p>
      )}
      {row.contributors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3">
          {row.contributors.map((c, i) => (
            <span
              key={i}
              className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700"
            >
              {c.name}: {c.successes}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
