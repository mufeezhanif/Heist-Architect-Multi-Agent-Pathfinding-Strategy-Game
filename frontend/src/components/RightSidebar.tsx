/* ── RightSidebar — viz toggles + CBS / Bayesian / Minimax algorithm panels (collapsible) ── */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SpeedControls from './SpeedControls'
import CBSTreePanel from '../visualizations/CBSTreePanel'
import BayesianPanel from '../visualizations/BayesianPanel'
import MinimaxPanel from '../visualizations/MinimaxPanel'

const EXPANDED_WIDTH = 360
const COLLAPSED_WIDTH = 40

export default function RightSidebar() {
  const [expanded, setExpanded] = useState(true)

  return (
    <aside
      style={{
        width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        height: '100vh',
        background: 'rgba(5, 5, 12, 0.92)',
        borderLeft: '1px solid rgba(255, 0, 60, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        backdropFilter: 'blur(8px)',
        boxShadow: '-4px 0 18px rgba(0,0,0,0.4)',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Collapse / expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          position: 'absolute',
          top: 10,
          left: 6,
          zIndex: 20,
          background: 'rgba(255,0,60,0.1)',
          border: '1px solid rgba(255,0,60,0.3)',
          borderRadius: 6,
          color: 'var(--neon-magenta)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          padding: 0,
          flexShrink: 0,
        }}
      >
        {expanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Content — only visible when expanded */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '12px 10px 16px',
            overflowY: 'auto',
            flex: 1,
            minWidth: EXPANDED_WIDTH,
          }}
        >
          <div
            style={{
              fontFamily: 'Space Grotesk, monospace',
              fontSize: '0.68rem',
              color: 'var(--neon-magenta)',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              padding: '2px 4px 6px',
              borderBottom: '1px solid rgba(255, 0, 60, 0.15)',
              paddingLeft: 38,
            }}
          >
            AI Visualizations
          </div>
          <SpeedControls inline />
          <CBSTreePanel inline />
          <BayesianPanel inline />
          <MinimaxPanel inline />
        </div>
      )}
    </aside>
  )
}
