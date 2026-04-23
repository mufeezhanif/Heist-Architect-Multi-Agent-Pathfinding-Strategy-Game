/* ── AI Observatory — App root ── */
import { Routes, Route } from 'react-router-dom'
import ObservatoryLanding from './pages/ObservatoryLanding'
import ArenaPage from './pages/ArenaPage'
import TheaterPage from './pages/TheaterPage'
import BenchPage from './pages/BenchPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ObservatoryLanding />} />
      <Route path="/arena" element={<ArenaPage />} />
      <Route path="/theater" element={<TheaterPage />} />
      <Route path="/bench" element={<BenchPage />} />
    </Routes>
  )
}
