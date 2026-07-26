import { useState } from 'react'
import type { PokemonSheet, Trainer, Rank } from '../types'
import { RANKS } from '../types'
import { db } from '../db'
import { supabase } from '../lib/supabase'
import { sheetAttrValue } from './MoveRoll'
import { rollDice, DiceRow, type RollResult } from './DiceRoller'
import { useMesa } from '../lib/mesa'
import { pokemonById } from '../data'
import { DEFAULT_AVATAR } from './ImagePicker'
import {
  POKEBALLS,
  CAPTURE_REQUIRED_SUCCESSES,
  parseWeightKg,
  captureBonusSuccesses,
  captureOutcome,
  useCaptureBonusMode,
  setCaptureBonusMode,
  type CaptureOutcome,
} from '../lib/capture'

const inputCls =
  'w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-bold focus:border-red-400 focus:outline-none'
const selectCls =
  'rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none'

export default function CaptureRoll({
  mesaId,
  myTrainer,
  myPokemonSheets,
  sharedNpcs,
  isGm,
}: {
  mesaId: string
  myTrainer: Trainer | undefined
  myPokemonSheets: PokemonSheet[]
  sharedNpcs: Array<{ id: string; ownerId: string; payload: PokemonSheet }>
  isGm: boolean
}) {
  const { postRoll, session, activeMesa } = useMesa()
  const bonusMode = useCaptureBonusMode(mesaId)

  const [targetKey, setTargetKey] = useState('')
  // Estes valores só ficam visíveis na tela pro Mestre (isGm) — pro jogador
  // eles são usados só internamente pra calcular o bônus, nunca exibidos.
  const [rank, setRank] = useState<Rank>('Standard')
  const [curHp, setCurHp] = useState(1)
  const [maxHp, setMaxHp] = useState(1)
  const [statusCount, setStatusCount] = useState(0)
  const [targetDex, setTargetDex] = useState(0)
  const [targetWeightKg, setTargetWeightKg] = useState(0)

  const [ballId, setBallId] = useState('pokeball')
  const [manualPool, setManualPool] = useState(4)
  const [round, setRound] = useState(1)
  const [duskBase, setDuskBase] = useState(0)
  const [duskCave, setDuskCave] = useState(false)
  const [duskNight, setDuskNight] = useState(false)
  const [requiredOverride, setRequiredOverride] = useState<number | null>(null)

  const [throwAttr, setThrowAttr] = useState<'Dexterity' | 'Strength'>('Dexterity')
  const [lastThrow, setLastThrow] = useState<RollResult | null>(null)
  const [lastCapture, setLastCapture] = useState<RollResult | null>(null)
  const [outcome, setOutcome] = useState<CaptureOutcome | null>(null)
  const [afterNote, setAfterNote] = useState('')

  const ball = POKEBALLS.find((b) => b.id === ballId)!
  const targetName = targetKey
    ? (() => {
        const n = sharedNpcs.find((s) => s.id === targetKey)
        if (!n) return ''
        const sp = pokemonById.get(n.payload.species)
        return n.payload.nickname || sp?.name || '?'
      })()
    : 'alvo manual'

  const ballQty = myTrainer?.inventory?.find((e) => e.itemId === ballId)?.qty ?? 0

  const pickTarget = (id: string) => {
    setTargetKey(id)
    if (!id) return
    const n = sharedNpcs.find((s) => s.id === id)
    if (!n) return
    const sp = pokemonById.get(n.payload.species)
    setRank(n.payload.rank)
    const mh = (sp?.baseHp ?? 1) + n.payload.attributes.vitality
    setMaxHp(mh)
    setCurHp(n.payload.currentHp)
    setStatusCount(n.payload.statusConditions.length)
    setTargetDex(n.payload.attributes.dexterity)
    setTargetWeightKg(sp ? parseWeightKg(sp.weight) : 0)
    setRequiredOverride(null)
    setLastThrow(null)
    setLastCapture(null)
    setOutcome(null)
    setAfterNote('')
  }

  const sealPool = () => {
    switch (ball.kind) {
      case 'fixed':
        return ball.basePotency ?? 0
      case 'fast':
        return Math.min(9, targetDex)
      case 'heavy':
        return Math.min(5, Math.floor(targetWeightKg / 25))
      case 'quick':
        return Math.max(0, 9 - 2 * Math.max(0, round - 1))
      case 'dusk':
        return duskBase + (duskCave ? 4 : 0) + (duskNight ? 5 : 0)
      case 'manual':
      default:
        return manualPool
    }
  }

  const { hpBonus, statusBonus, total: bonus } = captureBonusSuccesses(
    curHp,
    maxHp,
    statusCount,
  )
  const required = requiredOverride ?? CAPTURE_REQUIRED_SUCCESSES[rank] ?? null

  // Modo "dice": o bônus vira dados extras somados à pool antes de rolar
  // (só conta se cair 4+, como qualquer dado). Modo "flat": o bônus soma
  // direto nos sucessos depois da rolagem — comportamento antigo.
  const rollPool = () =>
    Math.max(0, sealPool()) + (bonusMode === 'dice' ? bonus : 0)

  const throwPool = myTrainer
    ? Math.max(0, sheetAttrValue(myTrainer, throwAttr) + (myTrainer.skills['Throw'] ?? 0))
    : 0

  const rollThrow = () => {
    if (!myTrainer || ballQty <= 0) return
    const r = rollDice(
      Math.max(1, throwPool),
      `${myTrainer.name} · Arremesso (${ball.label}) vs ${targetName}`,
    )
    r.icon = myTrainer.imageUrl || DEFAULT_AVATAR
    setLastThrow(r)
    postRoll(r)
  }

  const consumeBall = async () => {
    if (!myTrainer?.id) return
    const inv = (myTrainer.inventory ?? [])
      .map((e) => (e.itemId === ballId ? { ...e, qty: e.qty - 1 } : e))
      .filter((e) => e.qty > 0)
    await db.trainers.update(myTrainer.id, { inventory: inv })
  }

  const rollCapture = async () => {
    if (ballQty <= 0) return
    if (!targetKey && !isGm) return
    const r = rollDice(
      rollPool(),
      `${myTrainer?.name ?? 'Treinador'} · Captura (${ball.label}) vs ${targetName}`,
    )
    r.icon = myTrainer?.imageUrl || DEFAULT_AVATAR
    setLastCapture(r)
    postRoll(r)
    setOutcome(null)
    setAfterNote('')

    if (required == null) return
    const total = bonusMode === 'dice' ? r.successes : r.successes + bonus
    const result = captureOutcome(total, required)
    setOutcome(result)

    const resultText =
      result === 'success'
        ? `🎉 Captura bem-sucedida! ${targetName} foi capturado(a) com a ${ball.label} (${total}/${required} sucessos).`
        : result === 'critical-fail'
          ? `💥 Falha crítica na captura de ${targetName} — a ${ball.label} foi destruída (${total}/${required} sucessos).`
          : `💨 ${targetName} escapou da ${ball.label} (${total}/${required} sucessos) — a bola pode ser recuperada.`

    if (supabase && session && activeMesa) {
      await supabase.from('messages').insert({
        mesa_id: activeMesa.id,
        user_id: session.user.id,
        kind: 'chat',
        content: resultText,
      })
    }

    // a bola quebra numa falha crítica ou é usada numa captura bem-sucedida;
    // só sobrevive (recuperável) se o alvo escapar
    if (result === 'success' || result === 'critical-fail') await consumeBall()

    if (result === 'success' && targetKey && myTrainer?.id) {
      const n = sharedNpcs.find((s) => s.id === targetKey)
      if (n) {
        const payload = { ...n.payload } as Partial<PokemonSheet>
        delete payload.id
        const teamCount = myPokemonSheets.filter(
          (s) => s.trainerId === myTrainer.id && s.inTeam,
        ).length
        const joinsTeam = teamCount < 6
        await db.pokemonSheets.add({
          ...(payload as PokemonSheet),
          trainerId: myTrainer.id,
          isNpc: false,
          npcKind: undefined,
          inTeam: joinsTeam,
        })
        setAfterNote(
          `✅ ${targetName} foi ${joinsTeam ? 'direto pro seu time' : 'adicionado a "Meus Pokémon"'}! Peça ao Mestre para remover a ficha selvagem da mesa.`,
        )
      }
    }
  }

  const totalSuccesses =
    bonusMode === 'dice' ? (lastCapture?.successes ?? 0) : (lastCapture?.successes ?? 0) + bonus

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-white">
        <b>🎯 Captura</b>
        <span className="ml-auto text-xs opacity-80">Arremesso + Captura da Pokébola</span>
      </div>

      <div className="space-y-3 p-4">
        {!myTrainer && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Selecione um Treinador ativo em "Treinadores" para rolar Arremesso.
          </p>
        )}

        {isGm && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
            <span>Bônus de captura conta como</span>
            <div className="flex gap-1 rounded-full bg-slate-200 p-0.5">
              {(['dice', 'flat'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCaptureBonusMode(mesaId, m)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    bonusMode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {m === 'dice' ? 'dados extras' : 'modificador'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-bold text-slate-500 uppercase">Alvo</p>
          <div className="flex flex-wrap gap-1.5">
            {isGm && (
              <button
                onClick={() => pickTarget('')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  targetKey === ''
                    ? 'border-transparent bg-slate-800 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Manual
              </button>
            )}
            {sharedNpcs.map((n) => {
              const sp = pokemonById.get(n.payload.species)
              return (
                <button
                  key={n.id}
                  onClick={() => pickTarget(n.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    targetKey === n.id
                      ? 'border-transparent bg-slate-800 text-white'
                      : 'border-purple-200 text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  {n.payload.nickname || sp?.name} · {n.payload.rank}
                </button>
              )
            })}
          </div>
          {sharedNpcs.length === 0 && !isGm && (
            <p className="mt-1 text-xs text-slate-400">
              Nenhum Pokémon selvagem publicado pelo Mestre ainda.
            </p>
          )}
        </div>

        {isGm && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-2.5">
            <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
              Rank do alvo
              <select
                value={rank}
                onChange={(e) => {
                  setRank(e.target.value as Rank)
                  setRequiredOverride(null)
                }}
                className={selectCls}
              >
                {RANKS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
              HP atual
              <input
                type="number"
                value={curHp}
                onChange={(e) => setCurHp(Number(e.target.value) || 0)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
              HP máx.
              <input
                type="number"
                value={maxHp}
                onChange={(e) => setMaxHp(Number(e.target.value) || 1)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
              Condições de status ativas
              <input
                type="number"
                value={statusCount}
                onChange={(e) => setStatusCount(Number(e.target.value) || 0)}
                className={inputCls}
              />
            </label>
            <div className="text-xs text-slate-500">
              Sucessos necessários:{' '}
              {required != null ? (
                <b className="text-slate-700">{required}</b>
              ) : (
                <span className="text-amber-600">não definido no livro — </span>
              )}
              <input
                type="number"
                placeholder={required != null ? String(required) : '?'}
                value={requiredOverride ?? ''}
                onChange={(e) =>
                  setRequiredOverride(e.target.value === '' ? null : Number(e.target.value))
                }
                className={`${inputCls} ml-1 w-12`}
              />
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              🔒 Bônus: +{bonus} (HP +{hpBonus}, status +{statusBonus})
            </span>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase">Pokébola</p>
            <span
              className={`text-xs font-semibold ${ballQty > 0 ? 'text-slate-500' : 'text-red-500'}`}
            >
              {ballQty} no inventário
            </span>
          </div>
          <select
            value={ballId}
            onChange={(e) => setBallId(e.target.value)}
            className={`${selectCls} w-full`}
          >
            {POKEBALLS.map((b) => {
              const owned = myTrainer?.inventory?.find((e) => e.itemId === b.id)?.qty ?? 0
              return (
                <option key={b.id} value={b.id}>
                  {b.label} ({owned})
                </option>
              )
            })}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">{ball.hint}</p>

          <div className="mt-2 flex flex-wrap items-end gap-3">
            {isGm && ball.kind === 'fast' && (
              <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
                Destreza do alvo
                <input
                  type="number"
                  value={targetDex}
                  onChange={(e) => setTargetDex(Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </label>
            )}
            {isGm && ball.kind === 'heavy' && (
              <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
                Peso do alvo (kg)
                <input
                  type="number"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </label>
            )}
            {ball.kind === 'quick' && (
              <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
                Rodada atual
                <input
                  type="number"
                  min={1}
                  value={round}
                  onChange={(e) => setRound(Math.max(1, Number(e.target.value) || 1))}
                  className={inputCls}
                />
              </label>
            )}
            {ball.kind === 'dusk' && (
              <>
                <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
                  Base
                  <input
                    type="number"
                    value={duskBase}
                    onChange={(e) => setDuskBase(Number(e.target.value) || 0)}
                    className={inputCls}
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={duskCave}
                    onChange={(e) => setDuskCave(e.target.checked)}
                  />
                  Em caverna (+4)
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={duskNight}
                    onChange={(e) => setDuskNight(e.target.checked)}
                  />
                  É noite (+5)
                </label>
              </>
            )}
            {ball.kind === 'manual' && (
              <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
                Potência do selo (dados)
                <input
                  type="number"
                  value={manualPool}
                  onChange={(e) => setManualPool(Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </label>
            )}
            <span
              className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700"
              title={
                isGm
                  ? undefined
                  : 'A quantidade de dados denunciaria atributos ocultos do alvo (Destreza, HP, status) — só o Mestre vê antes de rolar'
              }
            >
              Captura: {isGm ? `${rollPool()}d6` : '🔒 oculto'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3">
          <select
            value={throwAttr}
            onChange={(e) => setThrowAttr(e.target.value as 'Dexterity' | 'Strength')}
            className={selectCls}
          >
            <option value="Dexterity">Destreza</option>
            <option value="Strength">Força</option>
          </select>
          <span className="text-xs text-slate-400">+ Arremesso</span>
          <button
            onClick={rollThrow}
            disabled={!myTrainer || ballQty <= 0}
            title={ballQty <= 0 ? 'Você não tem essa Pokébola no inventário' : ''}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Rolar Arremesso ({throwPool}d6)
          </button>
          <button
            onClick={rollCapture}
            disabled={ballQty <= 0 || (!targetKey && !isGm)}
            title={ballQty <= 0 ? 'Você não tem essa Pokébola no inventário' : ''}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Rolar Captura{isGm ? ` (${rollPool()}d6)` : ''}
          </button>
        </div>

        {lastThrow && (
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="mb-1 text-xs font-semibold text-slate-600">Arremesso</p>
            <DiceRow r={lastThrow} />
          </div>
        )}

        {lastCapture && (
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="mb-1 text-xs font-semibold text-slate-600">
              {isGm
                ? bonusMode === 'flat'
                  ? `Captura — ${lastCapture.successes} + ${bonus} bônus = ${totalSuccesses} sucessos`
                  : `Captura — ${totalSuccesses} sucessos (inclui bônus em dados)`
                : `Captura — ${totalSuccesses} sucessos`}
            </p>
            <DiceRow r={lastCapture} />
          </div>
        )}

        {outcome && (
          <div
            className={`rounded-lg p-3 text-center text-sm font-bold ${
              outcome === 'success'
                ? 'bg-emerald-100 text-emerald-700'
                : outcome === 'critical-fail'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {outcome === 'success' && '🎉 Capturado!'}
            {outcome === 'critical-fail' && '💥 Falha crítica — a bola foi destruída'}
            {outcome === 'escape' && '💨 Escapou — a bola pode ser recuperada'}
          </div>
        )}

        {afterNote && (
          <p className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">{afterNote}</p>
        )}

        <p className="text-[11px] text-slate-400">
          {session && activeMesa
            ? `rolls enviados à mesa "${activeMesa.name}"`
            : 'entre numa mesa para compartilhar os rolls'}
        </p>
      </div>
    </div>
  )
}
