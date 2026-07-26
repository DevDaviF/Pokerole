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
import type { RollResult } from '../components/DiceRoller'

export interface ActiveMesa {
  id: string
  name: string
  inviteCode: string
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
  const [activeMesa, setActiveMesaState] = useState<ActiveMesa | null>(() => {
    try {
      const raw = localStorage.getItem('activeMesa')
      return raw ? (JSON.parse(raw) as ActiveMesa) : null
    } catch {
      return null
    }
  })

  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const setActiveMesa = (m: ActiveMesa | null) => {
    setActiveMesaState(m)
    if (m) localStorage.setItem('activeMesa', JSON.stringify(m))
    else localStorage.removeItem('activeMesa')
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
