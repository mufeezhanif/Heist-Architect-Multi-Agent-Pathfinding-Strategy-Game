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

export default function App() {
  const screen = useGameStore((s) => s.screen)

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

      {/* Visualization Panels */}
      <CBSTreePanel />
      <BayesianPanel />
      <MinimaxPanel />

      {/* Game Over */}
      <GameOverScreen />
    </div>
  )
}
