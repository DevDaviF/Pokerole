import { useState } from 'react'
import { useMesa } from '../lib/mesa'
import { supabase } from '../lib/supabase'

// Manda um texto (descrição de habilidade/golpe etc) pro chat da mesa
// ativa — só aparece quando o usuário está numa mesa de verdade.
export default function SendToChatButton({ text }: { text: string }) {
  const { session, activeMesa } = useMesa()
  const [sent, setSent] = useState(false)

  if (!activeMesa || !session) return null

  const send = async () => {
    if (!supabase) return
    await supabase.from('messages').insert({
      mesa_id: activeMesa.id,
      user_id: session.user.id,
      kind: 'chat',
      content: text,
    })
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  return (
    <button
      onClick={send}
      title="Mandar essa descrição pro chat da mesa"
      className="rounded-lg border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
    >
      {sent ? '✓ Enviado!' : '📤 Chat'}
    </button>
  )
}
