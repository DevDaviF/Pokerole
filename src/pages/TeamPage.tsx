import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import type { PokemonSheet } from '../types'
import { pokemonById, moveById, spriteUrl, typeColor } from '../data'
import TypeBadge from '../components/TypeBadge'
import { getActiveTrainerId } from './TrainersPage'
import { MoveRollPanel } from '../components/MoveRoll'
import TrainingPointsBadge from '../components/TrainingPoints'
import SkillRoll from '../components/SkillRoll'
import { DAYS_TO_WAKE_UP } from '../components/DayPassPanel'

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const color =
    pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function TeamPage() {
  const activeTrainerId = getActiveTrainerId()
  const [openMove, setOpenMove] = useState<{
    sheetId: number
    moveId: string
  } | null>(null)
  const [openSkill, setOpenSkill] = useState<number | null>(null)
  const trainer = useLiveQuery(
    () => (activeTrainerId ? db.trainers.get(activeTrainerId) : undefined),
    [activeTrainerId],
  )
  const sheets =
    useLiveQuery(
      () =>
        activeTrainerId
          ? db.pokemonSheets
              .where('trainerId')
              .equals(activeTrainerId)
              .toArray()
          : Promise.resolve([] as PokemonSheet[]),
      [activeTrainerId],
    ) ?? []

  const team = sheets.filter((s) => s.inTeam).slice(0, 6)
  const reserve = sheets.filter((s) => !s.inTeam)

  const toggleTeam = async (sheet: PokemonSheet) => {
    if (!sheet.inTeam && team.length >= 6) return
    await db.pokemonSheets.update(sheet.id!, { inTeam: !sheet.inTeam })
  }

  if (!activeTrainerId || !trainer) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Nenhum treinador ativo. Marque um com a ★ na página de{' '}
        <Link to="/trainers" className="text-red-600 underline">
          Treinadores
        </Link>
        .
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          Time de {trainer.name}
        </h1>
        <span className="text-sm text-slate-500">
          {team.length}/6 no time
        </span>
      </div>

      {team.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
          Time vazio. Adicione Pokémon do computador abaixo (ou crie fichas em
          "Meus Pokémon").
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((s) => {
            const sp = pokemonById.get(s.species)
            if (!sp) return null
            const maxHp = sp.baseHp + s.attributes.vitality
            return (
              <div
                key={s.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div
                  className="flex items-center gap-3 px-4 py-2 text-white"
                  style={{ backgroundColor: typeColor(sp.types[0]) }}
                >
                  <img
                    src={spriteUrl(sp.id)}
                    alt=""
                    className="h-10 w-10 object-contain [image-rendering:pixelated]"
                    onError={(e) =>
                      (e.currentTarget.style.visibility = 'hidden')
                    }
                  />
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">
                      {s.nickname || sp.name}
                    </h2>
                    <div className="flex gap-1">
                      {sp.types.map((t) => (
                        <TypeBadge key={t} type={t} size="sm" />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleTeam(s)}
                    title="Mandar para o computador"
                    className="ml-auto rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30"
                  >
                    ↩
                  </button>
                </div>
                <div className="space-y-2 p-4">
                  {/* Só leitura de propósito — HP não muda por um +/- livre
                      aqui. Sobe/desce via Ordem de Combate (na Mesa),
                      Passar o Dia ou Centro Pokémon, nunca de graça pelo
                      próprio jogador. */}
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>HP</span>
                      <span className="font-bold text-slate-700">
                        {s.currentHp}/{maxHp}
                      </span>
                    </div>
                    <HpBar current={s.currentHp} max={maxHp} />
                  </div>
                  <TrainingPointsBadge sheet={s} />
                  {s.currentHp <= 0 && (
                    <span
                      className="inline-block w-fit rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white"
                      title={`Acorda sozinho com 1 HP depois de ${DAYS_TO_WAKE_UP} dias desmaiado (Passar o Dia), ou na hora num Centro Pokémon.`}
                    >
                      💀 Desmaiado · {s.daysFainted ?? 0}/{DAYS_TO_WAKE_UP} dias
                    </span>
                  )}
                  {s.statusConditions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.statusConditions.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    {s.knownMoves.map((mid) => {
                      const isOpen =
                        openMove?.sheetId === s.id && openMove?.moveId === mid
                      return (
                        <button
                          key={mid}
                          onClick={() => {
                            setOpenMove(
                              isOpen ? null : { sheetId: s.id!, moveId: mid },
                            )
                            setOpenSkill(null)
                          }}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isOpen
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Clique para rolar este golpe"
                        >
                          {moveById.get(mid)?.name}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => {
                        setOpenSkill(openSkill === s.id ? null : s.id!)
                        setOpenMove(null)
                      }}
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        openSkill === s.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      }`}
                      title="Rolar Atributo + Skill (Iniciativa, Evasion, Clash, Insight+Alert...)"
                    >
                      🎲 Perícia
                    </button>
                  </div>
                  {(() => {
                    if (!openMove || openMove.sheetId !== s.id) return null
                    const mv = moveById.get(openMove.moveId)
                    return mv ? (
                      <MoveRollPanel
                        sheet={s}
                        move={mv}
                        displayName={s.nickname || sp.name}
                      />
                    ) : null
                  })()}
                  {openSkill === s.id && (
                    <SkillRoll
                      sheet={s}
                      displayName={s.nickname || sp.name}
                      isPokemon
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {reserve.length > 0 && (
        <div>
          <h2 className="mb-3 font-bold text-slate-700">Computador</h2>
          <div className="flex flex-wrap gap-2">
            {reserve.map((s) => {
              const sp = pokemonById.get(s.species)
              return (
                <button
                  key={s.id}
                  onClick={() => toggleTeam(s)}
                  disabled={team.length >= 6}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:border-red-300 disabled:opacity-40"
                  title="Adicionar ao time"
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
                  <span className="text-xs text-slate-400">+ time</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
