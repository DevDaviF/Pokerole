import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { pokemonById, moveById, spriteUrl } from '../data'
import { MoveRollPanel } from './MoveRoll'
import SkillRoll from './SkillRoll'

// Selvagens/de ginásio desta mesa não aparecem em "Rolar pela ficha" (isso
// é só pro seu próprio personagem) — aqui o Mestre rola pelos NPCs: o
// Treinador NPC (Perícia) e qualquer Pokémon dele/solto gerado pra esta
// mesa (Golpes), sem precisar sair das Ferramentas do Mestre.
export default function NpcRollPanel({ mesaId }: { mesaId: string }) {
  const npcTrainers = (useLiveQuery(() => db.trainers.toArray(), []) ?? []).filter(
    (t) => t.isNpc && t.mesaId === mesaId,
  )
  const npcPokemon = (useLiveQuery(() => db.pokemonSheets.toArray(), []) ?? []).filter(
    (s) => s.isNpc && s.mesaId === mesaId,
  )

  const [trainerId, setTrainerId] = useState<number | null>(null)
  const [sheetId, setSheetId] = useState<number | null>(null)
  const [moveId, setMoveId] = useState<string | null>(null)

  const trainer = npcTrainers.find((t) => t.id === trainerId) ?? npcTrainers[0]
  const sheet = npcPokemon.find((s) => s.id === sheetId) ?? npcPokemon[0]
  const move = moveId ? moveById.get(moveId) : undefined
  const sheetOwner = sheet
    ? (npcTrainers.find((t) => t.id === sheet.trainerId)?.name ?? 'Selvagem')
    : ''
  const rollDisplayName = sheet ? `${sheetOwner} · ${sheet.nickname}` : ''

  if (npcTrainers.length === 0 && npcPokemon.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        Nenhum NPC ainda — gere selvagens/ginásio no "Encontro"/"Ginásio" ou
        crie um Treinador NPC vinculado a esta mesa em "Treinadores".
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {npcTrainers.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase">
            Treinador NPC
          </p>
          <div className="flex flex-wrap gap-1.5">
            {npcTrainers.map((t) => (
              <button
                key={t.id}
                onClick={() => setTrainerId(t.id!)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  trainer?.id === t.id
                    ? 'border-transparent bg-purple-700 text-white shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🎓 {t.name}
              </button>
            ))}
          </div>
          {trainer && (
            <div className="mt-2">
              <SkillRoll sheet={trainer} displayName={trainer.name} isPokemon={false} />
            </div>
          )}
        </div>
      )}

      {npcPokemon.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase">
            Pokémon (time de NPC + selvagens soltos)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {npcPokemon.map((s) => {
              const sp = pokemonById.get(s.species)
              const owner = npcTrainers.find((t) => t.id === s.trainerId)?.name ?? 'Selvagem'
              const selected = sheet?.id === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSheetId(s.id!)
                    setMoveId(null)
                  }}
                  title={owner}
                  className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-transparent bg-purple-700 text-white shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {sp && (
                    <img
                      src={spriteUrl(sp.id)}
                      alt=""
                      className="h-6 w-6 object-contain [image-rendering:pixelated]"
                      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                    />
                  )}
                  {s.nickname || sp?.name}
                </button>
              )
            })}
          </div>

          {sheet && (
            <div className="mt-2 space-y-2">
              <SkillRoll sheet={sheet} displayName={rollDisplayName} isPokemon={true} />
              <div className="flex flex-wrap gap-1">
                {sheet.knownMoves.map((mid) => (
                  <button
                    key={mid}
                    onClick={() => setMoveId(moveId === mid ? null : mid)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      moveId === mid
                        ? 'bg-purple-700 text-white'
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
                <MoveRollPanel sheet={sheet} move={move} displayName={rollDisplayName} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
