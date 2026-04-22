/* ── HUD — heads-up display overlay with alert + event log ── */
import { useGameStore } from '../store/gameStore'

const ALERT_COLORS = ['#00ff88', '#ffcc00', '#ff4444', '#ff0055']
const ALERT_LABELS = ['GREEN', 'YELLOW', 'RED', 'LOCKDOWN']

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
    maxWidth: 280,
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
  eventLog: {
    background: 'rgba(10, 10, 25, 0.85)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: 6,
    padding: '8px 10px',
    maxHeight: 150,
    overflowY: 'auto' as const,
    backdropFilter: 'blur(8px)',
    pointerEvents: 'auto' as const,
  },
  logEntry: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#aaa',
    padding: '2px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  logTitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#00d4ff',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
}

export default function HUD() {
  const turn = useGameStore((s) => s.turn)
  const maxTurns = 50
  const score = useGameStore((s) => s.score)
  const gameStatus = useGameStore((s) => s.gameStatus)
  const objectivesCompleted = useGameStore((s) => s.objectivesCompleted)
  const building = useGameStore((s) => s.building)
  const alertLevel = useGameStore((s) => s.alertLevel)
  const eventLog = useGameStore((s) => s.eventLog)

  const totalObjectives = building?.objectives.length || 0
  const alertColor = ALERT_COLORS[alertLevel] || '#00ff88'
  const alertLabel = ALERT_LABELS[alertLevel] || 'GREEN'

  const statusStyle =
    gameStatus === 'won' ? styles.statusWon : gameStatus === 'lost' ? styles.statusLost : styles.statusActive

  return (
    <div style={styles.container}>
      <div style={styles.badge} title="Current turn number out of 50 maximum turns">
        <span style={styles.label}>Turn</span>
        {turn} / {maxTurns}
      </div>
      <div style={styles.badge} title="Your heist score — higher is better, bonus for speed">
        <span style={styles.label}>Score</span>
        {score}
      </div>
      <div style={styles.badge} title="Game status — ACTIVE means the heist is in progress">
        <span style={styles.label}>Status</span>
        <span style={statusStyle}>{gameStatus.toUpperCase()}</span>
      </div>
      <div style={styles.badge} title="Objectives completed — complete ALL to unlock extraction">
        <span style={styles.label}>Objectives</span>
        {objectivesCompleted.length}/{totalObjectives}
      </div>
      <div style={{
        ...styles.badge,
        borderColor: alertColor + '66',
        color: alertColor,
      }} title="Alert level — GREEN=safe, YELLOW=suspicious, RED=converging, LOCKDOWN=next detection loses the game">
        <span style={styles.label}>Alert</span>
        <span style={{ fontWeight: 700 }}>{alertLabel}</span>
      </div>

      {/* Event log */}
      {eventLog.length > 0 && (
        <div style={styles.eventLog}>
          <div style={styles.logTitle}>Event Log</div>
          {eventLog.slice(-8).map((msg, i) => (
            <div key={i} style={{
              ...styles.logEntry,
              color: msg.includes('LOCKDOWN') || msg.includes('CAUGHT') ? '#ff4444' :
                     msg.includes('ALERT') || msg.includes('SUSPICIOUS') ? '#ffcc00' :
                     msg.includes('complete') || msg.includes('COMPLETE') ? '#00ff88' :
                     '#aaa',
            }}>
              {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
