import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MesaNotes({ mesaId }: { mesaId: string }) {
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    supabase
      .from('mesa_notes')
      .select('content, updated_at')
      .eq('mesa_id', mesaId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setContent(data.content ?? '')
        setSavedAt(data.updated_at ? new Date(data.updated_at) : null)
      })

    const channel = supabase
      .channel(`mesa-notes-${mesaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mesa_notes',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => {
          // não sobrescreve enquanto a pessoa está digitando
          if (document.activeElement === textareaRef.current) return
          const row = payload.new as { content: string; updated_at: string }
          setContent(row.content ?? '')
          setSavedAt(row.updated_at ? new Date(row.updated_at) : null)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase?.removeChannel(channel)
    }
  }, [mesaId])

  const scheduleSave = (value: string) => {
    setContent(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!supabase) return
      setSaving(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('mesa_notes')
        .update({
          content: value,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('mesa_id', mesaId)
      setSaving(false)
      if (!error) setSavedAt(new Date())
    }, 800)
  }

  const archiveSession = async () => {
    if (!supabase || !content.trim()) return
    const title = window.prompt(
      'Título desta sessão (ex: "Sessão 12 - 25/07/2026"):',
      `Sessão de ${new Date().toLocaleDateString('pt-BR')}`,
    )
    if (!title || !title.trim()) return
    setArchiving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('session_notes').insert({
      mesa_id: mesaId,
      title: title.trim().slice(0, 80),
      content,
      created_by: user?.id,
    })
    setArchiving(false)
    if (error) {
      alert(`Não deu para arquivar: ${error.message}`)
      return
    }
    if (confirm('Sessão arquivada! Limpar o quadro para a próxima sessão?')) {
      scheduleSave('')
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-amber-500 px-4 py-2.5 text-white">
        <b>📝 Anotações da Mesa</b>
        <span className="ml-auto text-xs opacity-80">
          {saving
            ? 'salvando...'
            : savedAt
              ? `salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
        </span>
        <Link
          to="/mesa/historico"
          className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold hover:bg-white/25"
        >
          📚 Histórico
        </Link>
        <button
          onClick={archiveSession}
          disabled={archiving || !content.trim()}
          className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold hover:bg-white/25 disabled:opacity-40"
        >
          {archiving ? 'arquivando...' : '🗄️ Arquivar sessão'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => scheduleSave(e.target.value)}
        placeholder="Anote pistas, NPCs, decisões da campanha... todo mundo na mesa vê e pode editar."
        rows={10}
        className="w-full resize-y border-0 p-4 text-sm text-slate-700 focus:outline-none"
      />
    </div>
  )
}
