/* ── GameOverScreen — win/lose overlay ── */
import { useGameStore } from '../store/gameStore'

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.8)',
    zIndex: 100,
    backdropFilter: 'blur(6px)',
  },
  title: {
    fontSize: 56,
    fontWeight: 900,
    fontFamily: 'monospace',
    letterSpacing: 6,
    marginBottom: 16,
  },
  score: {
    fontSize: 22,
    color: '#e0e0e0',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'monospace',
    marginBottom: 24,
  },
  btn: {
    padding: '14px 36px',
    border: '2px solid #00d4ff',
    borderRadius: 8,
    background: 'transparent',
    color: '#00d4ff',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  },
}

export default function GameOverScreen() {
  const gameStatus = useGameStore((st) => st.gameStatus)
  const score = useGameStore((st) => st.score)
  const turn = useGameStore((st) => st.turn)
  const objectivesCompleted = useGameStore((st) => st.objectivesCompleted)
  const reset = useGameStore((st) => st.reset)

  if (gameStatus === 'active') return null

  const won = gameStatus === 'won'

  return (
    <div style={s.overlay}>
      <div style={{ ...s.title, color: won ? '#00ff88' : '#ff0055' }}>
        {won ? 'HEIST COMPLETE' : 'BUSTED'}
      </div>
      <div style={s.score}>Score: {score}</div>
      <div style={s.info}>
        Turns: {turn} | Objectives: {objectivesCompleted.length}
      </div>
      <button style={s.btn} onClick={reset}>
        Back to Menu
      </button>
    </div>
  )
}
