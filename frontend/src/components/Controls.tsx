/* ── Controls — Agent selector + Abilities + Plan/Execute + Quick/Strategic toggle ── */
import { useGameStore } from '../store/gameStore'
import { sendWS } from '../api/client'

const ROLE_COLORS: Record<string, string> = {
  hacker: '#00ff88',
  thief: '#e94560',
  muscle: '#ff6b35',
}

const ROLE_ICONS: Record<string, string> = {
  hacker: '�',
  thief: '🦊',
  muscle: '💪',
}

const ABILITY_LABELS: Record<string, string> = {
  disable_device: '⚡ Hack',
  pick_lock: '🔓 Pick',
  knock_out: '👊 KO',
  sprint: '💨 Sprint',
}

const ABILITY_TOOLTIPS: Record<string, string> = {
  disable_device: 'Disable a nearby camera or alarm sensor',
  pick_lock: 'Pick the lock on an adjacent door',
  knock_out: 'Knock out an adjacent guard (single use!)',
  sprint: 'Move an extra tile this turn',
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    background: 'rgba(10, 10, 25, 0.92)',
    border: '1px solid rgba(0, 212, 255, 0.25)',
    borderRadius: 10,
    padding: '10px 16px',
    backdropFilter: 'blur(10px)',
    zIndex: 20,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
    maxWidth: '95vw',
  },
  modeToggle: {
    display: 'flex',
    gap: 0,
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid rgba(0, 212, 255, 0.25)',
  },
  modeBtn: {
    padding: '6px 12px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    transition: 'all 0.15s',
  },
  agentBtn: {
    padding: '8px 14px',
    border: '2px solid transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    transition: 'all 0.15s',
    background: 'transparent',
  },
  actionBtn: {
    padding: '10px 18px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  abilityBtn: {
    padding: '5px 10px',
    border: '1px solid',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 600,
    background: 'rgba(0,0,0,0.3)',
    transition: 'all 0.15s',
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
    margin: '0 4px',
  },
  agentCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
  },
  abilityRow: {
    display: 'flex',
    gap: 3,
  },
  hint: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#555',
    textAlign: 'center' as const,
    maxWidth: 300,
    lineHeight: 1.4,
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
  const moveMode = useGameStore((s) => s.moveMode)
  const setMoveMode = useGameStore((s) => s.setMoveMode)
  const pendingMoves = useGameStore((s) => s.pendingMoves)
  const clearNarration = useGameStore((s) => s.clearNarration)
  const isTutorial = useGameStore((s) => s.isTutorial)
  const advanceTutorial = useGameStore((s) => s.advanceTutorial)
  const tutorialStep = useGameStore((s) => s.tutorialStep)

  const hasWaypoints = Object.keys(waypoints).length > 0
  const hasPaths = Object.keys(paths).length > 0
  const hasPendingMoves = Object.keys(pendingMoves).length > 0

  const handlePlan = () => {
    if (!hasWaypoints) return
    setPlanning(true)
    clearCBSEvents()
    clearNarration()
    sendWS({ action: 'plan', waypoints })
    if (isTutorial && tutorialStep === 5) advanceTutorial()
  }

  const handleExecute = () => {
    clearNarration()
    sendWS({ action: 'execute' })
    if (isTutorial && tutorialStep === 7) advanceTutorial()
  }

  const handleEndTurn = () => {
    // Quick mode: use pending moves as waypoints, auto plan + execute
    if (!hasPendingMoves && !hasWaypoints) return
    const wp = hasPendingMoves ? pendingMoves : waypoints
    setPlanning(true)
    clearCBSEvents()
    clearNarration()
    sendWS({ action: 'plan', waypoints: wp })
    // Execute will happen after plan_complete via auto-execute flag
    useGameStore.setState({ _autoExecuteAfterPlan: true } as Record<string, unknown>)
  }

  const handleAbility = (agentId: string, ability: string) => {
    sendWS({ action: 'ability', agent_id: agentId, ability })
  }

  const handleAIStep = () => {
    setPlanning(true)
    clearCBSEvents()
    clearNarration()
    sendWS({ action: 'ai_step' })
  }

  if (gameStatus !== 'active') return null

  // Compute contextual hint text
  let hintText = ''
  if (gameMode === 'pvai') {
    if (!selectedAgent && !hasWaypoints && !hasPendingMoves) {
      hintText = '← Select an agent, then click the map to move them'
    } else if (selectedAgent && !hasWaypoints && !hasPendingMoves && !planning) {
      hintText = moveMode === 'quick'
        ? 'Click anywhere on the map — agent will move there automatically!'
        : 'Click on the map to set a destination'
    } else if (planning) {
      hintText = '⏳ AI is computing paths and executing movement...'
    } else if (moveMode === 'strategic' && hasWaypoints && !hasPaths) {
      hintText = 'Click PLAN to compute safe paths, then EXECUTE'
    } else if (moveMode === 'strategic' && hasPaths) {
      hintText = 'Paths ready! Click EXECUTE to move your crew'
    }
  }

  return (
    <div style={s.panel}>
      {gameMode === 'pvai' && (
        <>
          {/* Mode toggle */}
          <div style={s.modeToggle} title="Quick Move: click & move. Strategic Plan: set waypoints, plan, execute.">
            <button
              style={{
                ...s.modeBtn,
                background: moveMode === 'quick' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                color: moveMode === 'quick' ? '#00d4ff' : '#555',
              }}
              onClick={() => setMoveMode('quick')}
            >
              ⚡ Quick
            </button>
            <button
              style={{
                ...s.modeBtn,
                background: moveMode === 'strategic' ? 'rgba(255, 204, 0, 0.2)' : 'transparent',
                color: moveMode === 'strategic' ? '#ffcc00' : '#555',
              }}
              onClick={() => setMoveMode('strategic')}
            >
              🎯 Strategic
            </button>
          </div>

          <div style={s.divider} />

          {/* Agent cards with abilities */}
          {crew.map((agent) => {
            const color = ROLE_COLORS[agent.role] || '#fff'
            const icon = ROLE_ICONS[agent.role] || ''
            const isSelected = selectedAgent === agent.agent_id
            const wp = waypoints[agent.agent_id]
            const pm = pendingMoves[agent.agent_id]
            const destination = wp || pm

            return (
              <div key={agent.agent_id} style={s.agentCard}>
                <button
                  onClick={() => {
                    setSelectedAgent(isSelected ? null : agent.agent_id)
                    if (isTutorial && tutorialStep === 2) advanceTutorial()
                  }}
                  title={`Select ${agent.role} — click then click the map to set destination`}
                  style={{
                    ...s.agentBtn,
                    color,
                    background: isSelected ? `${color}22` : 'transparent',
                    borderColor: isSelected ? color : `${color}44`,
                    opacity: agent.alive ? 1 : 0.3,
                  }}
                >
                  {icon} {agent.role}
                </button>
                {destination && (
                  <div style={s.waypointTag}>
                    → ({destination[0]}, {destination[1]})
                  </div>
                )}

                {/* Ability buttons */}
                {agent.alive && agent.abilities && agent.abilities.length > 0 && (
                  <div style={s.abilityRow}>
                    {agent.abilities.map((ab) => {
                      const uses = agent.ability_uses?.[ab] ?? 0
                      const cd = agent.ability_cooldowns?.[ab] ?? 0
                      const canUse = uses > 0 && cd <= 0
                      return (
                        <button
                          key={ab}
                          onClick={() => canUse && handleAbility(agent.agent_id, ab)}
                          disabled={!canUse}
                          title={`${ABILITY_TOOLTIPS[ab] || ab} (${uses} uses${cd > 0 ? `, cooldown: ${cd} turns` : ''})`}
                          style={{
                            ...s.abilityBtn,
                            color: canUse ? color : '#555',
                            borderColor: canUse ? `${color}66` : '#333',
                            cursor: canUse ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {ABILITY_LABELS[ab] || ab}
                          {uses > 0 && <span style={{ fontSize: 8, marginLeft: 2 }}>×{uses}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <div style={s.divider} />

          {/* Action buttons differ by mode */}
          {moveMode === 'quick' ? (
            /* Quick mode: clicking map auto-executes — show status */
            planning ? (
              <div style={{ ...s.actionBtn, background: '#333', color: '#00d4ff' }}>
                ⏳ Moving...
              </div>
            ) : null
          ) : (
            /* Strategic mode: Plan + Execute */
            <>
              <button
                onClick={handlePlan}
                disabled={!hasWaypoints || planning}
                title="Run CBS algorithm to compute collision-free paths for all agents"
                style={{
                  ...s.actionBtn,
                  background: hasWaypoints && !planning ? '#00d4ff' : '#333',
                  color: hasWaypoints && !planning ? '#000' : '#666',
                }}
              >
                {planning ? 'Planning…' : 'Plan (CBS)'}
              </button>
              <button
                onClick={handleExecute}
                disabled={!hasPaths}
                title="Move crew along planned paths — guards and sensors will react"
                style={{
                  ...s.actionBtn,
                  background: hasPaths ? '#00ff88' : '#333',
                  color: hasPaths ? '#000' : '#666',
                }}
              >
                Execute ▶
              </button>
            </>
          )}

          {/* Contextual hint */}
          {hintText && <div style={s.hint}>{hintText}</div>}
        </>
      )}

      {gameMode === 'spectator' && (
        <button
          onClick={handleAIStep}
          disabled={planning}
          title="Let the AI plan and execute one turn"
          style={{
            ...s.actionBtn,
            background: !planning ? '#e94560' : '#333',
            color: !planning ? '#fff' : '#666',
          }}
        >
          {planning ? 'AI Thinking…' : 'AI Step ▶'}
        </button>
      )}
    </div>
  )
}
