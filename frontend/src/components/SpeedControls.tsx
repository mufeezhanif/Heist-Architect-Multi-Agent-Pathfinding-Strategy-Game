/* ── SpeedControls — AI vs AI speed + viz toggles + step-by-step execution ── */
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
  desc: {
    fontSize: 9,
    color: '#555',
    fontFamily: 'monospace',
    marginBottom: 4,
    lineHeight: 1.4,
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
  execSection: {
    borderTop: '1px solid rgba(0, 212, 255, 0.1)',
    paddingTop: 8,
    marginTop: 4,
  },
  execBtnRow: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
  },
  execBtn: {
    flex: 1,
    padding: '5px 8px',
    border: '1px solid rgba(0, 255, 136, 0.3)',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 700,
    background: 'transparent',
    color: '#00ff88',
    transition: 'all 0.15s',
  },
  stepCounter: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#666',
    textAlign: 'center' as const,
    marginTop: 4,
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

  // Execution step-by-step state
  const executionStep = useGameStore((st) => st.executionStep)
  const executionTotal = useGameStore((st) => st.executionTotal)
  const executionMode = useGameStore((st) => st.executionMode)
  const setExecutionMode = useGameStore((st) => st.setExecutionMode)
  const stepQueue = useGameStore((st) => st.stepQueue)
  const popStepFromQueue = useGameStore((st) => st.popStepFromQueue)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Auto-play steps during execution
  useEffect(() => {
    if (executionMode === 'playing' && stepQueue.length > 0) {
      playIntervalRef.current = setInterval(() => {
        const s = useGameStore.getState()
        if (s.stepQueue.length > 0) {
          s.popStepFromQueue()
        } else {
          setExecutionMode('done')
        }
      }, 600 / aiSpeed)
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [executionMode, stepQueue.length, aiSpeed, setExecutionMode])

  // Stop when game ends
  useEffect(() => {
    if (gameStatus !== 'active') setAiRunning(false)
  }, [gameStatus, setAiRunning])

  const handleStep = () => {
    if (stepQueue.length > 0) {
      popStepFromQueue()
      if (stepQueue.length <= 1) {
        setExecutionMode('done')
      }
    }
  }

  const handlePlay = () => {
    setExecutionMode(executionMode === 'playing' ? 'paused' : 'playing')
  }

  const handleSkip = () => {
    // Process all remaining steps instantly
    const s = useGameStore.getState()
    while (s.stepQueue.length > 0) {
      s.popStepFromQueue()
    }
    setExecutionMode('done')
  }

  const vizToggles: { key: 'showCBSTree' | 'showBayesian' | 'showMinimax' | 'showAstarViz'; label: string; desc: string; active: boolean }[] = [
    { key: 'showCBSTree', label: 'CBS Tree', desc: 'Path planning algorithm', active: showCBSTree },
    { key: 'showBayesian', label: 'Bayesian', desc: 'Warden suspicion map', active: showBayesian },
    { key: 'showMinimax', label: 'Minimax', desc: 'Warden strategy tree', active: showMinimax },
    { key: 'showAstarViz', label: 'A* Viz', desc: 'Pathfinding visualization', active: showAstarViz },
  ]

  const hasSteps = stepQueue.length > 0

  return (
    <div style={s.panel}>
      <div style={s.title}>AI Visualizations</div>
      <div style={s.desc}>Toggle algorithm panels to see how the AI works</div>
      {vizToggles.map((v) => (
        <div key={v.key} style={s.row}>
          <span style={s.label} title={v.desc}>{v.label}</span>
          <button
            style={{
              ...s.toggleBtn,
              background: v.active ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
              borderColor: v.active ? '#00d4ff' : 'rgba(255,255,255,0.15)',
              color: v.active ? '#00d4ff' : '#666',
            }}
            onClick={() => toggleViz(v.key)}
            title={v.desc}
          >
            {v.active ? 'ON' : 'OFF'}
          </button>
        </div>
      ))}

      {/* Step-by-step execution controls */}
      {(hasSteps || executionMode !== 'idle') && (
        <div style={s.execSection}>
          <div style={s.title}>Execution</div>
          <div style={s.desc}>Step through movements one-by-one or auto-play</div>
          <div style={s.execBtnRow}>
            <button
              style={{ ...s.execBtn, opacity: hasSteps ? 1 : 0.3 }}
              onClick={handleStep}
              disabled={!hasSteps}
              title="Advance one step of movement"
            >
              ⏭ Step
            </button>
            <button
              style={{
                ...s.execBtn,
                background: executionMode === 'playing' ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
              }}
              onClick={handlePlay}
              disabled={!hasSteps}
              title={executionMode === 'playing' ? 'Pause auto-play' : 'Auto-play all steps'}
            >
              {executionMode === 'playing' ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              style={{ ...s.execBtn, color: '#ffcc00', borderColor: 'rgba(255, 204, 0, 0.3)', opacity: hasSteps ? 1 : 0.3 }}
              onClick={handleSkip}
              disabled={!hasSteps}
              title="Skip to end of execution"
            >
              ⏩ Skip
            </button>
          </div>
          {executionTotal > 0 && (
            <div style={s.stepCounter}>
              Step {executionStep} / {executionTotal}
            </div>
          )}
        </div>
      )}

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
