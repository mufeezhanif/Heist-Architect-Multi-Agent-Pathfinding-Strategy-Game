/* ── BayesianPanel — side panel with top probability cells ── */
import { useMemo } from 'react'
import { useGameStore } from '../store/gameStore'

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    bottom: 80,
    right: 12,
    width: 220,
    background: 'rgba(10, 10, 25, 0.9)',
    border: '1px solid rgba(233, 69, 96, 0.25)',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 15,
    backdropFilter: 'blur(8px)',
  },
  title: {
    padding: '6px 12px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#e94560',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    borderBottom: '1px solid rgba(233, 69, 96, 0.15)',
  },
  list: {
    padding: '6px 12px',
    maxHeight: 200,
    overflow: 'auto',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#ddd',
  },
  bar: {
    height: 4,
    borderRadius: 2,
    marginTop: 2,
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
    <div style={s.panel}>
      <div style={s.title}>Bayesian Belief (Top cells)</div>
      <div style={s.list}>
        {topCells.map(({ key, prob }) => (
          <div key={key}>
            <div style={s.row}>
              <span>({key})</span>
              <span style={{ color: prob > 0.3 ? '#e94560' : '#888' }}>
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{
              ...s.bar,
              width: `${Math.min(prob * 100, 100)}%`,
              background: `linear-gradient(90deg, #e94560, ${prob > 0.5 ? '#ff0055' : '#e9456044'})`,
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}
