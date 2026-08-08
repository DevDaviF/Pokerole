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
import { rollAdditive, rollChanceDice, rollDice, rollSum, type RollResult } from '../components/DiceRoller'

export interface ActiveMesa {
  id: string
  name: string
  inviteCode: string
}

interface StoredActiveMesa {
  mesa: ActiveMesa
  userId: string
}

export interface RollSharedOptions {
  pool: number
  label: string
  mode?: 'chance' | 'additive' | 'sum'
  bonus?: number
  sides?: number // para mode 'sum': faces do dado (4/6/8/10/12/20/100)
  icon?: string
}

interface MesaContextValue {
  session: Session | null
  activeMesa: ActiveMesa | null
  setActiveMesa: (m: ActiveMesa | null) => void
  // Rola no SERVIDOR (RPC roll_dice_shared) quando há mesa ativa — o RNG
  // roda com random() do Postgres, fora do alcance do client, e a
  // inserção em `messages` acontece dentro da própria função. Sem mesa
  // (jogo solo/offline), rola localmente, já que não tem ninguém pra
  // "enganar" numa rolagem que só quem rolou vê. Resolve depois que a
  // mensagem já está gravada — quem precisa mandar outra mensagem LOGO
  // DEPOIS (ex: descrição de efeito de Chance Dice) pode dar await pra
  // garantir que ela vai aparecer depois no chat, não antes.
  rollShared: (opts: RollSharedOptions) => Promise<RollResult>
  passwordRecovery: boolean
  clearPasswordRecovery: () => void
}

const MesaContext = createContext<MesaContextValue>({
  session: null,
  activeMesa: null,
  setActiveMesa: () => {},
  rollShared: async (opts) => rollDice(opts.pool, opts.label),
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

  // A coluna `roll` no banco tem check(pg_column_size(roll) <= 4096) — o
  // ícone do Treinador (avatar pixel-art ou foto enviada) é um data: URI que
  // frequentemente passa de 5-13KB, bem maior que esse limite. Sprite de
  // Pokémon é só uma URL curta, por isso só o roll do Treinador quebrava:
  // o insert falhava no constraint e o erro só ia pro console, nunca pro
  // chat — o roll simplesmente sumia sem aviso nenhum. O ícone é cosmético,
  // então em vez de travar o roll inteiro só descartamos ele quando pesado
  // demais pra caber no limite da coluna.
  const MAX_ROLL_ICON_BYTES = 3000
  const iconFits = (icon?: string) =>
    Boolean(icon) && new TextEncoder().encode(icon).length <= MAX_ROLL_ICON_BYTES

  const localRoll = (opts: RollSharedOptions): RollResult => {
    if (opts.mode === 'chance') return rollChanceDice(opts.pool, opts.label)
    if (opts.mode === 'additive') return rollAdditive(opts.bonus ?? 0, opts.label)
    if (opts.mode === 'sum') return rollSum(opts.pool, opts.sides ?? 6, opts.bonus ?? 0, opts.label)
    return rollDice(opts.pool, opts.label)
  }

  const rollShared = async (opts: RollSharedOptions): Promise<RollResult> => {
    if (!supabase || !session || !activeMesa) return localRoll(opts)
    const { data, error } = await supabase.rpc('roll_dice_shared', {
      _mesa_id: activeMesa.id,
      _pool: opts.pool,
      _label: opts.label,
      _mode: opts.mode ?? 'standard',
      _bonus: opts.bonus ?? 0,
      _sides: opts.sides ?? 6,
      _icon: iconFits(opts.icon) ? opts.icon : null,
    })
    if (error || !data) {
      // Rede fora do ar ou RPC recusou (ex: não é membro da mesa) — rola
      // localmente só pra não travar a interface, mas ESSE resultado não
      // foi gravado em lugar nenhum (não aparece pros outros da mesa).
      console.error(
        'Roll não pôde ser validado no servidor, rolando localmente (não compartilhado):',
        error?.message,
      )
      return localRoll(opts)
    }
    return { label: opts.label, at: Date.now(), ...(data as object) } as RollResult
  }

  return (
    <MesaContext.Provider
      value={{
        session,
        activeMesa,
        setActiveMesa,
        rollShared,
        passwordRecovery,
        clearPasswordRecovery: () => setPasswordRecovery(false),
      }}
    >
      {children}
    </MesaContext.Provider>
  )
}
