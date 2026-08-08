import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label: string
}

interface State {
  error: Error | null
}

// Sem isto, qualquer erro em um único painel derrubava a página inteira
// (tela branca). Cada painel arriscado (Supabase realtime, geração de
// ficha etc.) fica isolado: se quebrar, só aquele card mostra o erro.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <b>Erro em "{this.props.label}"</b>
          <p className="mt-1 font-mono text-xs whitespace-pre-wrap">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold hover:bg-red-100"
          >
            Tentar de novo
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
