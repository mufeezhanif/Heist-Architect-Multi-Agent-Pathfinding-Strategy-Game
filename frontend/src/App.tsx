/* ── Heist Architect — App root ── */
import { useGameStore } from './store/gameStore'
import LandingPage from './components/LandingPage'
import GameScene from './three/GameScene'
import HUD from './components/HUD'
import Controls from './components/Controls'
import SpeedControls from './components/SpeedControls'
import GameOverScreen from './components/GameOverScreen'
import SensorLog from './components/SensorLog'
import CBSTreePanel from './visualizations/CBSTreePanel'
import BayesianPanel from './visualizations/BayesianPanel'
import MinimaxPanel from './visualizations/MinimaxPanel'
import TutorialOverlay from './components/TutorialOverlay'
import NarrationPanel from './components/NarrationPanel'
import HelpButton from './components/HelpButton'
import HowToPlay from './components/HowToPlay'
import AlgorithmStatus from './components/AlgorithmStatus'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const showHowToPlay = useGameStore((s) => s.showHowToPlay)

  if (screen === 'landing') {
    return <LandingPage />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 3D Scene */}
      <GameScene />

      {/* UI Overlays */}
      <HUD />
      <Controls />
      <SpeedControls />
      <SensorLog />
      <NarrationPanel />
      <AlgorithmStatus />
      <HelpButton />

      {/* Visualization Panels */}
      <CBSTreePanel />
      <BayesianPanel />
      <MinimaxPanel />

      {/* Tutorial */}
      <TutorialOverlay />

      {/* In-game How to Play modal */}
      {showHowToPlay && <HowToPlay asModal />}

      {/* Game Over */}
      <GameOverScreen />
    </div>
  )
}
