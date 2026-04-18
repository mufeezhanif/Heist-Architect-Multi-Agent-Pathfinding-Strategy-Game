/* ── HUD — heads-up display overlay ── */
import { useGameStore } from '../store/gameStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 12,
    left: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    pointerEvents: 'none',
    zIndex: 10,
  },
  badge: {
    background: 'rgba(10, 10, 25, 0.85)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#e0e0e0',
    backdropFilter: 'blur(8px)',
  },
  label: {
    color: '#00d4ff',
    marginRight: 8,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  statusWon: { color: '#00ff88' },
  statusLost: { color: '#ff0055' },
  statusActive: { color: '#00d4ff' },
}

export default function HUD() {
  const turn = useGameStore((s) => s.turn)
  const score = useGameStore((s) => s.score)
  const gameStatus = useGameStore((s) => s.gameStatus)
  const objectivesCompleted = useGameStore((s) => s.objectivesCompleted)
  const building = useGameStore((s) => s.building)

  const totalObjectives = building?.objectives.length || 0

  const statusStyle =
    gameStatus === 'won' ? styles.statusWon : gameStatus === 'lost' ? styles.statusLost : styles.statusActive

  return (
    <div style={styles.container}>
      <div style={styles.badge}>
        <span style={styles.label}>Turn</span>
        {turn}
      </div>
      <div style={styles.badge}>
        <span style={styles.label}>Score</span>
        {score}
      </div>
      <div style={styles.badge}>
        <span style={styles.label}>Status</span>
        <span style={statusStyle}>{gameStatus.toUpperCase()}</span>
      </div>
      <div style={styles.badge}>
        <span style={styles.label}>Objectives</span>
        {objectivesCompleted.length}/{totalObjectives}
      </div>
    </div>
  )
}
