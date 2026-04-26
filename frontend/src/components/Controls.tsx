/* ── Controls — Agent selector + Abilities + Plan/Execute + Quick/Strategic toggle ── */
import { useGameStore } from '../store/gameStore'
import { sendWS } from '../api/client'
import { motion } from 'framer-motion'
import { Zap, Map, MonitorOff, Key, Frown, FastForward, BrainCircuit, Play } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  hacker: '#00ff66',
  thief: '#ff003c',
  muscle: '#fcee0a',
}

const ABILITY_ICONS: Record<string, React.ReactNode> = {
  disable_device: <MonitorOff size={14} />,
  pick_lock: <Key size={14} />,
  knock_out: <Frown size={14} />,
  sprint: <FastForward size={14} />,
}

const ABILITY_LABELS: Record<string, string> = {
  disable_device: 'Hack',
  pick_lock: 'Pick',
  knock_out: 'KO',
  sprint: 'Sprint',
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
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    background: 'rgba(5, 5, 8, 0.85)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '16px',
    padding: '16px 24px',
    backdropFilter: 'blur(16px)',
    // Keep core turn controls above floating analytics panels.
    zIndex: 30,
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '95vw',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,240,255,0.05)',
  },
  modeToggle: {
    display: 'flex',
    gap: '4px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid var(--glass-border)',
    background: 'rgba(0,0,0,0.3)',
    padding: '4px',
  },
  modeBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  agentBtn: {
    padding: '10px 20px',
    border: '2px solid transparent',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: '1rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    background: 'transparent',
    transition: 'all 0.2s',
  },
  actionBtn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: '1rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
  },
  abilityBtn: {
    padding: '6px 12px',
    border: '1px solid',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    textTransform: 'uppercase',
  },
  waypointTag: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    marginTop: '4px',
    background: 'rgba(0,0,0,0.4)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  divider: {
    width: '1px',
    height: '40px',
    background: 'linear-gradient(to bottom, transparent, rgba(0, 240, 255, 0.4), transparent)',
    margin: '0 8px',
  },
  agentCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  abilityRow: {
    display: 'flex',
    gap: '6px',
  },
  hint: {
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    maxWidth: '280px',
    lineHeight: 1.4,
    padding: '8px 16px',
    background: 'rgba(10, 25, 47, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(168, 178, 209, 0.2)',
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
  const reset = useGameStore((s) => s.reset)
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

  const handleAbility = (agentId: string, ability: string) => {
    sendWS({ action: 'ability', agent_id: agentId, ability })
  }

  const handleAIStep = () => {
    setPlanning(true)
    clearCBSEvents()
    clearNarration()
    sendWS({ action: 'ai_step' })
  }

  const handleExitGame = () => {
    const ok = window.confirm('Exit current game and return to main menu?')
    if (!ok) return
    reset()
  }

  if (gameStatus !== 'active') return null

  // Compute contextual hint text
  let hintText = ''
  if (gameMode === 'pvai') {
    if (!selectedAgent && !hasWaypoints && !hasPendingMoves) {
      hintText = '← Select an agent, then click the map'
    } else if (selectedAgent && !hasWaypoints && !hasPendingMoves && !planning) {
      hintText = moveMode === 'quick'
        ? 'Click map — agent will move automatically!'
        : 'Click on the map to set a destination'
    } else if (planning) {
      hintText = '⏳ AI is computing paths...'
    } else if (moveMode === 'strategic' && hasWaypoints && !hasPaths) {
      hintText = 'Click PLAN to compute paths'
    } else if (moveMode === 'strategic' && hasPaths) {
      hintText = 'Paths ready! Click EXECUTE'
    }
  }

  return (
    <motion.div 
      style={s.panel}
      initial={{ y: 100, opacity: 0, x: '-50%' }}
      animate={{ y: 0, opacity: 1, x: '-50%' }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
    >
      {gameMode === 'pvai' && (
        <>
          {/* Mode toggle */}
          <div style={s.modeToggle} title="Quick Move: click & move. Strategic Plan: set waypoints, plan, execute.">
            <motion.button
              whileTap={{ scale: 0.95 }}
              style={{
                ...s.modeBtn,
                background: moveMode === 'quick' ? 'var(--neon-cyan)' : 'transparent',
                color: moveMode === 'quick' ? '#050508' : 'var(--text-secondary)',
              }}
              onClick={() => setMoveMode('quick')}
            >
              <Zap size={14} /> Quick
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              style={{
                ...s.modeBtn,
                background: moveMode === 'strategic' ? 'var(--neon-cyan)' : 'transparent',
                color: moveMode === 'strategic' ? '#050508' : 'var(--text-secondary)',
              }}
              onClick={() => setMoveMode('strategic')}
            >
              <Map size={14} /> Strategic
            </motion.button>
          </div>

          <div style={s.divider} />

          {/* Agent cards with abilities */}
          {crew.map((agent) => {
            const color = ROLE_COLORS[agent.role] || '#fff'
            const isSelected = selectedAgent === agent.agent_id
            const wp = waypoints[agent.agent_id]
            const pm = pendingMoves[agent.agent_id]
            const destination = wp || pm

            return (
              <div key={agent.agent_id} style={s.agentCard}>
                <motion.button
                  whileHover={{ scale: agent.alive ? 1.05 : 1 }}
                  whileTap={{ scale: agent.alive ? 0.95 : 1 }}
                  onClick={() => {
                    setSelectedAgent(isSelected ? null : agent.agent_id)
                    if (isTutorial && tutorialStep === 2) advanceTutorial()
                  }}
                  title={`Select ${agent.role} — click then click the map to set destination`}
                  style={{
                    ...s.agentBtn,
                    color: isSelected ? '#050508' : color,
                    background: isSelected ? color : 'transparent',
                    borderColor: color,
                    opacity: agent.alive ? 1 : 0.4,
                    boxShadow: isSelected ? `0 0 15px ${color}` : 'none',
                  }}
                >
                  {agent.role}
                </motion.button>
                {destination && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={s.waypointTag}>
                    → ({destination[0]}, {destination[1]})
                  </motion.div>
                )}

                {/* Ability buttons */}
                {agent.alive && agent.abilities && agent.abilities.length > 0 && (
                  <div style={s.abilityRow}>
                    {agent.abilities.map((ab) => {
                      const uses = agent.ability_uses?.[ab] ?? 0
                      const cd = agent.ability_cooldowns?.[ab] ?? 0
                      const canUse = uses > 0 && cd <= 0
                      return (
                        <motion.button
                          whileHover={canUse ? { scale: 1.1, backgroundColor: `${color}22` } : {}}
                          whileTap={canUse ? { scale: 0.9 } : {}}
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
                          {ABILITY_ICONS[ab]}
                          {ABILITY_LABELS[ab] || ab}
                          {uses > 0 && <span style={{ fontSize: '0.65rem', marginLeft: 2, opacity: 0.8 }}>×{uses}</span>}
                        </motion.button>
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
            planning ? (
              <motion.div 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ ...s.actionBtn, background: '#112240', color: 'var(--neon-cyan)' }}
              >
                <BrainCircuit size={18} /> Moving...
              </motion.div>
            ) : null
          ) : (
            <>
              <motion.button
                whileHover={hasWaypoints && !planning ? { scale: 1.05, boxShadow: '0 0 20px var(--neon-cyan)' } : {}}
                whileTap={hasWaypoints && !planning ? { scale: 0.95 } : {}}
                onClick={handlePlan}
                disabled={!hasWaypoints || planning}
                title="Run CBS algorithm to compute collision-free paths"
                style={{
                  ...s.actionBtn,
                  background: hasWaypoints && !planning ? 'rgba(0, 240, 255, 0.15)' : '#112240',
                  color: hasWaypoints && !planning ? 'var(--neon-cyan)' : '#495670',
                  border: `1px solid ${hasWaypoints && !planning ? 'var(--neon-cyan)' : '#233554'}`,
                }}
              >
                <BrainCircuit size={18} /> {planning ? 'Planning…' : 'Plan'}
              </motion.button>
              <motion.button
                whileHover={hasPaths ? { scale: 1.05, boxShadow: '0 0 20px var(--neon-green)' } : {}}
                whileTap={hasPaths ? { scale: 0.95 } : {}}
                onClick={handleExecute}
                disabled={!hasPaths}
                title="Move crew along planned paths"
                style={{
                  ...s.actionBtn,
                  background: hasPaths ? 'rgba(0, 255, 102, 0.15)' : '#112240',
                  color: hasPaths ? 'var(--neon-green)' : '#495670',
                  border: `1px solid ${hasPaths ? 'var(--neon-green)' : '#233554'}`,
                }}
              >
                <Play size={18} /> Execute
              </motion.button>
            </>
          )}

          {/* Contextual hint */}
          {hintText && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={s.hint}>
              {hintText}
            </motion.div>
          )}
        </>
      )}

      {gameMode === 'spectator' && (
        <motion.button
          whileHover={!planning ? { scale: 1.05, boxShadow: '0 0 20px var(--neon-magenta)' } : {}}
          whileTap={!planning ? { scale: 0.95 } : {}}
          onClick={handleAIStep}
          disabled={planning}
          style={{
            ...s.actionBtn,
            background: !planning ? 'rgba(255, 0, 60, 0.15)' : '#112240',
            color: !planning ? 'var(--neon-magenta)' : '#495670',
            border: `1px solid ${!planning ? 'var(--neon-magenta)' : '#233554'}`,
          }}
        >
          <BrainCircuit size={18} /> {planning ? 'AI Thinking…' : 'AI Step'}
        </motion.button>
      )}

      <motion.button
        whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(255, 0, 60, 0.45)' }}
        whileTap={{ scale: 0.95 }}
        onClick={handleExitGame}
        title="Exit the current game and return to the main menu"
        style={{
          ...s.actionBtn,
          padding: '10px 16px',
          fontSize: '0.85rem',
          background: 'rgba(255, 0, 60, 0.12)',
          color: 'var(--neon-magenta)',
          border: '1px solid rgba(255, 0, 60, 0.45)',
        }}
      >
        Exit
      </motion.button>
    </motion.div>
  )
}
