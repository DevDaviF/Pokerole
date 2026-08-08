// Barra flutuante fixa na viewport, pra não precisar rolar até o fim da
// página só pra salvar depois de mexer em algo lá no topo do formulário.
export default function FloatingSaveBar({
  onSave,
  onCancel,
  saveDisabled,
}: {
  onSave: () => void
  onCancel: () => void
  saveDisabled?: boolean
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-2 rounded-full border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      <button
        onClick={onSave}
        disabled={saveDisabled}
        className="rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-red-700 active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
      >
        Salvar
      </button>
      <button
        onClick={onCancel}
        className="rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        Cancelar
      </button>
    </div>
  )
}
