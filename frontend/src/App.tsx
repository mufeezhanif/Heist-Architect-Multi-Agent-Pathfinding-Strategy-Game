/* ── Heist Architect — App root ── */
import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import LandingPage from './components/LandingPage'
import GameBoard2D from './components/GameBoard2D'
import Controls from './components/Controls'
import GameOverScreen from './components/GameOverScreen'
import TutorialOverlay from './components/TutorialOverlay'
import HelpButton from './components/HelpButton'
import HowToPlay from './components/HowToPlay'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const gameStatus = useGameStore((s) => s.gameStatus)
  const showHowToPlay = useGameStore((s) => s.showHowToPlay)
  const uiTheme = useGameStore((s) => s.uiTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme)
  }, [uiTheme])

  if (screen === 'landing') {
    return <LandingPage />
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {gameStatus === 'active' && <LeftSidebar />}

      {/* Center column — maze + overlays */}
      <main style={{ flex: 1, position: 'relative', minWidth: 0, height: '100vh' }}>
        {gameStatus === 'active' && (
          <>
            <GameBoard2D />
            <Controls />
            <HelpButton />
            <TutorialOverlay />
            {showHowToPlay && <HowToPlay asModal />}
          </>
        )}
        <GameOverScreen />
      </main>

      {gameStatus === 'active' && <RightSidebar />}
    </div>
  )
}
