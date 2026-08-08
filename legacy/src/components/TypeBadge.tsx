import { typeColor } from '../data'

export default function TypeBadge({
  type,
  size = 'md',
}: {
  type: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={`inline-block rounded-full font-semibold text-white uppercase tracking-wide ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
      style={{ backgroundColor: typeColor(type) }}
    >
      {type}
    </span>
  )
}
