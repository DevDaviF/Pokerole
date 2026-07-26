import { useState } from 'react'
import { db } from '../db'
import { supabase } from '../lib/supabase'
import type { Pokemon, PokemonSheet, Rank } from '../types'
import { RANKS } from '../types'
import { POKEDEX, spriteUrl } from '../data'
import { generateNpcSheet } from '../lib/npcGen'
import {
  HABITATS,
  TIER_WEIGHT,
  suggestFromScoutRoll,
  type Habitat,
  type RarityTier,
} from '../lib/habitats'
import { useScoutRolls, resetScoutRolls } from '../lib/scoutRolls'
import { useCustomItems, createCustomItem, deleteCustomItem, customItemToItem } from '../lib/customItems'
import { sendItemGift } from '../lib/itemGifts'
import { ITEMS } from '../data'
import TypeBadge from '../components/TypeBadge'
import SpeciesPicker from '../components/SpeciesPicker'

// só espécies "base" (sem Mega/Gmax/formas regionais) entram no sorteio
const WILD_POOL = POKEDEX.filter((p) => !p.name.includes('('))

const TIER_LABEL: Record<RarityTier, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
}

async function announce(mesaId: string, myId: string, text: string) {
  if (!supabase) return
  await supabase
    .from('messages')
    .insert({ mesa_id: mesaId, user_id: myId, kind: 'chat', content: text })
}

async function publishNpc(
  mesaId: string,
  myId: string,
  species: Pokemon,
  rank: Rank,
  npcKind: 'wild' | 'gym',
) {
  const sheet = generateNpcSheet(species, rank, npcKind)
  const localId = await db.pokemonSheets.add(sheet)
  if (supabase) {
    await supabase.from('shared_sheets').upsert(
      {
        mesa_id: mesaId,
        owner_id: myId,
        kind: 'pokemon',
        local_id: localId,
        payload: { ...sheet, id: localId },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mesa_id,owner_id,kind,local_id' },
    )
  }
  await announce(
    mesaId,
    myId,
    `${npcKind === 'wild' ? '🐾' : '🏋️'} Ficha gerada e publicada: ${sheet.nickname} (Rank ${rank}). Já dá pra rolar os golpes dela em "Rolar pela ficha".`,
  )
  return { localId, sheet }
}

function weightedDraw(
  habitat: Habitat,
  tiers: RarityTier[],
  includeLegendary: boolean,
  quantity: number,
): Pokemon[] {
  const candidates = new Map<string, { p: Pokemon; weight: number }>()
  for (const tier of tiers) {
    const tierTypes = habitat[tier]
    for (const p of WILD_POOL) {
      if (!includeLegendary && p.legendary) continue
      if (candidates.has(p.id)) continue
      if (p.types.some((t) => tierTypes.includes(t))) {
        candidates.set(p.id, { p, weight: TIER_WEIGHT[tier] })
      }
    }
  }
  const remaining = [...candidates.values()]
  const picks: Pokemon[] = []
  for (let i = 0; i < quantity && remaining.length > 0; i++) {
    const total = remaining.reduce((s, c) => s + c.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (; idx < remaining.length; idx++) {
      r -= remaining[idx].weight
      if (r <= 0) break
    }
    idx = Math.min(idx, remaining.length - 1)
    picks.push(remaining[idx].p)
    remaining.splice(idx, 1)
  }
  return picks
}

interface Drawn {
  key: string
  species: Pokemon
  rank: Rank
  generating: boolean
  done: boolean
  sheet?: PokemonSheet
}

function EncounterTab({ mesaId, myId }: { mesaId: string; myId: string }) {
  const scouts = useScoutRolls(mesaId)
  const [habitatId, setHabitatId] = useState(HABITATS[0].id)
  const [includeLegendary, setIncludeLegendary] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [tiers, setTiers] = useState<RarityTier[]>(['common'])
  const [drawn, setDrawn] = useState<Drawn[]>([])
  const [appliedTotal, setAppliedTotal] = useState<number | null>(null)

  const habitat = HABITATS.find((h) => h.id === habitatId)!

  const toggleTier = (t: RarityTier) =>
    setTiers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    )

  const applyScoutSuggestion = () => {
    if (!scouts) return
    const suggestion = suggestFromScoutRoll(scouts.total)
    setQuantity(suggestion.quantity)
    setTiers(suggestion.tiers)
    setAppliedTotal(scouts.total)
  }

  const draw = async () => {
    const picks = weightedDraw(habitat, tiers, includeLegendary, quantity)
    setDrawn(
      picks.map((p, i) => ({
        key: `${p.id}-${i}`,
        species: p,
        rank: (RANKS as readonly string[]).includes(p.suggestedRank)
          ? (p.suggestedRank as Rank)
          : 'Rookie',
        generating: false,
        done: false,
      })),
    )
    await announce(
      mesaId,
      myId,
      `${habitat.icon} Encontro em ${habitat.label}: ${picks.length ? picks.map((p) => p.name).join(', ') : 'nada por aqui...'}`,
    )
  }

  const generateOne = async (key: string) => {
    const item = drawn.find((d) => d.key === key)
    if (!item) return
    setDrawn((prev) =>
      prev.map((d) => (d.key === key ? { ...d, generating: true } : d)),
    )
    const { sheet } = await publishNpc(mesaId, myId, item.species, item.rank, 'wild')
    setDrawn((prev) =>
      prev.map((d) =>
        d.key === key ? { ...d, generating: false, done: true, sheet } : d,
      ),
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase">
          Habitat
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HABITATS.map((h) => (
            <button
              key={h.id}
              onClick={() => setHabitatId(h.id)}
              title={h.official ? 'Tabela oficial do Corebook' : 'Sugestão nossa (o livro só detalha 2 habitats)'}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                habitatId === h.id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {h.icon} {h.label}
              {!h.official && <span className="text-slate-400"> *</span>}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          * habitats sem tabela oficial no livro (p. 595) — sugestão nossa.
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase">
          Batedores (soma de Insight + Alert de vários Treinadores)
        </p>
        <p className="text-sm text-slate-600">
          Total atual: <b className="text-cyan-700">{scouts?.total ?? 0}</b>{' '}
          sucessos
          {scouts && scouts.contributors.length > 0 && (
            <span className="text-xs text-slate-400">
              {' '}
              ({scouts.contributors.map((c) => c.name).join(', ')})
            </span>
          )}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Cada jogador contribui pelo widget "🔍 Batedores" na tela da mesa
          (rola o próprio Treinador).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={applyScoutSuggestion}
            disabled={!scouts}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            Usar sugestão do total
          </button>
          <button
            onClick={() => mesaId && resetScoutRolls(mesaId)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            Zerar contagem
          </button>
        </div>
        {appliedTotal !== null && (
          <p className="mt-1 text-xs text-slate-500">
            sugestão aplicada com {appliedTotal} sucessos: {quantity} Pokémon,
            até {tiers.map((t) => TIER_LABEL[t]).join('/')} (ajustável abaixo)
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Quantidade
          <input
            type="number"
            min={1}
            max={8}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center text-xs font-bold focus:border-red-400 focus:outline-none"
          />
        </label>
        <div className="flex gap-1">
          {(['common', 'uncommon', 'rare'] as RarityTier[]).map((t) => (
            <button
              key={t}
              onClick={() => toggleTier(t)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                tiers.includes(t)
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={includeLegendary}
            onChange={(e) => setIncludeLegendary(e.target.checked)}
          />
          Incluir lendários
        </label>
        <button
          onClick={draw}
          disabled={tiers.length === 0}
          className="ml-auto rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          🎲 Sortear encontro
        </button>
      </div>

      {drawn.length > 0 && (
        <div className="space-y-2">
          {drawn.map((d) => (
            <div
              key={d.key}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3"
            >
              <img
                src={spriteUrl(d.species.id)}
                alt=""
                className="h-12 w-12 object-contain [image-rendering:pixelated]"
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
              <div>
                <p className="font-bold text-slate-800">{d.species.name}</p>
                <div className="flex gap-1">
                  {d.species.types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </div>
              </div>
              <select
                value={d.rank}
                onChange={(e) =>
                  setDrawn((prev) =>
                    prev.map((x) =>
                      x.key === d.key
                        ? { ...x, rank: e.target.value as Rank }
                        : x,
                    ),
                  )
                }
                className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
              >
                {RANKS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button
                onClick={() => generateOne(d.key)}
                disabled={d.generating || d.done}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {d.done ? '✓ Publicada' : d.generating ? 'Gerando...' : '✨ Gerar ficha'}
              </button>
              {d.sheet && (
                <p
                  className="w-full text-xs text-slate-500"
                  title="Só você vê isso — o jogador não tem acesso à ficha até você compartilhar/capturar"
                >
                  🔒 Def/Sp.Def: <b>{d.sheet.attributes.vitality}</b> /{' '}
                  <b>{d.sheet.attributes.insight}</b> · HP{' '}
                  {d.sheet.currentHp}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GymTab({ mesaId, myId }: { mesaId: string; myId: string }) {
  const [species, setSpecies] = useState<Pokemon | null>(null)
  const [rank, setRank] = useState<Rank>('Ace')
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const [sheet, setSheet] = useState<PokemonSheet | null>(null)

  const generate = async () => {
    if (!species) return
    setGenerating(true)
    const { sheet: s } = await publishNpc(mesaId, myId, species, rank, 'gym')
    setSheet(s)
    setGenerating(false)
    setDone(true)
  }

  return (
    <div className="space-y-3">
      <SpeciesPicker
        onSelect={(p) => {
          setSpecies(p)
          setDone(false)
          setSheet(null)
        }}
        placeholder="Buscar espécie para o time do ginásio..."
      />
      {species && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
          <img
            src={spriteUrl(species.id)}
            alt=""
            className="h-14 w-14 object-contain [image-rendering:pixelated]"
            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
          />
          <div>
            <p className="font-bold text-slate-800">{species.name}</p>
            <div className="flex gap-1">
              {species.types.map((t) => (
                <TypeBadge key={t} type={t} size="sm" />
              ))}
            </div>
          </div>
          <select
            value={rank}
            onChange={(e) => setRank(e.target.value as Rank)}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
          >
            {RANKS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {generating ? 'Gerando...' : '🏋️ Gerar Pokémon de Ginásio'}
          </button>
          {done && (
            <p className="w-full text-xs font-semibold text-emerald-600">
              Publicado na mesa! Veja em "Fichas da mesa" ou "Rolar pela
              ficha".
            </p>
          )}
          {sheet && (
            <p
              className="w-full text-xs text-slate-500"
              title="Só você vê isso — o jogador não tem acesso à ficha até você compartilhar"
            >
              🔒 Def/Sp.Def: <b>{sheet.attributes.vitality}</b> /{' '}
              <b>{sheet.attributes.insight}</b> · HP {sheet.currentHp}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const ITEM_POCKETS = [
  'TrainerItems',
  'HeldItems',
  'Medicine',
  'Pokeballs',
  'EvolutionItem',
  'TechnicalMachine',
]

function GiftTab({
  mesaId,
  members,
  usernames,
  customItems,
}: {
  mesaId: string
  members: Array<{ user_id: string; role: 'gm' | 'player' }>
  usernames: Record<string, string>
  customItems: ReturnType<typeof customItemToItem>[]
}) {
  const allItems = [...customItems, ...ITEMS]
  const [search, setSearch] = useState('')
  const [itemId, setItemId] = useState('')
  const [targetUser, setTargetUser] = useState('')
  const [qty, setQty] = useState(1)
  const [notice, setNotice] = useState('')

  const filtered = allItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  )
  const players = members.filter((m) => m.role === 'player')

  const gift = async () => {
    const item = allItems.find((i) => i.id === itemId)
    if (!item || !targetUser || qty < 1) return
    await sendItemGift(mesaId, targetUser, { id: item.id, name: item.name }, qty)
    setNotice(`${item.name} × ${qty} enviado pra ${usernames[targetUser] ?? 'jogador'}!`)
    setItemId('')
    setQty(1)
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500 uppercase">
        Presentear item (qualquer um do catálogo, mesmo "Not for Sale")
      </p>
      {players.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum jogador na mesa ainda.</p>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Escolha um item...</option>
              {filtered.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-xs focus:border-red-400 focus:outline-none"
            />
            <select
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
            >
              <option value="">Pra quem...</option>
              {players.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {usernames[m.user_id] ?? m.user_id}
                </option>
              ))}
            </select>
            <button
              onClick={gift}
              disabled={!itemId || !targetUser}
              className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-40"
            >
              🎁 Presentear
            </button>
          </div>
        </>
      )}
      {notice && (
        <p
          className="cursor-pointer text-xs text-emerald-600"
          onClick={() => setNotice('')}
        >
          {notice}
        </p>
      )}
    </div>
  )
}

function ItemsTab({
  mesaId,
  members,
  usernames,
}: {
  mesaId: string
  members: Array<{ user_id: string; role: 'gm' | 'player' }>
  usernames: Record<string, string>
}) {
  const items = useCustomItems(mesaId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pocket, setPocket] = useState('TrainerItems')
  const [price, setPrice] = useState(100)
  const [oneUse, setOneUse] = useState(true)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim() || price < 0) return
    setBusy(true)
    await createCustomItem(mesaId, {
      name: name.trim(),
      description: description.trim(),
      pocket,
      price,
      oneUse,
    })
    setName('')
    setDescription('')
    setPrice(100)
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <GiftTab
        mesaId={mesaId}
        members={members}
        usernames={usernames}
        customItems={items.map(customItemToItem)}
      />

      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-bold text-slate-500 uppercase">
          Criar item personalizado
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do item"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
          />
          <select
            value={pocket}
            onChange={(e) => setPocket(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
          >
            {ITEM_POCKETS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-xs focus:border-red-400 focus:outline-none"
          />
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={oneUse}
              onChange={(e) => setOneUse(e.target.checked)}
            />
            consumível
          </label>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição / efeito (opcional)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
        />
        <button
          onClick={create}
          disabled={!name.trim() || busy}
          className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-40"
        >
          {busy ? 'Criando...' : '+ Criar item'}
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase">
          Itens desta mesa
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum item personalizado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                  {it.name}{' '}
                  <span className="text-slate-400">
                    ({it.pocket} · {it.price} P$)
                  </span>
                </span>
                <button
                  onClick={() => deleteCustomItem(it.id)}
                  title="Remover"
                  className="text-slate-300 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-400">
          Aparecem na loja de todos os treinadores desta mesa (marcados
          com 🛠️).
        </p>
      </div>
    </div>
  )
}

export default function GmToolsPanel({
  mesaId,
  myId,
  members,
  usernames,
}: {
  mesaId: string
  myId: string
  members: Array<{ user_id: string; role: 'gm' | 'player' }>
  usernames: Record<string, string>
}) {
  const [tab, setTab] = useState<'encounter' | 'gym' | 'items'>('encounter')

  return (
    <div className="overflow-hidden rounded-xl border border-purple-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 px-4 py-2.5 text-white">
        <b>🎓 Ferramentas do Mestre</b>
        <div className="ml-auto flex gap-1">
          {(['encounter', 'gym', 'items'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
                tab === t
                  ? 'bg-white text-purple-800'
                  : 'bg-black/15 text-white hover:bg-black/25'
              }`}
            >
              {t === 'encounter' ? '🐾 Encontro' : t === 'gym' ? '🏋️ Ginásio' : '🛒 Itens'}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {tab === 'encounter' && <EncounterTab mesaId={mesaId} myId={myId} />}
        {tab === 'gym' && <GymTab mesaId={mesaId} myId={myId} />}
        {tab === 'items' && (
          <ItemsTab mesaId={mesaId} members={members} usernames={usernames} />
        )}
      </div>
    </div>
  )
}
