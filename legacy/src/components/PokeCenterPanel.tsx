import { useEffect, useState } from 'react'
import type { PokemonSheet } from '../types'
import { db } from '../db'
import { pokemonById } from '../data'
import { useMesa } from '../lib/mesa'
import { supabase } from '../lib/supabase'

interface TriggerRow {
  mesa_id: string
  triggered_at: string | null
  triggered_by: string | null
}

// Substitui o antigo botão "Descansar" solo da Tela de Time (curava de
// graça, sem custo nem aprovação de ninguém). Agora só o Mestre abre o
// Centro Pokémon pra mesa toda, e cada jogador aplica a cura completa
// na própria ficha local ao ver o gatilho mudar — mesmo mecanismo do
// Passar o Dia (Parte 12), mas sem ração, sem Rest parcial: cura 100%
// e reanima quem desmaiou, igual um Centro Pokémon de verdade (p.13:
// "leave in the morning with them an their team good as new").
export default function PokeCenterPanel({
  myPokemonSheets,
  isGm,
}: {
  myPokemonSheets: PokemonSheet[]
  isGm: boolean
}) {
  const { session, activeMesa } = useMesa()
  const [applying, setApplying] = useState(false)
  const [notice, setNotice] = useState('')
  const [trigger, setTrigger] = useState<TriggerRow | null>(null)

  const mesaId = activeMesa?.id
  const myId = session?.user.id

  useEffect(() => {
    if (!supabase || !mesaId) return
    let cancelled = false

    supabase
      .from('pokecenter_triggers')
      .select('mesa_id, triggered_at, triggered_by')
      .eq('mesa_id', mesaId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setTrigger(data as TriggerRow)
      })

    const channel = supabase
      .channel(`pokecenter-${mesaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pokecenter_triggers',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => setTrigger(payload.new as TriggerRow),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId])

  const lastAppliedKey = mesaId ? `pokecenter-applied:${mesaId}` : null
  const lastApplied = lastAppliedKey ? localStorage.getItem(lastAppliedKey) : null
  const pendingApply = Boolean(
    trigger?.triggered_at && trigger.triggered_at !== lastApplied,
  )

  const team = myPokemonSheets.filter((s) => s.inTeam)

  const announce = async (content: string) => {
    if (!session || !activeMesa || !supabase) return
    await supabase.from('messages').insert({
      mesa_id: activeMesa.id,
      user_id: session.user.id,
      kind: 'chat',
      content,
    })
  }

  const openPokeCenter = async () => {
    if (!supabase || !mesaId || !myId) return
    await supabase
      .from('pokecenter_triggers')
      .update({ triggered_at: new Date().toISOString(), triggered_by: myId })
      .eq('mesa_id', mesaId)
    await announce(
      '🏥 O Mestre abriu as portas do Centro Pokémon! O time de todo mundo foi curado.',
    )
  }

  // Diferente do Passar o Dia (que pode ter consequência real se faltar
  // ração), o Centro Pokémon é sempre 100% benéfico e de graça — sem
  // decisão nenhuma pro jogador tomar, então aplica sozinho assim que o
  // gatilho aparece, sem exigir um clique a mais.
  useEffect(() => {
    if (!pendingApply || applying || !lastAppliedKey || !trigger?.triggered_at) return
    setApplying(true)
    void (async () => {
      for (const s of team) {
        const sp = pokemonById.get(s.species)
        const maxHp = (sp?.baseHp ?? 1) + s.attributes.vitality
        await db.pokemonSheets.update(s.id!, {
          currentHp: maxHp,
          statusConditions: [],
          daysFainted: 0,
        })
      }
      localStorage.setItem(lastAppliedKey, trigger.triggered_at!)
      if (team.length > 0) setNotice('🏥 Seu time saiu do Centro Pokémon totalmente curado!')
      setApplying(false)
    })()
  }, [pendingApply, applying, lastAppliedKey, trigger, team])

  if (!isGm && myPokemonSheets.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-sky-600 px-4 py-2.5 text-white">
        <b>🏥 Centro Pokémon</b>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs text-slate-400">
          Cura completa e de graça pro time de todo mundo (recupera HP total,
          limpa status, reanima quem desmaiou) — só o Mestre decide quando
          abrir.
        </p>
        {isGm && (
          <button
            onClick={openPokeCenter}
            className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-1.5 text-sm font-bold text-sky-700 hover:bg-sky-100"
          >
            🏥 Curar o time de todos
          </button>
        )}
        {notice && <p className="text-xs text-slate-500">{notice}</p>}
      </div>
    </div>
  )
}
