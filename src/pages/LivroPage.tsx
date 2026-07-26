import { useSearchParams } from 'react-router-dom'
import { bookPageUrl } from '../lib/book'
import { supabaseConfigured } from '../lib/supabase'

export default function LivroPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const url = bookPageUrl(page)

  return (
    <div className="flex h-[85vh] flex-col space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-800">📖 Corebook 3.0</h1>
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
            key={page}
            src={url}
            title="Pokérole Corebook 3.0"
            className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
          />
          <p className="text-xs text-slate-400">
            Se a página aparecer em branco, o PDF ainda não foi enviado pro
            Storage (bucket "corebook") — veja migration-11-book-storage.sql.
          </p>
        </>
      )}
    </div>
  )
}
