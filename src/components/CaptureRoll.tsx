import { useState } from 'react'
import type { PokemonSheet, Trainer, Rank } from '../types'
import { RANKS } from '../types'
import { sheetAttrValue } from './MoveRoll'
import { rollDice, DiceRow, type RollResult } from './DiceRoller'
import { useMesa } from '../lib/mesa'
import { pokemonById } from '../data'
import {
  POKEBALLS,
  CAPTURE_REQUIRED_SUCCESSES,
  parseWeightKg,
  captureBonusSuccesses,
  captureOutcome,
} from '../lib/capture'

const inputCls =
  'w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-bold focus:border-red-400 focus:outline-none'
const selectCls =
  'rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-400 focus:outline-none'

export default function CaptureRoll({
  myTrainer,
  sharedNpcs,
}: {
  myTrainer: Trainer | undefined
  sharedNpcs: Array<{ id: string; ownerId: string; payload: PokemonSheet }>
}) {
  const { postRoll, session, activeMesa } = useMesa()

  const [targetKey, setTargetKey] = useState('')
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
  const [lastSeal, setLastSeal] = useState<RollResult | null>(null)

  const ball = POKEBALLS.find((b) => b.id === ballId)!
  const targetName = targetKey
    ? (() => {
        const n = sharedNpcs.find((s) => s.id === targetKey)
        if (!n) return ''
        const sp = pokemonById.get(n.payload.species)
        return n.payload.nickname || sp?.name || '?'
      })()
    : 'alvo manual'

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

  const throwPool = myTrainer
    ? Math.max(0, sheetAttrValue(myTrainer, throwAttr) + (myTrainer.skills['Throw'] ?? 0))
    : 0

  const rollThrow = () => {
    if (!myTrainer) return
    const r = rollDice(
      Math.max(1, throwPool),
      `${myTrainer.name} · Arremesso (${ball.label}) vs ${targetName}`,
    )
    setLastThrow(r)
    postRoll(r)
  }

  const rollSeal = () => {
    const r = rollDice(
      Math.max(0, sealPool()),
      `${myTrainer?.name ?? 'Selo'} · Selo da ${ball.label} vs ${targetName} (+${bonus} bônus)`,
    )
    setLastSeal(r)
    postRoll(r)
  }

  const totalSuccesses = (lastSeal?.successes ?? 0) + bonus
  const outcome = lastSeal && required != null ? captureOutcome(totalSuccesses, required) : null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-white">
        <b>🎯 Captura</b>
        <span className="ml-auto text-xs opacity-80">Arremesso + Selo da Pokébola</span>
      </div>

      <div className="space-y-3 p-4">
        {!myTrainer && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Selecione um Treinador ativo em "Treinadores" para rolar Arremesso.
          </p>
        )}

        <div>
          <p className="mb-1 text-xs font-bold text-slate-500 uppercase">Alvo</p>
          <div className="flex flex-wrap gap-1.5">
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
        </div>

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
        </div>

        <div>
          <p className="mb-1 text-xs font-bold text-slate-500 uppercase">Pokébola</p>
          <select
            value={ballId}
            onChange={(e) => setBallId(e.target.value)}
            className={`${selectCls} w-full`}
          >
            {POKEBALLS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">{ball.hint}</p>

          <div className="mt-2 flex flex-wrap items-end gap-3">
            {ball.kind === 'fast' && (
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
            {ball.kind === 'heavy' && (
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
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
              Selo: {Math.max(0, sealPool())}d6
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              Bônus: +{bonus} (HP +{hpBonus}, status +{statusBonus})
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
            disabled={!myTrainer}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Rolar Arremesso ({throwPool}d6)
          </button>
          <button
            onClick={rollSeal}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Rolar Selo ({Math.max(0, sealPool())}d6)
          </button>
        </div>

        {lastThrow && (
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="mb-1 text-xs font-semibold text-slate-600">Arremesso</p>
            <DiceRow r={lastThrow} />
          </div>
        )}

        {lastSeal && (
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="mb-1 text-xs font-semibold text-slate-600">
              Selo — {lastSeal.successes} + {bonus} bônus = {totalSuccesses} sucessos
            </p>
            <DiceRow r={lastSeal} />
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
            {outcome === 'success' &&
              (curHp <= 0
                ? '🎉 Capturado! (por desmaio — Felicidade 0 / Lealdade 0)'
                : '🎉 Capturado! (Felicidade 2 / Lealdade 1)')}
            {outcome === 'critical-fail' && '💥 Falha crítica — a bola foi destruída'}
            {outcome === 'escape' && '💨 Escapou — a bola pode ser recuperada'}
          </div>
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
