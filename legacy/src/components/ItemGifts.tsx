import type { Trainer } from '../types'
import { db } from '../db'
import { useItemGifts, deleteItemGift } from '../lib/itemGifts'

// Presentes de item pendentes do Mestre pra mim nesta mesa — aceitar soma
// no inventário do meu Treinador ativo, recusar só descarta a oferta.
export default function ItemGifts({
  mesaId,
  myId,
  myTrainer,
  usernames,
}: {
  mesaId: string
  myId: string
  myTrainer: Trainer | undefined
  usernames: Record<string, string>
}) {
  const gifts = useItemGifts(mesaId, myId)

  if (gifts.length === 0) return null

  const accept = async (gift: (typeof gifts)[number]) => {
    if (!myTrainer?.id) return
    const inventory = [...(myTrainer.inventory ?? [])]
    const idx = inventory.findIndex((e) => e.itemId === gift.item_id)
    if (idx >= 0) inventory[idx] = { ...inventory[idx], qty: inventory[idx].qty + gift.qty }
    else inventory.push({ itemId: gift.item_id, qty: gift.qty })
    await db.trainers.update(myTrainer.id, { inventory })
    await deleteItemGift(gift.id)
  }

  const decline = async (giftId: string) => {
    await deleteItemGift(giftId)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-300 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-amber-500 px-4 py-2.5 text-white">
        <b>🎁 Presentes do Mestre</b>
      </div>
      <div className="space-y-1.5 p-4">
        {!myTrainer?.id && (
          <p className="text-xs text-amber-700">
            Selecione um Treinador ativo em "Treinadores" para aceitar.
          </p>
        )}
        {gifts.map((g) => (
          <div
            key={g.id}
            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5"
          >
            <span className="flex-1 text-sm text-slate-700">
              <b>{g.item_name}</b> × {g.qty} — de {usernames[g.from_user_id] ?? 'Mestre'}
            </span>
            <button
              onClick={() => accept(g)}
              disabled={!myTrainer?.id}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Aceitar
            </button>
            <button
              onClick={() => decline(g.id)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              Recusar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
