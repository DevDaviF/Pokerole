import { useRef, useState } from 'react'

// Tamanho máximo do lado maior da imagem — mantém o data URL bem abaixo do
// limite de 64KB do payload de ficha compartilhada (shared_sheets).
const MAX_SIDE = 160
const JPEG_QUALITY = 0.72

// Paleta de avatares padrão (SVG inline, sem depender de arquivos externos).
const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

function presetDataUri(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}"/><circle cx="32" cy="26" r="12" fill="white" fill-opacity="0.85"/><path d="M10 58c2-14 12-22 22-22s20 8 22 22" fill="white" fill-opacity="0.85"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const DEFAULT_AVATAR = presetDataUri('#94a3b8')

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
    <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex flex-wrap gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title="Usar avatar padrão"
              onClick={() => onChange(presetDataUri(c))}
              className="h-6 w-6 rounded-full border border-white shadow-sm ring-1 ring-slate-200 hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
