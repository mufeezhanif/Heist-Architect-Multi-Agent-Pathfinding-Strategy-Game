/* ── RightSidebar — viz toggles + CBS / Bayesian / Minimax algorithm panels ── */
import SpeedControls from './SpeedControls'
import CBSTreePanel from '../visualizations/CBSTreePanel'
import BayesianPanel from '../visualizations/BayesianPanel'
import MinimaxPanel from '../visualizations/MinimaxPanel'

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 360,
    height: '100vh',
    background: 'rgba(5, 5, 12, 0.92)',
    borderLeft: '1px solid rgba(255, 0, 60, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '14px 12px',
    overflowY: 'auto',
    flexShrink: 0,
    backdropFilter: 'blur(8px)',
    boxShadow: '-4px 0 18px rgba(0,0,0,0.4)',
  },
  header: {
    fontFamily: 'Space Grotesk, monospace',
    fontSize: '0.72rem',
    color: 'var(--neon-magenta)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    padding: '4px 4px 6px',
    borderBottom: '1px solid rgba(255, 0, 60, 0.15)',
    marginBottom: 4,
  },
}

export default function RightSidebar() {
  return (
    <aside style={s.sidebar}>
      <div style={s.header}>AI Visualizations</div>
      <SpeedControls inline />
      <CBSTreePanel inline />
      <BayesianPanel inline />
      <MinimaxPanel inline />
    </aside>
  )
}
