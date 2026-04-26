/* ── LeftSidebar — algorithm status, sensor alerts, play-by-play narration ── */
import AlgorithmStatus from './AlgorithmStatus'
import SensorLog from './SensorLog'
import NarrationPanel from './NarrationPanel'

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 320,
    height: '100vh',
    background: 'rgba(5, 5, 12, 0.92)',
    borderRight: '1px solid rgba(0, 212, 255, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '14px 12px',
    overflowY: 'auto',
    flexShrink: 0,
    backdropFilter: 'blur(8px)',
    boxShadow: '4px 0 18px rgba(0,0,0,0.4)',
  },
  header: {
    fontFamily: 'Space Grotesk, monospace',
    fontSize: '0.72rem',
    color: 'var(--neon-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    padding: '4px 4px 6px',
    borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
    marginBottom: 4,
  },
}

export default function LeftSidebar() {
  return (
    <aside style={s.sidebar}>
      <div style={s.header}>Live Algorithm Activity</div>
      <AlgorithmStatus inline />
      <SensorLog inline />
      <NarrationPanel inline />
    </aside>
  )
}
