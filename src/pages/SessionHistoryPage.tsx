import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useMesa } from '../lib/mesa'

interface SessionNote {
  id: string
  mesa_id: string
  title: string
  content: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export default function SessionHistoryPage() {
  const { session, activeMesa } = useMesa()
  const [notes, setNotes] = useState<SessionNote[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supabase || !activeMesa) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('session_notes')
      .select('*')
      .eq('mesa_id', activeMesa.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setNotice(error.message)
        setNotes((data as SessionNote[]) ?? [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeMesa])

  const remove = async (id: string) => {
    if (!supabase || !confirm('Apagar esta anotação de sessão? Não dá pra desfazer.')) return
    const { error } = await supabase.from('session_notes').delete().eq('id', id)
    if (error) setNotice(error.message)
    else setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const startEdit = (n: SessionNote) => {
    setEditing(n.id)
    setDraftTitle(n.title)
    setDraftContent(n.content)
    setOpen(n.id)
  }

  const cancelEdit = () => setEditing(null)

  const saveEdit = async (id: string) => {
    if (!supabase || !draftTitle.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('session_notes')
      .update({
        title: draftTitle.trim(),
        content: draftContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSaving(false)
    if (error) {
      setNotice(error.message)
      return
    }
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, title: draftTitle.trim(), content: draftContent } : n,
      ),
    )
    setEditing(null)
  }

  if (!supabaseConfigured) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Supabase não configurado.
      </p>
    )
  }

  if (!session) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Entre na <Link to="/mesa" className="text-red-600 hover:underline">Mesa</Link> primeiro.
      </p>
    )
  }

  if (!activeMesa) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Nenhuma mesa ativa. Volte para a{' '}
        <Link to="/mesa" className="text-red-600 hover:underline">Mesa</Link> e entre em uma.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/mesa"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">
          Histórico de sessões — {activeMesa.name}
        </h1>
      </div>

      {notice && (
        <p
          className="cursor-pointer rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600"
          onClick={() => setNotice('')}
        >
          {notice}
        </p>
      )}

      {loading && <p className="text-sm text-slate-400">Carregando...</p>}

      {!loading && notes.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
          Nenhuma sessão arquivada ainda. Use "🗄️ Arquivar sessão" nas
          Anotações da Mesa para guardar o que aconteceu hoje.
        </p>
      )}

      <div className="space-y-2">
        {notes.map((n) => {
          const isOpen = open === n.id
          return (
            <div
              key={n.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                onClick={() => setOpen(isOpen ? null : n.id)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="text-lg">{isOpen ? '📖' : '📕'}</span>
                <span className="flex-1">
                  <b className="text-slate-800">{n.title}</b>
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(n.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdit(n)
                  }}
                  role="button"
                  title="Editar"
                  className="px-1 text-slate-300 hover:text-slate-600"
                >
                  ✏️
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(n.id)
                  }}
                  role="button"
                  title="Apagar"
                  className="px-1 text-slate-300 hover:text-red-500"
                >
                  ×
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 p-4">
                  {editing === n.id ? (
                    <div className="space-y-2">
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="Título"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold focus:border-red-400 focus:outline-none"
                      />
                      <textarea
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        rows={8}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(n.id)}
                          disabled={saving || !draftTitle.trim()}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {n.content}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
