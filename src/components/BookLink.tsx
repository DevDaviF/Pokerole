import { Link } from 'react-router-dom'

export default function BookLink({
  page,
  className,
}: {
  page: number
  className?: string
}) {
  return (
    <Link
      to={`/livro?page=${page}`}
      className={
        className ??
        'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200'
      }
      title={`Abrir o Corebook na página ${page}`}
    >
      📖 Ver no livro (p.{page})
    </Link>
  )
}
