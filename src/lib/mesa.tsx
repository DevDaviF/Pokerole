/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { syncDbScope } from '../db'
import type { RollResult } from '../components/DiceRoller'

export interface ActiveMesa {
  id: string
  name: string
  inviteCode: string
}

interface StoredActiveMesa {
  mesa: ActiveMesa
  userId: string
}

interface MesaContextValue {
  session: Session | null
  activeMesa: ActiveMesa | null
  setActiveMesa: (m: ActiveMesa | null) => void
  postRoll: (r: RollResult) => void
  passwordRecovery: boolean
  clearPasswordRecovery: () => void
}

const MesaContext = createContext<MesaContextValue>({
  session: null,
  activeMesa: null,
  setActiveMesa: () => {},
  postRoll: () => {},
  passwordRecovery: false,
  clearPasswordRecovery: () => {},
})

export const useMesa = () => useContext(MesaContext)

export function MesaProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // começa null de propósito: só restauramos do localStorage depois de
  // saber de quem é a sessão (ver applySession) — Dexie/localStorage são
  // por origem, não por conta, então sem essa checagem uma conta nova no
  // mesmo navegador "herdava" a mesa ativa da conta anterior
  const [activeMesa, setActiveMesaState] = useState<ActiveMesa | null>(null)

  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return

    const applySession = (s: Session | null) => {
      setSession(s)
      // fichas locais (Dexie) também são isoladas por conta — ver db.ts.
      // Numa troca de conta de verdade isso recarrega a página; não faz
      // sentido continuar restaurando a mesa ativa nesse caso.
      void syncDbScope(s ? s.user.id : 'guest')
      try {
        const raw = localStorage.getItem('activeMesa')
        if (!raw) return
        const stored = JSON.parse(raw) as StoredActiveMesa
        if (s && stored.userId === s.user.id) {
          setActiveMesaState(stored.mesa)
        } else {
          localStorage.removeItem('activeMesa')
          setActiveMesaState(null)
        }
      } catch {
        localStorage.removeItem('activeMesa')
      }
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      applySession(s)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const setActiveMesa = (m: ActiveMesa | null) => {
    setActiveMesaState(m)
    if (m && session) {
      localStorage.setItem(
        'activeMesa',
        JSON.stringify({ mesa: m, userId: session.user.id } as StoredActiveMesa),
      )
    } else {
      localStorage.removeItem('activeMesa')
    }
  }

  const postRoll = (r: RollResult) => {
    if (!supabase || !session || !activeMesa) return
    // atenção: a query do supabase-js só executa no await/.then
    supabase
      .from('messages')
      .insert({
        mesa_id: activeMesa.id,
        user_id: session.user.id,
        kind: 'roll',
        content: r.label,
        roll: {
          pool: r.pool,
          dice: r.dice,
          successes: r.successes,
          sixes: r.sixes,
          ...(r.icon ? { icon: r.icon } : {}),
          ...(r.mode === 'chance' ? { mode: r.mode, triggered: r.triggered } : {}),
          ...(r.mode === 'additive'
            ? { mode: r.mode, bonus: r.bonus, total: r.total }
            : {}),
        },
      })
      .then(({ error }) => {
        if (error) console.error('Roll não enviado à mesa:', error.message)
      })
  }

  return (
    <MesaContext.Provider
      value={{
        session,
        activeMesa,
        setActiveMesa,
        postRoll,
        passwordRecovery,
        clearPasswordRecovery: () => setPasswordRecovery(false),
      }}
    >
      {children}
    </MesaContext.Provider>
  )
}
