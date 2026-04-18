/* ── SpeedControls — AI vs AI speed + viz toggles ── */
import { useGameStore } from '../store/gameStore'
import { sendWS } from '../api/client'
import { useEffect, useRef } from 'react'

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: 'rgba(10, 10, 25, 0.85)',
    border: '1px solid rgba(0, 212, 255, 0.25)',
    borderRadius: 8,
    padding: '10px 14px',
    backdropFilter: 'blur(8px)',
    zIndex: 15,
    minWidth: 160,
  },
  title: {
    fontSize: 10,
    color: '#00d4ff',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toggleBtn: {
    padding: '4px 10px',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
    background: 'transparent',
    color: '#e0e0e0',
    transition: 'all 0.15s',
  },
  label: {
    fontSize: 12,
    color: '#ccc',
    fontFamily: 'monospace',
  },
  speedBtn: {
    padding: '4px 8px',
    border: '1px solid #e94560',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
    background: 'transparent',
    color: '#e94560',
  },
}

export default function SpeedControls() {
  const gameMode = useGameStore((st) => st.gameMode)
  const aiRunning = useGameStore((st) => st.aiRunning)
  const setAiRunning = useGameStore((st) => st.setAiRunning)
  const aiSpeed = useGameStore((st) => st.aiSpeed)
  const setAiSpeed = useGameStore((st) => st.setAiSpeed)
  const showCBSTree = useGameStore((st) => st.showCBSTree)
  const showBayesian = useGameStore((st) => st.showBayesian)
  const showMinimax = useGameStore((st) => st.showMinimax)
  const showAstarViz = useGameStore((st) => st.showAstarViz)
  const toggleViz = useGameStore((st) => st.toggleViz)
  const gameStatus = useGameStore((st) => st.gameStatus)
  const clearCBSEvents = useGameStore((st) => st.clearCBSEvents)
  const setPlanning = useGameStore((st) => st.setPlanning)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-play for AI vs AI
  useEffect(() => {
    if (aiRunning && gameStatus === 'active') {
      intervalRef.current = setInterval(() => {
        clearCBSEvents()
        setPlanning(true)
        sendWS({ action: 'ai_step' })
      }, 3000 / aiSpeed)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [aiRunning, aiSpeed, gameStatus, clearCBSEvents, setPlanning])

  // Stop when game ends
  useEffect(() => {
    if (gameStatus !== 'active') setAiRunning(false)
  }, [gameStatus, setAiRunning])

  const vizToggles: { key: 'showCBSTree' | 'showBayesian' | 'showMinimax' | 'showAstarViz'; label: string; active: boolean }[] = [
    { key: 'showCBSTree', label: 'CBS Tree', active: showCBSTree },
    { key: 'showBayesian', label: 'Bayesian', active: showBayesian },
    { key: 'showMinimax', label: 'Minimax', active: showMinimax },
    { key: 'showAstarViz', label: 'A* Viz', active: showAstarViz },
  ]

  return (
    <div style={s.panel}>
      <div style={s.title}>Visualizations</div>
      {vizToggles.map((v) => (
        <div key={v.key} style={s.row}>
          <span style={s.label}>{v.label}</span>
          <button
            style={{
              ...s.toggleBtn,
              background: v.active ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
              borderColor: v.active ? '#00d4ff' : 'rgba(255,255,255,0.15)',
              color: v.active ? '#00d4ff' : '#666',
            }}
            onClick={() => toggleViz(v.key)}
          >
            {v.active ? 'ON' : 'OFF'}
          </button>
        </div>
      ))}

      {gameMode === 'spectator' && (
        <>
          <div style={{ ...s.title, marginTop: 8 }}>AI vs AI</div>
          <div style={s.row}>
            <span style={s.label}>Speed</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 4].map((sp) => (
                <button
                  key={sp}
                  style={{
                    ...s.speedBtn,
                    background: aiSpeed === sp ? '#e94560' : 'transparent',
                    color: aiSpeed === sp ? '#fff' : '#e94560',
                  }}
                  onClick={() => setAiSpeed(sp)}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>
          <button
            style={{
              ...s.toggleBtn,
              marginTop: 4,
              background: aiRunning ? '#e94560' : 'transparent',
              borderColor: '#e94560',
              color: aiRunning ? '#fff' : '#e94560',
            }}
            onClick={() => setAiRunning(!aiRunning)}
          >
            {aiRunning ? '⏸ Pause' : '▶ Auto-Play'}
          </button>
        </>
      )}
    </div>
  )
}
