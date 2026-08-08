import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-slate-100 px-1">$1</code>')
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">$1</a>',
    )
}

// Markdown mínimo e propositalmente simples: escapa TODO HTML bruto do
// texto ANTES de qualquer transformação — as Anotações são um campo
// colaborativo (qualquer membro da mesa edita o mesmo texto), então
// nunca confiamos no que foi digitado como HTML literal. Só as tags que
// esta função mesma gera (a partir da sintaxe **, *, `, [texto](url),
// # cabeçalho, - item) entram no output; nada do texto do usuário vira
// HTML "de verdade".
function renderNotesMarkdown(raw: string): string {
  const lines = escapeHtml(raw).split('\n')
  const out: string[] = []
  let inList = false
  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }
  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    const listItem = line.match(/^[-*]\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length + 2 // h3-h5, cabe no resto da página
      out.push(`<h${level} class="mt-2 font-bold text-slate-800">${inlineMarkdown(heading[2])}</h${level}>`)
    } else if (listItem) {
      if (!inList) {
        out.push('<ul class="list-disc space-y-0.5 pl-5">')
        inList = true
      }
      out.push(`<li>${inlineMarkdown(listItem[1])}</li>`)
    } else if (line.trim() === '') {
      closeList()
      out.push('<br>')
    } else {
      closeList()
      out.push(`<p>${inlineMarkdown(line)}</p>`)
    }
  }
  closeList()
  return out.join('')
}

export default function MesaNotes({ mesaId }: { mesaId: string }) {
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Digitação em rajada (sem pausa) nunca disparava o debounce sozinho —
  // maxWaitTimer garante um salvamento periódico mesmo sem parar de
  // digitar, em vez de só salvar quando o usuário finalmente pausa.
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // valor mais recente digitado — o maxWaitTimer é agendado só na 1ª
  // tecla da rajada, então precisa ler o valor ATUAL quando disparar,
  // não o que foi capturado no closure daquela 1ª tecla (senão salvava
  // um conteúdo defasado de até 2s atrás).
  const latestValueRef = useRef('')
  // true enquanto há uma edição local ainda não confirmada salva — só
  // isso (não "ter foco") deve bloquear a atualização vinda de outro
  // membro. Antes bastava ter CLICADO na caixa (mesmo só pra rolar e
  // ler) pra parar de receber atualizações alheias em tempo real.
  const isDirtyRef = useRef(false)

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
          // não sobrescreve enquanto há uma edição local não salva —
          // só ter a caixa focada (ex: rolando pra ler) não conta mais
          if (isDirtyRef.current) return
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

  const doSave = async (value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (maxWaitTimer.current) clearTimeout(maxWaitTimer.current)
    saveTimer.current = null
    maxWaitTimer.current = null
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
    isDirtyRef.current = false
    if (!error) setSavedAt(new Date())
  }

  const scheduleSave = (value: string) => {
    setContent(value)
    latestValueRef.current = value
    isDirtyRef.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // debounce normal: salva 400ms depois da última tecla
    saveTimer.current = setTimeout(() => doSave(latestValueRef.current), 400)
    // maxWait: se a pessoa digitar sem pausar por 400ms, ainda assim
    // força um salvamento a cada 2s (sempre com o valor mais recente) —
    // sem isso, uma rajada de digitação longa só chegava pros outros
    // quando a pessoa finalmente parasse de digitar.
    if (!maxWaitTimer.current) {
      maxWaitTimer.current = setTimeout(() => doSave(latestValueRef.current), 2000)
    }
  }

  const renderedHtml = useMemo(() => renderNotesMarkdown(content), [content])

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
        <div className="flex items-center gap-0.5 rounded-full bg-white/15 p-0.5 text-xs font-bold">
          <button
            onClick={() => setMode('edit')}
            className={`rounded-full px-2 py-0.5 ${mode === 'edit' ? 'bg-white text-amber-700' : 'hover:bg-white/20'}`}
          >
            ✏️ Editar
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`rounded-full px-2 py-0.5 ${mode === 'preview' ? 'bg-white text-amber-700' : 'hover:bg-white/20'}`}
          >
            👁️ Visualizar
          </button>
        </div>
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
      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => scheduleSave(e.target.value)}
          placeholder="Anote pistas, NPCs, decisões da campanha... todo mundo na mesa vê e pode editar. Suporta markdown: **negrito**, *itálico*, # título, - lista, [link](url)."
          rows={10}
          className="w-full resize-y border-0 p-4 text-sm text-slate-700 focus:outline-none"
        />
      ) : content.trim() ? (
        <div
          className="min-h-[8rem] p-4 text-sm text-slate-700 [&_a]:break-all [&_h3]:mb-1 [&_h4]:mb-1 [&_h5]:mb-1 [&_li]:ml-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      ) : (
        <p className="p-4 text-sm text-slate-400">Nada anotado ainda.</p>
      )}
    </div>
  )
}
