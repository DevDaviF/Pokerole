export default function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 12,
  dotMax,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  dotMax?: number // quando definido, mostra bolinhas até esse máximo
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-slate-600">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-6 w-6 rounded border border-slate-300 bg-white text-sm leading-none text-slate-600 hover:bg-slate-100"
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-bold text-slate-800">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-6 w-6 rounded border border-slate-300 bg-white text-sm leading-none text-slate-600 hover:bg-slate-100"
      >
        +
      </button>
      {dotMax !== undefined && (
        <span className="ml-1 flex gap-0.5">
          {Array.from({ length: Math.max(dotMax, value) }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                i < value ? 'bg-red-500' : 'border border-slate-300'
              }`}
            />
          ))}
        </span>
      )}
    </div>
  )
}
