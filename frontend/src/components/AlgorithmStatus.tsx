/* ── AlgorithmStatus — shows which AI algorithms are running ── */
import { useGameStore } from '../store/gameStore'

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    left: 12,
    bottom: 90,
    display: 'flex',
    gap: 6,
    zIndex: 15,
    flexWrap: 'wrap',
    maxWidth: 400,
  },
  panelInline: {
    position: 'relative',
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    width: '100%',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 20,
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    backdropFilter: 'blur(8px)',
    transition: 'all 0.3s',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
}

const ALGORITHMS = [
  { key: 'astar', label: 'A*', desc: 'Pathfinding', color: '#00d4ff', phase: 'plan' },
  { key: 'cbs', label: 'CBS', desc: 'Conflict Resolution', color: '#00ff88', phase: 'plan' },
  { key: 'csp', label: 'CSP', desc: 'Dependencies', color: '#ffcc00', phase: 'plan' },
  { key: 'bayesian', label: 'Bayesian', desc: 'Warden Belief', color: '#9b59b6', phase: 'execute' },
  { key: 'minimax', label: 'Minimax', desc: 'Guard Strategy', color: '#e94560', phase: 'execute' },
]

interface Props { inline?: boolean }

export default function AlgorithmStatus({ inline = false }: Props = {}) {
  const planning = useGameStore((s) => s.planning)
  const gameStatus = useGameStore((s) => s.gameStatus)
  const cbsEvents = useGameStore((s) => s.cbsEvents)

  if (gameStatus !== 'active') return null

  // Determine which algorithms are active based on game phase
  const planActive = planning
  const cbsRunning = planActive && cbsEvents.length > 0

  return (
    <div style={inline ? s.panelInline : s.panel}>
      {ALGORITHMS.map((algo) => {
        const isActive = algo.phase === 'plan' ? planActive : false
        const isDone = algo.key === 'cbs' ? cbsRunning : false

        return (
          <div
            key={algo.key}
            title={`${algo.label}: ${algo.desc}`}
            style={{
              ...s.chip,
              background: isActive
                ? `${algo.color}22`
                : 'rgba(10, 10, 25, 0.7)',
              border: `1px solid ${isActive ? algo.color : algo.color + '33'}`,
              color: isActive ? algo.color : algo.color + '88',
            }}
          >
            <div
              style={{
                ...s.dot,
                background: isActive ? algo.color : algo.color + '44',
                boxShadow: isActive ? `0 0 6px ${algo.color}` : 'none',
                animation: isActive ? 'pulse 1s infinite' : 'none',
              }}
            />
            {algo.label}
            <span style={{ fontWeight: 400, opacity: 0.6 }}>{algo.desc}</span>
            {isDone && <span style={{ fontSize: 8 }}>({cbsEvents.length})</span>}
          </div>
        )
      })}
    </div>
  )
}
