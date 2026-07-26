import { useRef, useState } from 'react'

// Tamanho máximo do lado maior da imagem — mantém o data URL bem abaixo do
// limite de 64KB do payload de ficha compartilhada (shared_sheets).
const MAX_SIDE = 160
const JPEG_QUALITY = 0.72

// Presets = sprites que já existem em /public/sprites (mesmos usados no
// Pokédex), então não gastam espaço no armazenamento local — é só uma
// string curta de caminho, não uma imagem embutida.
const AVATAR_PRESETS = [
  'pikachu',
  'eevee',
  'charmander',
  'bulbasaur',
  'squirtle',
  'umbreon',
  'gengar',
  'lucario',
  'snorlax',
  'sylveon',
  'riolu',
  'vulpix',
]

function presetUrl(name: string): string {
  return `/sprites/${name}.png`
}

export const DEFAULT_AVATAR = presetUrl(AVATAR_PRESETS[0])

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'))
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas indisponível'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function ImagePicker({
  value,
  fallback,
  onChange,
}: {
  value: string | undefined
  fallback: string
  onChange: (dataUrl: string | undefined) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const dataUrl = await resizeToDataUrl(file)
      onChange(dataUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não deu para carregar a imagem')
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      <img
        src={value || fallback}
        alt=""
        className="h-16 w-16 rounded-full border border-slate-200 object-cover"
        onError={(e) => (e.currentTarget.src = fallback)}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            📷 Enviar imagem
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
            >
              Remover
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <p className="text-[11px] text-slate-400">Ou escolha um avatar:</p>
        <div className="flex flex-wrap gap-1.5">
          {AVATAR_PRESETS.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(presetUrl(name))}
              className="h-8 w-8 overflow-hidden rounded-full border border-slate-200 bg-slate-50 hover:scale-110 hover:border-red-300"
            >
              <img src={presetUrl(name)} alt={name} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
