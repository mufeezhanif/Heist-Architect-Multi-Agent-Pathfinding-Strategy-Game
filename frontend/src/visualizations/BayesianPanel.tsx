/* ── BayesianPanel — Warden suspicion map with maze overlay ── */
import { useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { motion } from 'framer-motion'
import DraggablePanel from '../components/DraggablePanel'
import InlinePanel from '../components/InlinePanel'

const PANEL_W = 270

export default function BayesianPanel({ inline = false }: { inline?: boolean } = {}) {
  const heatmap = useGameStore((st) => st.bayesianHeatmap)
  const show = useGameStore((st) => st.showBayesian)
  const toggleViz = useGameStore((st) => st.toggleViz)

  const topCells = useMemo(() => {
    return Object.entries(heatmap)
      .map(([key, prob]) => ({ key, prob }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 8)
  }, [heatmap])

  if (!show || topCells.length === 0) return null

  const totalSuspicion = topCells.reduce((acc, c) => acc + c.prob, 0)
  const highAlert = topCells[0]?.prob > 0.4

  const body = (
    <>
      {/* Status summary */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,0,60,0.15)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 14 }}>{highAlert ? '🚨' : '👁️'}</span>
          <span style={{ color: highAlert ? 'var(--neon-magenta)' : '#8892b0' }}>
            {highAlert
              ? 'Guards are converging on your crew!'
              : topCells.length > 0
              ? 'Guards are searching — keep moving'
              : 'No suspicion yet — you\'re in the clear'}
          </span>
        </div>
        {/* Map overlay indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#00ff88', fontSize: '0.68rem' }}>
          <span>🗺️</span>
          <span>Color heatmap visible on the maze (blue→yellow→red)</span>
        </div>
      </div>

      {/* Color scale legend */}
      <div style={{ padding: '5px 12px 4px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,0,60,0.1)' }}>
        <span style={{ color: '#8892b0' }}>Low</span>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'linear-gradient(to right, #1a3a6e, #f0a020, #ff003c)' }} />
        <span style={{ color: '#ff003c' }}>High</span>
      </div>

      {/* Top suspects list */}
      <div style={{ padding: '8px 12px', maxHeight: 220, overflowY: 'auto' }}>
        {topCells.map(({ key, prob }, i) => {
          const [x, y] = key.split(',').map(Number)
          const dangerLabel = prob > 0.5 ? '🔴 HIGH' : prob > 0.25 ? '🟡 MED' : '🔵 LOW'
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{ marginBottom: 8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontFamily: 'monospace', color: '#e6f1ff', marginBottom: 2 }}>
                <span style={{ color: '#a8b2d1' }}>
                  {i === 0 ? '👑 ' : ''}{`Tile (${x}, ${y})`}
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem' }}>{dangerLabel}</span>
                  <span style={{ color: prob > 0.3 ? 'var(--neon-magenta)' : '#8892b0', fontWeight: 700 }}>
                    {(prob * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: 5, borderRadius: 3, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(prob * 100, 100)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 3,
                    background: prob > 0.5 ? 'var(--neon-magenta)' : prob > 0.25 ? '#f0a020' : '#1a6eb5',
                    boxShadow: prob > 0.3 ? '0 0 6px var(--neon-magenta)' : 'none',
                  }}
                />
              </div>
            </motion.div>
          )
        })}
        {topCells.length > 0 && (
          <div style={{ fontSize: '0.65rem', color: '#495670', fontFamily: 'monospace', textAlign: 'right', marginTop: 4 }}>
            Total suspicion: {(totalSuspicion * 100).toFixed(0)}% tracked
          </div>
        )}
      </div>
    </>
  )

  if (inline) {
    return (
      <InlinePanel title="Warden's Suspicion" subtitle="Which tiles the Warden thinks your crew might be on" color="var(--neon-magenta)">
        {body}
      </InlinePanel>
    )
  }

  return (
    <DraggablePanel
      title="Warden's Suspicion"
      subtitle="Which tiles the Warden thinks your crew might be on"
      color="var(--neon-magenta)"
      defaultPos={{ x: Math.max(0, window.innerWidth - PANEL_W - 24), y: 380 }}
      width={PANEL_W}
      onClose={() => toggleViz('showBayesian')}
    >
      {body}
    </DraggablePanel>
  )
}
