/* ── BayesianPanel — side panel with top probability cells ── */
import { useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { motion } from 'framer-motion'

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    bottom: '24px',
    right: '24px',
    width: '260px',
    zIndex: 15,
  },
  title: {
    padding: '12px',
    fontSize: '0.85rem',
    fontFamily: 'Space Grotesk, sans-serif',
    fontWeight: 700,
    color: 'var(--neon-magenta)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    borderBottom: '1px solid var(--glass-border)',
  },
  list: {
    padding: '12px',
    maxHeight: '240px',
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    color: '#e6f1ff',
    fontWeight: 600,
  },
  barContainer: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    height: '6px',
    borderRadius: '3px',
    marginTop: '4px',
    marginBottom: '8px',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: '3px',
  },
}

export default function BayesianPanel() {
  const heatmap = useGameStore((st) => st.bayesianHeatmap)
  const show = useGameStore((st) => st.showBayesian)

  const topCells = useMemo(() => {
    return Object.entries(heatmap)
      .map(([key, prob]) => ({ key, prob }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 8)
  }, [heatmap])

  if (!show || topCells.length === 0) return null

  return (
    <motion.div 
      style={s.panel}
      className="glass-panel"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div style={s.title}>
        <div>Warden's Suspicion Map</div>
        <div style={{ fontSize: '0.7rem', color: '#8892b0', textTransform: 'none', letterSpacing: 0, marginTop: 4, fontWeight: 400 }}>
          Where the Warden thinks your crew is hiding
        </div>
      </div>
      <div style={s.list}>
        {topCells.map(({ key, prob }, i) => (
          <motion.div 
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div style={s.row}>
              <span style={{ color: '#a8b2d1' }}>({key})</span>
              <span style={{ color: prob > 0.3 ? 'var(--neon-magenta)' : '#8892b0', textShadow: prob > 0.3 ? '0 0 5px var(--neon-magenta)' : 'none' }}>
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
            <div style={s.barContainer}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(prob * 100, 100)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  ...s.bar,
                  background: prob > 0.5 ? 'var(--neon-magenta)' : 'linear-gradient(90deg, rgba(255,0,60,0.4), rgba(255,0,60,0.8))',
                  boxShadow: prob > 0.3 ? '0 0 10px var(--neon-magenta)' : 'none'
                }} 
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
