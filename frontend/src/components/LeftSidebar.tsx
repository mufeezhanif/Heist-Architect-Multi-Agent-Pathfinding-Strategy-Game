/* ── LeftSidebar — game status + algorithm activity (collapsible) ── */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import HUD from './HUD'
import AlgorithmStatus from './AlgorithmStatus'
import SensorLog from './SensorLog'
import NarrationPanel from './NarrationPanel'

const EXPANDED_WIDTH = 320
const COLLAPSED_WIDTH = 40

export default function LeftSidebar() {
  const [expanded, setExpanded] = useState(true)

  return (
    <aside
      style={{
        width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        height: '100vh',
        background: 'rgba(5, 5, 12, 0.92)',
        borderRight: '1px solid rgba(0, 212, 255, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        backdropFilter: 'blur(8px)',
        boxShadow: '4px 0 18px rgba(0,0,0,0.4)',
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
          right: 6,
          zIndex: 20,
          background: 'rgba(0,212,255,0.1)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 6,
          color: 'var(--neon-cyan)',
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
        {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Content — only visible when expanded */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 10px 16px',
            overflowY: 'auto',
            flex: 1,
            minWidth: EXPANDED_WIDTH,
          }}
        >
          {/* Section: Game Status */}
          <div
            style={{
              fontFamily: 'Space Grotesk, monospace',
              fontSize: '0.68rem',
              color: 'var(--neon-cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              padding: '2px 4px 6px',
              borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
              paddingRight: 38,
            }}
          >
            Game Status
          </div>
          <HUD inline />

          {/* Section: Algorithm Activity */}
          <div
            style={{
              fontFamily: 'Space Grotesk, monospace',
              fontSize: '0.68rem',
              color: 'var(--neon-cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              padding: '4px 4px 6px',
              borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
              marginTop: 4,
            }}
          >
            Live Algorithm Activity
          </div>
          <AlgorithmStatus inline />
          <SensorLog inline />
          <NarrationPanel inline />
        </div>
      )}
    </aside>
  )
}
