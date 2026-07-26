import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import PokedexPage from './pages/PokedexPage'
import PokemonDetailPage from './pages/PokemonDetailPage'
import MovedexPage from './pages/MovedexPage'
import TrainersPage from './pages/TrainersPage'
import PokemonSheetsPage from './pages/PokemonSheetsPage'
import TeamPage from './pages/TeamPage'
import MesaPage from './pages/MesaPage'
import SessionHistoryPage from './pages/SessionHistoryPage'
import LivroPage from './pages/LivroPage'
import DiceRoller from './components/DiceRoller'
import ErrorBoundary from './components/ErrorBoundary'
import { MesaProvider, useMesa } from './lib/mesa'

const navItems = [
  { to: '/', label: 'Pokédex' },
  { to: '/moves', label: 'Movedex' },
  { to: '/trainers', label: 'Treinadores' },
  { to: '/sheets', label: 'Meus Pokémon' },
  { to: '/team', label: 'Meu Time' },
  { to: '/mesa', label: 'Mesa' },
  { to: '/livro', label: '📖 Livro' },
]

function Shell() {
  const { postRoll, activeMesa, session } = useMesa()
  return (
    <div className="min-h-screen">
      <header className="bg-red-600 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="text-xl font-bold tracking-tight">Pokérole 3.0</span>
          <nav className="flex flex-wrap gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-red-600'
                      : 'text-red-100 hover:bg-red-500'
                  }`
                }
              >
                {item.label}
                {item.to === '/mesa' && session && activeMesa && (
                  <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <ErrorBoundary label="Página">
          <Routes>
            <Route path="/" element={<PokedexPage />} />
            <Route path="/pokemon/:id" element={<PokemonDetailPage />} />
            <Route path="/moves" element={<MovedexPage />} />
            <Route path="/trainers" element={<TrainersPage />} />
            <Route path="/sheets" element={<PokemonSheetsPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/mesa" element={<MesaPage />} />
            <Route path="/mesa/historico" element={<SessionHistoryPage />} />
            <Route path="/livro" element={<LivroPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <DiceRoller onRoll={postRoll} />
    </div>
  )
}

function App() {
  return (
    <MesaProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </MesaProvider>
  )
}

export default App
