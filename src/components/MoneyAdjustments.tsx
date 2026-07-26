import { useEffect, useRef } from 'react'
import type { Trainer } from '../types'
import { db } from '../db'
import { useMoneyAdjustments, deleteMoneyAdjustment } from '../lib/moneyAdjustments'

// Ajustes de dinheiro que o Mestre mandou pra mim — é uma correção
// autoritativa (não um presente), então aplica sozinho no Treinador
// ativo assim que chega e só avisa.
export default function MoneyAdjustments({
  mesaId,
  myId,
  myTrainer,
  usernames,
  onApplied,
}: {
  mesaId: string
  myId: string
  myTrainer: Trainer | undefined
  usernames: Record<string, string>
  onApplied: (message: string) => void
}) {
  const adjustments = useMoneyAdjustments(mesaId, myId)
  const applying = useRef(new Set<string>())

  useEffect(() => {
    if (!myTrainer?.id) return
    for (const a of adjustments) {
      if (applying.current.has(a.id)) continue
      applying.current.add(a.id)
      ;(async () => {
        const nextMoney = Math.max(0, (myTrainer.money ?? 0) + a.amount)
        await db.trainers.update(myTrainer.id!, { money: nextMoney })
        await deleteMoneyAdjustment(a.id)
        onApplied(
          a.amount > 0
            ? `💰 O Mestre te deu ${a.amount} P$! (${usernames[a.from_user_id] ?? 'Mestre'})`
            : `💸 O Mestre tirou ${-a.amount} P$ de você. (${usernames[a.from_user_id] ?? 'Mestre'})`,
        )
        applying.current.delete(a.id)
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, myTrainer?.id])

  return null
}
