import { useState } from 'react'
import { getUnitPreference, setUnitPreference, type UnitSystem } from '../lib/units'

export function useUnitSystem(): [UnitSystem, (s: UnitSystem) => void] {
  const [system, setSystem] = useState<UnitSystem>(getUnitPreference())
  const change = (s: UnitSystem) => {
    setUnitPreference(s)
    setSystem(s)
  }
  return [system, change]
}

export default function UnitToggle({
  value,
  onChange,
}: {
  value: UnitSystem
  onChange: (s: UnitSystem) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/30 bg-black/15 p-0.5 text-xs font-bold">
      {(['metric', 'imperial'] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`rounded-md px-2 py-0.5 transition-colors ${
            value === s ? 'bg-white text-slate-800' : 'text-white hover:bg-white/10'
          }`}
        >
          {s === 'metric' ? 'cm/kg' : 'ft/lb'}
        </button>
      ))}
    </div>
  )
}
