import { useMemo, useState } from 'react'
import type { InventoryEntry, Item } from '../types'
import { ITEMS, itemById } from '../data'
import { parsePrice } from '../lib/economy'

export default function Shop({
  money,
  inventory,
  onChange,
  customItems = [],
}: {
  money: number
  inventory: InventoryEntry[]
  onChange: (money: number, inventory: InventoryEntry[]) => void
  customItems?: Item[]
}) {
  const allItems = useMemo(() => [...customItems, ...ITEMS], [customItems])
  const allItemById = useMemo(
    () => new Map([...customItems.map((i) => [i.id, i] as const), ...itemById]),
    [customItems],
  )
  const pockets = useMemo(() => ['Todos', ...new Set(allItems.map((i) => i.pocket))], [allItems])
  const [pocket, setPocket] = useState('Pokeballs')
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [addAmount, setAddAmount] = useState(0)

  const addFunds = (delta: number) => {
    if (!delta) return
    onChange(Math.max(0, money + delta), inventory)
    setAddAmount(0)
  }

  const purchasable = allItems.filter((i) => parsePrice(i.price) != null)
  const filtered = purchasable.filter(
    (i) =>
      (pocket === 'Todos' || i.pocket === pocket) &&
      i.name.toLowerCase().includes(search.toLowerCase()),
  )

  const buy = (itemId: string) => {
    const item = allItemById.get(itemId)
    const price = item ? parsePrice(item.price) : null
    if (!item || price == null) return
    const n = Math.max(1, qty[itemId] ?? 1)
    const total = price * n
    if (money < total) return
    const inv = [...inventory]
    const idx = inv.findIndex((e) => e.itemId === itemId)
    if (idx >= 0) inv[idx] = { ...inv[idx], qty: inv[idx].qty + n }
    else inv.push({ itemId, qty: n })
    onChange(money - total, inv)
  }

  const adjustInventory = (itemId: string, delta: number) => {
    const inv = inventory
      .map((e) => (e.itemId === itemId ? { ...e, qty: e.qty + delta } : e))
      .filter((e) => e.qty > 0)
    onChange(money, inv)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Saldo</span>
        <input
          type="number"
          value={money}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0), inventory)}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm font-bold focus:border-red-400 focus:outline-none"
        />
        <span className="text-xs text-slate-400">P$</span>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <input
          type="number"
          value={addAmount || ''}
          placeholder="quantia"
          onChange={(e) => setAddAmount(Number(e.target.value) || 0)}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-red-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => addFunds(addAmount)}
          disabled={!addAmount}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
        >
          + Adicionar
        </button>
        <button
          type="button"
          onClick={() => addFunds(-addAmount)}
          disabled={!addAmount}
          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-40"
        >
          − Remover
        </button>
      </div>

      {inventory.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase">
            Inventário
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inventory.map((e) => {
              const item = allItemById.get(e.itemId)
              return (
                <span
                  key={e.itemId}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pr-1 pl-2.5 text-xs font-medium text-slate-600"
                >
                  {item?.name ?? e.itemId} × {e.qty}
                  <button
                    onClick={() => adjustInventory(e.itemId, -1)}
                    title="Usar/descartar 1"
                    className="h-4 w-4 rounded-full text-slate-400 hover:bg-slate-200 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase">Loja</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
          />
          <select
            value={pocket}
            onChange={(e) => setPocket(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
          >
            {pockets.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((item) => {
            const price = parsePrice(item.price)!
            const n = qty[item.id] ?? 1
            const total = price * n
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                  {item.name}
                </span>
                <span className="text-xs text-slate-400">{price} P$</span>
                <input
                  type="number"
                  min={1}
                  value={n}
                  onChange={(e) =>
                    setQty((prev) => ({
                      ...prev,
                      [item.id]: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center text-xs"
                />
                <button
                  onClick={() => buy(item.id)}
                  disabled={money < total}
                  title={item.description}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Comprar ({total})
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-slate-400">Nenhum item encontrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
