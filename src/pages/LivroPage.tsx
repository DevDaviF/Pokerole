import { useSearchParams } from 'react-router-dom'
import { bookPageUrl, findBookPart, BOOK_PARTS } from '../lib/book'
import { supabaseConfigured } from '../lib/supabase'

export default function LivroPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const url = bookPageUrl(page)
  const part = findBookPart(page)
  const partIndex = BOOK_PARTS.indexOf(part) + 1

  return (
    <div className="flex h-[85vh] flex-col space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-800">📖 Corebook 3.0</h1>
        <span className="text-xs text-slate-400">
          Parte {partIndex}/{BOOK_PARTS.length} · carrega só o trecho da
          página pedida, não o livro inteiro
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          Página
          <input
            type="number"
            min={1}
            value={page}
            onChange={(e) => setParams({ page: e.target.value })}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-red-400 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BOOK_PARTS.map((p, i) => (
          <button
            key={p.file}
            onClick={() => setParams({ page: String(p.startPage) })}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              p === part
                ? 'border-red-400 bg-red-50 text-red-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Parte {i + 1} (p.{p.startPage}-{p.endPage})
          </button>
        ))}
      </div>

      {!supabaseConfigured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Supabase não configurado — preencha o arquivo <code>.env</code> e
          reinicie o servidor.
        </p>
      ) : !url ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Não achei a URL do livro.
        </p>
      ) : (
        <>
          <iframe
            // remonta só ao trocar de parte — trocar de página dentro da
            // mesma parte reaproveita o PDF já carregado (o navegador só
            // pula pra página nova), evitando baixar a parte de novo
            key={part.file}
            src={url}
            title="Pokérole Corebook 3.0"
            className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
          />
          <p className="text-xs text-slate-400">
            Se a página aparecer em branco, essa parte do livro ainda não
            foi enviada pro Storage (bucket "corebook") — veja
            migration-11-book-storage.sql.
          </p>
        </>
      )}
    </div>
  )
}
