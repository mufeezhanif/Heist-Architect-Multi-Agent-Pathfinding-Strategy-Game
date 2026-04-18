/* ── Controls — Agent selector + Plan/Execute buttons ── */
import { useGameStore } from '../store/gameStore'
import { sendWS } from '../api/client'

const ROLE_COLORS: Record<string, string> = {
  hacker: '#00ff88',
  thief: '#e94560',
  muscle: '#ff6b35',
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    background: 'rgba(10, 10, 25, 0.9)',
    border: '1px solid rgba(0, 212, 255, 0.25)',
    borderRadius: 10,
    padding: '10px 20px',
    backdropFilter: 'blur(10px)',
    zIndex: 20,
  },
  agentBtn: {
    padding: '8px 16px',
    border: '2px solid transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    transition: 'all 0.15s',
  },
  actionBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  waypointTag: {
    fontSize: 9,
    color: '#aaa',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    background: 'rgba(0, 212, 255, 0.2)',
    margin: '0 6px',
  },
}

export default function Controls() {
  const crew = useGameStore((s) => s.crew)
  const selectedAgent = useGameStore((s) => s.selectedAgent)
  const setSelectedAgent = useGameStore((s) => s.setSelectedAgent)
  const waypoints = useGameStore((s) => s.waypoints)
  const planning = useGameStore((s) => s.planning)
  const setPlanning = useGameStore((s) => s.setPlanning)
  const clearCBSEvents = useGameStore((s) => s.clearCBSEvents)
  const gameStatus = useGameStore((s) => s.gameStatus)
  const gameMode = useGameStore((s) => s.gameMode)
  const paths = useGameStore((s) => s.paths)

  const hasWaypoints = Object.keys(waypoints).length > 0
  const hasPaths = Object.keys(paths).length > 0

  const handlePlan = () => {
    if (!hasWaypoints) return
    setPlanning(true)
    clearCBSEvents()
    sendWS({ action: 'plan', waypoints })
  }

  const handleExecute = () => {
    sendWS({ action: 'execute' })
  }

  const handleAIStep = () => {
    setPlanning(true)
    clearCBSEvents()
    sendWS({ action: 'ai_step' })
  }

  if (gameStatus !== 'active') return null

  return (
    <div style={s.panel}>
      {gameMode === 'pvai' && (
        <>
          {/* Agent selector */}
          {crew.map((agent) => {
            const color = ROLE_COLORS[agent.role] || '#fff'
            const isSelected = selectedAgent === agent.agent_id
            const wp = waypoints[agent.agent_id]

            return (
              <div key={agent.agent_id} style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setSelectedAgent(isSelected ? null : agent.agent_id)}
                  style={{
                    ...s.agentBtn,
                    color,
                    background: isSelected ? `${color}22` : 'transparent',
                    borderColor: isSelected ? color : `${color}44`,
                  }}
                >
                  {agent.role}
                </button>
                {wp && <div style={s.waypointTag}>→ ({wp[0]}, {wp[1]})</div>}
              </div>
            )
          })}

          <div style={s.divider} />

          {/* Plan button */}
          <button
            onClick={handlePlan}
            disabled={!hasWaypoints || planning}
            style={{
              ...s.actionBtn,
              background: hasWaypoints && !planning ? '#00d4ff' : '#333',
              color: hasWaypoints && !planning ? '#000' : '#666',
            }}
          >
            {planning ? 'Planning…' : 'Plan (CBS)'}
          </button>

          {/* Execute button */}
          <button
            onClick={handleExecute}
            disabled={!hasPaths}
            style={{
              ...s.actionBtn,
              background: hasPaths ? '#00ff88' : '#333',
              color: hasPaths ? '#000' : '#666',
            }}
          >
            Execute Turn
          </button>
        </>
      )}

      {gameMode === 'spectator' && (
        <button
          onClick={handleAIStep}
          disabled={planning}
          style={{
            ...s.actionBtn,
            background: !planning ? '#e94560' : '#333',
            color: !planning ? '#fff' : '#666',
          }}
        >
          {planning ? 'AI Thinking…' : 'AI Step'}
        </button>
      )}
    </div>
  )
}
