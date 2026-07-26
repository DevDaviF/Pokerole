import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { PokemonSheet, InventoryEntry } from '../types'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useMesa } from '../lib/mesa'
import { pokemonById, moveById, spriteUrl, typeColor } from '../data'
import { POKEMON_ATTRIBUTE_LABELS, TRAINER_ATTRIBUTE_LABELS } from '../constants'
import { MoveRollPanel } from '../components/MoveRoll'
import { TreinoPanel } from '../components/TreinoRoll'
import TrainingPointsBadge from '../components/TrainingPoints'
import MesaNotes from '../components/MesaNotes'
import SkillRoll from '../components/SkillRoll'
import { DiceRow } from '../components/DiceRoller'
import BattleTracker from '../components/BattleTracker'
import ScoutRollWidget from '../components/ScoutRollWidget'
import CaptureRoll from '../components/CaptureRoll'
import SheetTransfers from '../components/SheetTransfers'
import DayPassPanel from '../components/DayPassPanel'
import ItemGifts from '../components/ItemGifts'
import ErrorBoundary from '../components/ErrorBoundary'
import Shop from '../components/Shop'
import GmToolsPanel from './MesaGmTools'
import { getActiveTrainerId } from './TrainersPage'
import { useCustomItems, customItemToItem } from '../lib/customItems'

// Cor determinística por usuário (hash simples do id → matiz), pra
// identificar quem falou o quê de relance no chat.
function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return `hsl(${hash % 360}, 60%, 38%)`
}

// Rótulos de roll seguem o padrão "Personagem · ação" em todo o app
// (ex: "Faísca · Iniciativa", "Davi F · Arremesso..."). Separa o nome do
// personagem do resto pra mostrar em cor diferente do nome de usuário.
function splitRollLabel(
  content: string,
  poolFallback: string,
): { actor: string | null; rest: string } {
  if (!content) return { actor: null, rest: poolFallback }
  const idx = content.indexOf(' · ')
  if (idx === -1) return { actor: null, rest: content }
  return { actor: content.slice(0, idx), rest: content.slice(idx + 3) }
}

// Rolagem rápida pelas fichas locais, sem sair do chat da mesa
function QuickRollCard() {
  const sheets = useLiveQuery(() => db.pokemonSheets.toArray(), []) ?? []
  const trainers = useLiveQuery(() => db.trainers.toArray(), []) ?? []
  const [source, setSource] = useState<'pokemon' | 'trainer'>('pokemon')
  const [sheetId, setSheetId] = useState<number | null>(null)
  const [trainerId, setTrainerId] = useState<number | null>(null)
  const [moveId, setMoveId] = useState<string | null>(null)
  const [tab, setTab] = useState<'moves' | 'treino' | 'skill'>('moves')

  const activeTrainerId = getActiveTrainerId()
  const activeTrainer =
    trainers.find((t) => t.id === activeTrainerId) ?? trainers[0]

  const ordered = [...sheets].sort(
    (a, b) => Number(b.inTeam) - Number(a.inTeam),
  )
  const sheet = ordered.find((s) => s.id === sheetId) ?? ordered[0]
  const trainer =
    trainers.find((t) => t.id === trainerId) ?? trainers[0]
  const move = moveId ? moveById.get(moveId) : undefined
  const sheetSpecies = sheet ? pokemonById.get(sheet.species) : undefined

  if (ordered.length === 0 && trainers.length === 0) return null

  const headerColor =
    source === 'pokemon' && sheetSpecies
      ? typeColor(sheetSpecies.types[0])
      : '#1e293b'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-white transition-colors"
        style={{ backgroundColor: headerColor }}
      >
        <h2 className="font-bold">🎲 Rolar pela ficha</h2>
        <div className="flex gap-1 rounded-full bg-black/15 p-0.5">
          {(['pokemon', 'trainer'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
                source === s
                  ? 'bg-white text-slate-800'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {s === 'pokemon' ? 'Pokémon' : 'Treinador'}
            </button>
          ))}
        </div>
        {source === 'pokemon' && (
          <div className="ml-auto flex gap-1">
            {(['moves', 'treino', 'skill'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
                  tab === t
                    ? 'bg-white text-slate-800'
                    : 'bg-black/15 text-white hover:bg-black/25'
                }`}
              >
                {t === 'moves' ? 'Golpes' : t === 'treino' ? '🏋️ Treino' : '🎲 Perícia'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        {source === 'pokemon' ? (
          <div className="flex flex-wrap gap-1.5">
            {ordered.map((s) => {
              const sp = pokemonById.get(s.species)
              const selected = sheet?.id === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSheetId(s.id!)
                    setMoveId(null)
                  }}
                  className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-transparent bg-slate-800 text-white shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {sp && (
                    <img
                      src={spriteUrl(sp.id)}
                      alt=""
                      className="h-6 w-6 object-contain [image-rendering:pixelated]"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = 'hidden')
                      }
                    />
                  )}
                  {s.nickname || sp?.name}
                </button>
              )
            })}
            {ordered.length === 0 && (
              <p className="text-xs text-slate-400">
                Nenhuma ficha de Pokémon ainda.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {trainers.map((t) => {
              const selected = trainer?.id === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTrainerId(t.id!)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-transparent bg-slate-800 text-white shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🧑 {t.name}
                </button>
              )
            })}
            {trainers.length === 0 && (
              <p className="text-xs text-slate-400">
                Nenhum treinador ainda.
              </p>
            )}
          </div>
        )}

        {source === 'pokemon' && sheet && (
          <>
            <TrainingPointsBadge sheet={sheet} />

            {tab === 'moves' && (
              <>
                <div className="flex flex-wrap gap-1">
                  {sheet.knownMoves.map((mid) => (
                    <button
                      key={mid}
                      onClick={() => setMoveId(moveId === mid ? null : mid)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        moveId === mid
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {moveById.get(mid)?.name}
                    </button>
                  ))}
                  {sheet.knownMoves.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Esta ficha não tem golpes selecionados.
                    </p>
                  )}
                </div>
                {move && (
                  <MoveRollPanel
                    sheet={sheet}
                    move={move}
                    displayName={
                      sheet.nickname ||
                      pokemonById.get(sheet.species)?.name ||
                      '?'
                    }
                  />
                )}
              </>
            )}
            {tab === 'treino' && (
              <TreinoPanel
                sheet={sheet}
                displayName={
                  sheet.nickname || pokemonById.get(sheet.species)?.name || '?'
                }
                trainer={activeTrainer}
              />
            )}
            {tab === 'skill' && (
              <SkillRoll
                sheet={sheet}
                displayName={
                  sheet.nickname || pokemonById.get(sheet.species)?.name || '?'
                }
                isPokemon
              />
            )}
          </>
        )}

        {source === 'trainer' && trainer && (
          <SkillRoll sheet={trainer} displayName={trainer.name} isPokemon={false} />
        )}
      </div>
    </div>
  )
}

interface Message {
  id: number
  mesa_id: string
  user_id: string
  kind: 'chat' | 'roll'
  content: string
  roll: {
    pool: number
    dice: number[]
    successes: number
    sixes: number
    mode?: 'chance' | 'additive'
    triggered?: boolean
    bonus?: number
    total?: number
  } | null
  created_at: string
}

interface MesaRow {
  id: string
  name: string
  invite_code: string
  owner_id: string
}

interface SharedSheet {
  id: string
  owner_id: string
  kind: 'trainer' | 'pokemon'
  local_id: number
  payload: Record<string, unknown>
  updated_at: string
}

// ── Login / Cadastro ───────────────────────────────────────────────

function AuthPanel() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!supabase) return
    setBusy(true)
    setError('')
    setInfo('')
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(error.message)
      else
        setInfo(
          'Email de recuperação enviado! Abra o link com o app rodando nesta máquina.',
        )
    } else {
      const { error } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { data: { username: username.trim() } },
            })
      if (error) setError(error.message)
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex gap-2">
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${
              mode === m
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {m === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {mode === 'signup' && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nome de usuário (3-24 letras)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
        />
        {mode !== 'reset' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha (mín. 6 caracteres)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}
        <button
          onClick={submit}
          disabled={
            busy || !email || (mode !== 'reset' && password.length < 6)
          }
          className="w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
        >
          {busy
            ? '...'
            : mode === 'login'
              ? 'Entrar'
              : mode === 'signup'
                ? 'Cadastrar'
                : 'Enviar email de recuperação'}
        </button>
        {mode === 'login' && (
          <button
            onClick={() => setMode('reset')}
            className="w-full text-center text-xs text-slate-400 hover:text-red-600"
          >
            Esqueci minha senha
          </button>
        )}
        {mode === 'reset' && (
          <button
            onClick={() => setMode('login')}
            className="w-full text-center text-xs text-slate-400 hover:text-red-600"
          >
            ← Voltar ao login
          </button>
        )}
      </div>
    </div>
  )
}

function NewPasswordPanel({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
      <h2 className="font-bold text-slate-800">Defina sua nova senha</h2>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Nova senha (mín. 6 caracteres)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || password.length < 6}
        className="w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
      >
        Salvar nova senha
      </button>
    </div>
  )
}

// ── Visualizador de ficha compartilhada (somente leitura) ──────────

function SheetViewer({
  sheet,
  username,
  onClose,
}: {
  sheet: SharedSheet
  username: string
  onClose: () => void
}) {
  const p = sheet.payload as Record<string, any>
  const species =
    sheet.kind === 'pokemon' ? pokemonById.get(String(p.species)) : null
  const attrs =
    sheet.kind === 'pokemon'
      ? POKEMON_ATTRIBUTE_LABELS
      : TRAINER_ATTRIBUTE_LABELS

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          {species && (
            <img
              src={spriteUrl(species.id)}
              alt=""
              className="h-12 w-12 object-contain [image-rendering:pixelated]"
              onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
            />
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {String(p.nickname || p.name || species?.name || '?')}
            </h2>
            <p className="text-xs text-slate-500">
              {sheet.kind === 'pokemon'
                ? `${species?.name ?? '?'} · Rank ${p.rank} · de ${username}`
                : `Treinador · Rank ${p.rank} · de ${username}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-2xl text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="mb-1 text-xs font-bold text-slate-400 uppercase">
              Atributos
            </h3>
            {attrs.map(({ key, label }) => (
              <div key={key} className="flex justify-between">
                <span className="text-slate-500">{label}</span>
                <b className="text-slate-700">{p.attributes?.[key] ?? '-'}</b>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-1 text-xs font-bold text-slate-400 uppercase">
              Sociais
            </h3>
            {Object.entries(p.social ?? {}).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-500 capitalize">{k}</span>
                <b className="text-slate-700">{String(v)}</b>
              </div>
            ))}
          </div>
        </div>

        {p.skills && Object.values(p.skills).some((v: any) => v > 0) && (
          <div className="mt-3">
            <h3 className="mb-1 text-xs font-bold text-slate-400 uppercase">
              Skills
            </h3>
            <p className="text-sm text-slate-600">
              {Object.entries(p.skills)
                .filter(([, v]: [string, any]) => v > 0)
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ')}
            </p>
          </div>
        )}

        {sheet.kind === 'pokemon' && Array.isArray(p.knownMoves) && (
          <div className="mt-3">
            <h3 className="mb-1 text-xs font-bold text-slate-400 uppercase">
              Golpes
            </h3>
            <div className="flex flex-wrap gap-1">
              {p.knownMoves.map((mid: string) => (
                <span
                  key={mid}
                  className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                >
                  {moveById.get(mid)?.name ?? mid}
                </span>
              ))}
            </div>
          </div>
        )}

        {sheet.kind === 'pokemon' && (
          <p className="mt-3 text-sm text-slate-500">
            HP atual: <b>{String(p.currentHp ?? '?')}</b>
            {species ? ` / ${species.baseHp + (p.attributes?.vitality ?? 0)}` : ''}
            {p.ability ? ` · Habilidade: ${p.ability}` : ''}
            {p.nature ? ` · Natureza: ${p.nature}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────

export default function MesaPage() {
  const { session, activeMesa, setActiveMesa, passwordRecovery, clearPasswordRecovery } =
    useMesa()
  const [mesas, setMesas] = useState<MesaRow[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [sharedSheets, setSharedSheets] = useState<SharedSheet[]>([])
  const [chatInput, setChatInput] = useState('')
  const [newMesaName, setNewMesaName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [notice, setNotice] = useState('')
  const [viewing, setViewing] = useState<SharedSheet | null>(null)
  const [myRole, setMyRole] = useState<'gm' | 'player' | null>(null)
  const [members, setMembers] = useState<
    Array<{ user_id: string; role: 'gm' | 'player' }>
  >([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  // só faz scroll automático se o usuário já estava perto do fim — evita
  // puxar a tela de quem rolou pra cima pra ler o histórico
  const wasNearBottomRef = useRef(true)
  const handleChatScroll = () => {
    const el = chatContainerRef.current
    if (!el) return
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const myPokemonSheets = useLiveQuery(() => db.pokemonSheets.toArray(), []) ?? []
  // NPCs gerados nas Ferramentas do Mestre também ficam salvos no Dexie
  // local dele (pra poder rolar pela ficha) — usado sem filtro eles
  // apareceriam duplicados na Ordem de Combate (uma vez como "meu
  // Pokémon", outra via sharedNpcs/fichas compartilhadas). Essa versão
  // filtrada é só pra ali e pra Captura/Passar o dia — em "Compartilhar
  // minhas fichas" e em "Presentear" (Ferramentas do Mestre) o Mestre
  // precisa ver os selvagens também, então esses usam myPokemonSheets
  // sem filtro.
  const myOwnPokemonSheets = myPokemonSheets.filter((s) => !s.isNpc)
  const myTrainers = useLiveQuery(() => db.trainers.toArray(), []) ?? []
  const myActiveTrainer =
    myTrainers.find((t) => t.id === getActiveTrainerId()) ?? myTrainers[0]
  const [shopOpen, setShopOpen] = useState(false)
  const customItemRows = useCustomItems(activeMesa?.id ?? null)
  const customShopItems = customItemRows.map(customItemToItem)

  const updateMyTrainerEconomy = async (money: number, inventory: InventoryEntry[]) => {
    if (!myActiveTrainer?.id) return
    await db.trainers.update(myActiveTrainer.id, { money, inventory })
  }

  const loadMesas = async () => {
    if (!supabase || !session) return
    const { data } = await supabase.from('mesas').select('*')
    const rows = (data as MesaRow[]) ?? []
    setMesas(rows)
    // defesa extra: se a mesa ativa em cache não está entre as mesas que
    // esta conta realmente participa (removido da mesa, mesa apagada...),
    // tira ela da tela em vez de continuar mostrando dados presos
    if (activeMesa && !rows.some((m) => m.id === activeMesa.id)) {
      setActiveMesa(null)
    }
  }

  useEffect(() => {
    loadMesas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Carrega chat + fichas + nomes ao entrar numa mesa, e assina o realtime
  useEffect(() => {
    if (!supabase || !session || !activeMesa) return
    let cancelled = false

    const load = async () => {
      const [msgs, sheets, memberResp] = await Promise.all([
        supabase!
          .from('messages')
          .select('*')
          .eq('mesa_id', activeMesa.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase!.from('shared_sheets').select('*').eq('mesa_id', activeMesa.id),
        supabase!
          .from('mesa_members')
          .select('user_id, role')
          .eq('mesa_id', activeMesa.id),
      ])
      if (cancelled) return
      setMessages(((msgs.data as Message[]) ?? []).reverse())
      setSharedSheets((sheets.data as SharedSheet[]) ?? [])
      const memberRows = (
        (memberResp.data as Array<{ user_id: string; role?: 'gm' | 'player' }>) ??
        []
      ).map((m) => ({ user_id: m.user_id, role: m.role ?? ('player' as const) }))
      setMembers(memberRows)
      const mine = memberRows.find((m) => m.user_id === session.user.id)
      setMyRole(mine?.role ?? 'player')
      const ids = memberRows.map((m) => m.user_id)
      if (ids.length) {
        const { data: profs } = await supabase!
          .from('profiles')
          .select('id, username')
          .in('id', ids)
        if (cancelled) return
        setUsernames(
          Object.fromEntries(
            ((profs as Array<{ id: string; username: string }>) ?? []).map(
              (p) => [p.id, p.username],
            ),
          ),
        )
      }
    }
    load()

    const channel = supabase
      .channel(`mesa-${activeMesa.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `mesa_id=eq.${activeMesa.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message].slice(-200))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [session, activeMesa])

  // Canal separado para fichas compartilhadas — deixar num canal próprio
  // (em vez de juntar com o do chat) evita que um problema nessa tabela
  // derrube também a atualização em tempo real das mensagens.
  useEffect(() => {
    if (!supabase || !session || !activeMesa) return

    const channel = supabase
      .channel(`shared-sheets-${activeMesa.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shared_sheets',
          filter: `mesa_id=eq.${activeMesa.id}`,
        },
        (payload) => {
          const row = payload.new as SharedSheet
          setSharedSheets((prev) => [...prev.filter((s) => s.id !== row.id), row])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_sheets',
          filter: `mesa_id=eq.${activeMesa.id}`,
        },
        (payload) => {
          const row = payload.new as SharedSheet
          setSharedSheets((prev) => [...prev.filter((s) => s.id !== row.id), row])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shared_sheets',
          filter: `mesa_id=eq.${activeMesa.id}`,
        },
        (payload) => {
          const row = payload.old as { id: string }
          setSharedSheets((prev) => prev.filter((s) => s.id !== row.id))
        },
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [session, activeMesa])

  // Canal próprio pra lista de membros — sem isso, quando alguém entra
  // (ou é expulso/sai), só aparecia depois de recarregar a página.
  useEffect(() => {
    if (!supabase || !session || !activeMesa) return

    const fetchUsername = async (userId: string) => {
      const { data } = await supabase!
        .from('profiles')
        .select('id, username')
        .eq('id', userId)
        .maybeSingle()
      if (data) {
        setUsernames((prev) => ({ ...prev, [data.id]: data.username }))
      }
    }

    const channel = supabase
      .channel(`mesa-members-${activeMesa.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mesa_members',
          filter: `mesa_id=eq.${activeMesa.id}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; role: 'gm' | 'player' }
          setMembers((prev) =>
            prev.some((m) => m.user_id === row.user_id)
              ? prev
              : [...prev, { user_id: row.user_id, role: row.role ?? 'player' }],
          )
          fetchUsername(row.user_id)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mesa_members',
          filter: `mesa_id=eq.${activeMesa.id}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; role: 'gm' | 'player' }
          setMembers((prev) =>
            prev.map((m) => (m.user_id === row.user_id ? { ...m, role: row.role } : m)),
          )
          if (row.user_id === session.user.id) setMyRole(row.role)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'mesa_members',
        },
        (payload) => {
          const row = payload.old as { mesa_id?: string; user_id: string }
          if (row.user_id === session.user.id) {
            // fui removido (expulso ou saí em outra aba) — sai da mesa na tela
            setActiveMesa(null)
            setNotice('Você não está mais nesta mesa.')
            return
          }
          setMembers((prev) => prev.filter((m) => m.user_id !== row.user_id))
        },
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [session, activeMesa])

  useEffect(() => {
    const el = chatContainerRef.current
    // scrollTop direto no container, não scrollIntoView: scrollIntoView
    // rola QUALQUER ancestral necessário pra mostrar o alvo — se o usuário
    // estiver lendo outro painel acima do chat (fora da viewport), ele
    // arrastava a página inteira pra baixo. Isso mexe só no chat.
    if (wasNearBottomRef.current && el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  if (!supabaseConfigured) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Supabase não configurado — preencha o arquivo <code>.env</code> e
        reinicie o servidor.
      </p>
    )
  }

  if (!session) return <AuthPanel />

  if (passwordRecovery) return <NewPasswordPanel onDone={clearPasswordRecovery} />

  const myId = session.user.id

  const sharedNpcs = sharedSheets
    .filter(
      (s) => s.kind === 'pokemon' && (s.payload as unknown as { isNpc?: boolean }).isNpc,
    )
    .map((s) => ({
      id: s.id,
      ownerId: s.owner_id,
      payload: s.payload as unknown as PokemonSheet,
    }))

  const createMesa = async () => {
    if (!supabase || newMesaName.trim().length < 2) return
    const { data, error } = await supabase
      .from('mesas')
      .insert({ name: newMesaName.trim(), owner_id: myId })
      .select()
      .single()
    if (error) setNotice(error.message)
    else {
      setNewMesaName('')
      await loadMesas()
      const m = data as MesaRow
      setActiveMesa({ id: m.id, name: m.name, inviteCode: m.invite_code })
    }
  }

  const joinMesa = async () => {
    if (!supabase || !joinCode.trim()) return
    const { data: mesaId, error } = await supabase.rpc('join_mesa', {
      _code: joinCode.trim(),
    })
    if (error) setNotice(error.message)
    else {
      setJoinCode('')
      setNotice('Você entrou na mesa!')
      await loadMesas()
      const { data: m } = await supabase
        .from('mesas')
        .select('*')
        .eq('id', mesaId)
        .single()
      if (m) {
        setActiveMesa({
          id: m.id,
          name: m.name,
          inviteCode: m.invite_code,
        })
      }
    }
  }

  const sendChat = async () => {
    if (!supabase || !activeMesa || !chatInput.trim()) return
    const content = chatInput.trim().slice(0, 2000)
    setChatInput('')
    const { error } = await supabase.from('messages').insert({
      mesa_id: activeMesa.id,
      user_id: myId,
      kind: 'chat',
      content,
    })
    if (error) setNotice(error.message)
  }

  const shareSheet = async (kind: 'pokemon' | 'trainer', localId: number) => {
    if (!supabase || !activeMesa) return
    const payload =
      kind === 'pokemon'
        ? myPokemonSheets.find((s) => s.id === localId)
        : myTrainers.find((t) => t.id === localId)
    if (!payload) return
    const { error } = await supabase.from('shared_sheets').upsert(
      {
        mesa_id: activeMesa.id,
        owner_id: myId,
        kind,
        local_id: localId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mesa_id,owner_id,kind,local_id' },
    )
    if (error) setNotice(error.message)
    else {
      const { data } = await supabase
        .from('shared_sheets')
        .select('*')
        .eq('mesa_id', activeMesa.id)
      setSharedSheets((data as SharedSheet[]) ?? [])
    }
  }

  const unshareSheet = async (id: string) => {
    if (!supabase) return
    await supabase.from('shared_sheets').delete().eq('id', id)
    setSharedSheets((prev) => prev.filter((s) => s.id !== id))
  }

  const transferGm = async (targetUserId: string) => {
    if (!supabase || !activeMesa || myRole !== 'gm') return
    const target = members.find((m) => m.user_id === targetUserId)
    if (
      !confirm(
        `Transferir o cargo de Mestre para ${usernames[targetUserId] ?? 'este membro'}? Você vira Jogador.`,
      )
    )
      return
    // promove o alvo primeiro — só depois abre mão do próprio cargo, para
    // nunca existir um instante sem nenhum Mestre na mesa
    const { error: promoteError } = await supabase
      .from('mesa_members')
      .update({ role: 'gm' })
      .eq('mesa_id', activeMesa.id)
      .eq('user_id', targetUserId)
    if (promoteError) {
      setNotice(promoteError.message)
      return
    }
    const { error: demoteError } = await supabase
      .from('mesa_members')
      .update({ role: 'player' })
      .eq('mesa_id', activeMesa.id)
      .eq('user_id', myId)
    if (demoteError) {
      setNotice(demoteError.message)
      return
    }
    // owner_id acompanha o Mestre atual — é o que a policy de "excluir a
    // mesa" usa pra decidir quem pode apagar, então sem isso o dono
    // original ficaria pra sempre com esse poder mesmo depois de repassar
    // o cargo.
    await supabase.from('mesas').update({ owner_id: targetUserId }).eq('id', activeMesa.id)
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === targetUserId
          ? { ...m, role: 'gm' }
          : m.user_id === myId
            ? { ...m, role: 'player' }
            : m,
      ),
    )
    setMyRole('player')
    setMesas((prev) =>
      prev.map((m) => (m.id === activeMesa.id ? { ...m, owner_id: targetUserId } : m)),
    )
    setNotice(
      `${usernames[targetUserId] ?? target?.user_id} agora é o Mestre da mesa.`,
    )
  }

  const kickMember = async (targetUserId: string) => {
    if (!supabase || !activeMesa || myRole !== 'gm') return
    if (
      !confirm(
        `Expulsar ${usernames[targetUserId] ?? 'este membro'} da mesa?`,
      )
    )
      return
    const { error } = await supabase
      .from('mesa_members')
      .delete()
      .eq('mesa_id', activeMesa.id)
      .eq('user_id', targetUserId)
    if (error) setNotice(error.message)
    else setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId))
  }

  const leaveMesa = async () => {
    if (!supabase || !activeMesa) return
    const others = members.filter((m) => m.user_id !== myId)

    if (myRole === 'gm' && others.length === 0) {
      // único membro: sair como Mestre não pode deixar a mesa "órfã" por
      // aí — apaga ela inteira (chat, fichas compartilhadas, notas, tudo
      // via cascade) em vez de deixar lixo pra trás.
      if (
        !confirm(
          `Você é o único membro da mesa "${activeMesa.name}". Sair vai excluir a mesa e tudo nela (chat, fichas compartilhadas, notas de sessão). Não dá pra desfazer. Excluir mesmo assim?`,
        )
      )
        return
      const { error } = await supabase.from('mesas').delete().eq('id', activeMesa.id)
      if (error) {
        setNotice(error.message)
        return
      }
      setActiveMesa(null)
      await loadMesas()
      return
    }

    if (myRole === 'gm') {
      if (
        !confirm(
          `Você é o Mestre desta mesa. Ao sair, o cargo passa automaticamente para ${usernames[others[0].user_id] ?? 'outro membro'}. Sair mesmo assim?`,
        )
      )
        return
      const nextGm = others[0]
      const { error: promoteError } = await supabase
        .from('mesa_members')
        .update({ role: 'gm' })
        .eq('mesa_id', activeMesa.id)
        .eq('user_id', nextGm.user_id)
      if (promoteError) {
        setNotice(promoteError.message)
        return
      }
      await supabase.from('mesas').update({ owner_id: nextGm.user_id }).eq('id', activeMesa.id)
    } else {
      if (!confirm(`Sair da mesa "${activeMesa.name}"?`)) return
    }

    const { error } = await supabase
      .from('mesa_members')
      .delete()
      .eq('mesa_id', activeMesa.id)
      .eq('user_id', myId)
    if (error) {
      setNotice(error.message)
      return
    }
    setActiveMesa(null)
    await loadMesas()
  }

  const deleteMesaOwned = async (mesaId: string, name: string) => {
    if (!supabase) return
    if (
      !confirm(
        `Excluir a mesa "${name}" permanentemente? Isso apaga chat, fichas compartilhadas e tudo mais dela. Não dá pra desfazer.`,
      )
    )
      return
    const { error } = await supabase.from('mesas').delete().eq('id', mesaId)
    if (error) {
      setNotice(error.message)
      return
    }
    if (activeMesa?.id === mesaId) setActiveMesa(null)
    await loadMesas()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Mesa</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            Logado como <b>{usernames[myId] ?? session.user.email}</b>
          </span>
          <button
            onClick={() => supabase?.auth.signOut()}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </div>

      {notice && (
        <p
          className="cursor-pointer rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600"
          onClick={() => setNotice('')}
          title="Clique para dispensar"
        >
          {notice}
        </p>
      )}

      {/* Minhas mesas + criar/entrar */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold text-slate-800">Minhas mesas</h2>
          {mesas.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma ainda.</p>
          )}
          <div className="space-y-1.5">
            {mesas.map((m) => (
              <div
                key={m.id}
                className={`flex w-full items-center gap-1 rounded-lg border px-1.5 py-1.5 text-sm ${
                  activeMesa?.id === m.id
                    ? 'border-red-400 bg-red-50 font-semibold text-red-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <button
                  onClick={() =>
                    setActiveMesa({
                      id: m.id,
                      name: m.name,
                      inviteCode: m.invite_code,
                    })
                  }
                  className="flex flex-1 items-center justify-between overflow-hidden px-1.5 hover:opacity-75"
                >
                  <span className="truncate">{m.name}</span>
                  {m.owner_id === myId && (
                    <span className="ml-1 shrink-0 text-[10px] text-slate-400 uppercase">
                      dono
                    </span>
                  )}
                </button>
                {m.owner_id === myId && (
                  <button
                    onClick={() => deleteMesaOwned(m.id, m.name)}
                    title="Excluir esta mesa permanentemente"
                    className="shrink-0 rounded-md px-1.5 py-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold text-slate-800">Criar mesa</h2>
          <div className="flex gap-2">
            <input
              value={newMesaName}
              onChange={(e) => setNewMesaName(e.target.value)}
              placeholder="Nome da mesa"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-red-400 focus:outline-none"
            />
            <button
              onClick={createMesa}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
            >
              Criar
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold text-slate-800">Entrar com código</h2>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ex: A1B2C3"
              maxLength={6}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm uppercase focus:border-red-400 focus:outline-none"
            />
            <button
              onClick={joinMesa}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-700"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>

      {activeMesa && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-800 px-4 py-2.5 text-white">
            <b>{activeMesa.name}</b>
            {myRole === 'gm' && (
              <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold uppercase">
                Mestre
              </span>
            )}
            <span className="flex items-center gap-1 text-sm text-slate-300">
              Convite:{' '}
              <code className="rounded bg-slate-700 px-1.5 font-mono">
                {activeMesa.inviteCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeMesa.inviteCode)
                  setNotice('Código de convite copiado!')
                }}
                title="Copiar código de convite"
                className="rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                📋
              </button>
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {members.map((m) => (
                <span
                  key={m.user_id}
                  className="flex items-center gap-1 rounded-full bg-slate-700 py-0.5 pr-1 pl-2 text-xs text-slate-200"
                >
                  {usernames[m.user_id] ?? '???'}
                  {m.role === 'gm' && (
                    <span className="text-[10px] text-purple-300">🎓</span>
                  )}
                  {myRole === 'gm' && m.user_id !== myId && (
                    <button
                      onClick={() => transferGm(m.user_id)}
                      title="Transferir o cargo de Mestre para este membro"
                      className="ml-1 rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold hover:bg-purple-600"
                    >
                      Tornar Mestre
                    </button>
                  )}
                  {myRole === 'gm' && m.user_id !== myId && (
                    <button
                      onClick={() => kickMember(m.user_id)}
                      title="Expulsar este membro da mesa"
                      className="ml-1 rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold hover:bg-red-600"
                    >
                      Expulsar
                    </button>
                  )}
                </span>
              ))}
              <button
                onClick={leaveMesa}
                title="Sair desta mesa"
                className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold hover:bg-red-600"
              >
                Sair da mesa
              </button>
            </div>
          </div>

          <ErrorBoundary label="Batedores">
            <ScoutRollWidget mesaId={activeMesa.id} myTrainer={myActiveTrainer} />
          </ErrorBoundary>

          {myRole === 'gm' && (
            <ErrorBoundary label="Ferramentas do Mestre">
              <GmToolsPanel
                mesaId={activeMesa.id}
                myId={myId}
                members={members}
                usernames={usernames}
                gmPokemonSheets={myPokemonSheets}
              />
            </ErrorBoundary>
          )}

          <ErrorBoundary label="Ordem de Combate">
            <BattleTracker
              mesaId={activeMesa.id}
              myId={myId}
              myPokemonSheets={myOwnPokemonSheets}
              myTrainer={myActiveTrainer}
              myUsername={usernames[myId] ?? 'você'}
              sharedNpcs={sharedNpcs}
              isGm={myRole === 'gm'}
            />
          </ErrorBoundary>

          <ErrorBoundary label="Captura">
            <CaptureRoll
              mesaId={activeMesa.id}
              myTrainer={myActiveTrainer}
              myPokemonSheets={myOwnPokemonSheets}
              sharedNpcs={sharedNpcs}
              isGm={myRole === 'gm'}
            />
          </ErrorBoundary>

          {/* Presentes do Mestre — Pokémon e itens que ele te mandou. A
              criação fica em "Ferramentas do Mestre" → 🎁 Presentear. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ErrorBoundary label="Presentes de Pokémon">
              <SheetTransfers
                mesaId={activeMesa.id}
                myId={myId}
                myActiveTrainerId={myActiveTrainer?.id}
                usernames={usernames}
              />
            </ErrorBoundary>
            <ErrorBoundary label="Presentes de item">
              <ItemGifts
                mesaId={activeMesa.id}
                myId={myId}
                myTrainer={myActiveTrainer}
                usernames={usernames}
              />
            </ErrorBoundary>
          </div>

          <ErrorBoundary label="Passar o dia">
            <DayPassPanel myTrainer={myActiveTrainer} myPokemonSheets={myOwnPokemonSheets} />
          </ErrorBoundary>

          <ErrorBoundary label="Loja">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShopOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3 text-left font-bold text-slate-800"
              >
                🛒 Loja {myActiveTrainer && `· ${myActiveTrainer.money ?? 0} P$`}
                <span className="text-sm text-slate-400">{shopOpen ? '▲' : '▼'}</span>
              </button>
              {shopOpen && (
                <div className="border-t border-slate-100 p-5">
                  {!myActiveTrainer ? (
                    <p className="text-sm text-slate-400">
                      Crie um Treinador e marque como ativo (★) pra usar a loja.
                    </p>
                  ) : (
                    <Shop
                      money={myActiveTrainer.money ?? 0}
                      inventory={myActiveTrainer.inventory ?? []}
                      onChange={updateMyTrainerEconomy}
                      customItems={customShopItems}
                    />
                  )}
                </div>
              )}
            </div>
          </ErrorBoundary>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Chat */}
            <div className="flex h-96 flex-col rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <div
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 space-y-2 overflow-y-auto p-4"
              >
                {messages.map((m) => {
                  const isWarning = m.kind === 'chat' && m.content.startsWith('⚠️')
                  return (
                    <div
                      key={m.id}
                      className={`text-sm ${
                        isWarning
                          ? 'rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5'
                          : ''
                      }`}
                    >
                      <span
                        className="font-bold"
                        style={{ color: colorForUser(m.user_id) }}
                      >
                        {usernames[m.user_id] ?? '???'}
                      </span>{' '}
                      {m.kind === 'roll' && m.roll ? (
                        (() => {
                          const { actor, rest } = splitRollLabel(
                            m.content,
                            `${m.roll.pool}d6`,
                          )
                          return (
                            <span className="text-slate-600">
                              {actor && (
                                <>
                                  <span className="font-semibold text-indigo-600">
                                    {actor}
                                  </span>{' '}
                                </>
                              )}
                              rolou <b>{rest}</b>:{' '}
                              <span className="inline-block align-middle">
                                <DiceRow
                                  r={{
                                    label: '',
                                    at: 0,
                                    pool: m.roll.pool,
                                    dice: m.roll.dice,
                                    successes: m.roll.successes,
                                    sixes: m.roll.sixes,
                                    mode: m.roll.mode,
                                    triggered: m.roll.triggered,
                                    bonus: m.roll.bonus,
                                    total: m.roll.total,
                                  }}
                                />
                              </span>
                            </span>
                          )
                        })()
                      ) : (
                        <span
                          className={isWarning ? 'font-semibold text-amber-800' : 'text-slate-600'}
                        >
                          {m.content}
                        </span>
                      )}
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Mensagem para a mesa..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-red-400 focus:outline-none"
                />
                <button
                  onClick={sendChat}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700"
                >
                  Enviar
                </button>
              </div>
            </div>

            {/* Rolagem rápida + fichas compartilhadas */}
            <div className="space-y-4">
              <QuickRollCard />
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 font-bold text-slate-800">
                  Fichas da mesa
                </h2>
                {sharedSheets.length === 0 && (
                  <p className="text-sm text-slate-400">
                    Nenhuma ficha compartilhada.
                  </p>
                )}
                <div className="space-y-1.5">
                  {sharedSheets.map((s) => {
                    const p = s.payload as Record<string, any>
                    const label =
                      s.kind === 'pokemon'
                        ? String(
                            p.nickname ||
                              pokemonById.get(String(p.species))?.name ||
                              'Pokémon',
                          )
                        : `${p.name} (Treinador)`
                    // Pokémon selvagem/de ginásio (isNpc): só o Mestre que
                    // publicou pode abrir a ficha e ver atributos como
                    // Def/Sp.Def — pro jogador aparece só o nome, sem clique,
                    // pra não estragar surpresa de captura/ginásio.
                    const isNpc = s.kind === 'pokemon' && Boolean(p.isNpc)
                    const canView = s.owner_id === myId || !isNpc
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        {canView ? (
                          <button
                            onClick={() => setViewing(s)}
                            className="flex-1 truncate rounded-lg border border-slate-200 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            {label}
                            <span className="ml-1 text-xs text-slate-400">
                              · {usernames[s.owner_id] ?? '?'}
                            </span>
                          </button>
                        ) : (
                          <span
                            title="Ficha do Mestre — atributos ficam ocultos até a captura"
                            className="flex-1 truncate rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400"
                          >
                            🔒 {label}
                            <span className="ml-1 text-xs text-slate-400">
                              · {usernames[s.owner_id] ?? '?'}
                            </span>
                          </span>
                        )}
                        {s.owner_id === myId && (
                          <button
                            onClick={() => unshareSheet(s.id)}
                            title="Parar de compartilhar"
                            className="text-slate-300 hover:text-red-500"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 font-bold text-slate-800">
                  Compartilhar minhas fichas
                </h2>
                <div className="space-y-1.5 text-sm">
                  {myTrainers.map((t) => (
                    <button
                      key={`t${t.id}`}
                      onClick={() => shareSheet('trainer', t.id!)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-left text-slate-600 hover:bg-slate-50"
                    >
                      {t.name}{' '}
                      <span className="text-xs text-slate-400">
                        (Treinador) — publicar/atualizar
                      </span>
                    </button>
                  ))}
                  {myPokemonSheets.map((s) => (
                    <button
                      key={`p${s.id}`}
                      onClick={() => shareSheet('pokemon', s.id!)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-left text-slate-600 hover:bg-slate-50"
                    >
                      {s.nickname || pokemonById.get(s.species)?.name}{' '}
                      <span className="text-xs text-slate-400">
                        — publicar/atualizar
                      </span>
                    </button>
                  ))}
                  {myTrainers.length === 0 && myPokemonSheets.length === 0 && (
                    <p className="text-slate-400">
                      Crie fichas em "Treinadores" e "Meus Pokémon".
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <ErrorBoundary label="Anotações da Mesa">
            <MesaNotes mesaId={activeMesa.id} />
          </ErrorBoundary>
        </>
      )}

      {viewing && (
        <SheetViewer
          sheet={viewing}
          username={usernames[viewing.owner_id] ?? '?'}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
