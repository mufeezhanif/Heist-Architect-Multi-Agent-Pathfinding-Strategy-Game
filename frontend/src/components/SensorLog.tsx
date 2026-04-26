/* ── SensorLog — recent sensor events display ── */
import { useState } from 'react'
import { useGameStore } from '../store/gameStore'

const EVENT_COLORS: Record<string, string> = {
  door_trigger: '#e94560',
  motion_trigger: '#ff6b35',
  camera_trigger: '#ff0055',
  sound_detected: '#00d4ff',
  door_silent: '#333',
  motion_silent: '#333',
  camera_silent: '#333',
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    top: 84,
    left: 12,
    width: 220,
    maxHeight: 180,
    background: 'rgba(10, 10, 25, 0.85)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 8,
    backdropFilter: 'blur(8px)',
    pointerEvents: 'auto',
  },
  panelInline: {
    position: 'relative',
    width: '100%',
    background: 'rgba(10, 10, 25, 0.85)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
  },
  title: {
    padding: '6px 12px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#00d4ff',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  list: {
    padding: '4px 12px',
    maxHeight: 160,
    overflowY: 'auto' as const,
  },
  event: {
    display: 'flex',
    gap: 8,
    padding: '3px 0',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  collapseBtn: {
    border: '1px solid rgba(0, 212, 255, 0.25)',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.3)',
    color: '#00d4ff',
    fontSize: 9,
    fontFamily: 'monospace',
    padding: '2px 6px',
    cursor: 'pointer',
  },
}

interface Props { inline?: boolean }

export default function SensorLog({ inline = false }: Props = {}) {
  const sensorEvents = useGameStore((st) => st.sensorEvents)
  const [collapsed, setCollapsed] = useState(inline ? false : true)

  // Only show trigger events, not silent ones
  const triggers = sensorEvents.filter(
    (e) => !e.event_type.includes('silent'),
  )

  if (triggers.length === 0) return null

  const recent = triggers.slice(-8)

  return (
    <div style={inline ? s.panelInline : s.panel}>
      <div style={s.title}>
        <span>Sensor Alerts ({triggers.length})</span>
        <button
          style={s.collapseBtn}
          onClick={(e) => {
            e.stopPropagation()
            setCollapsed((v) => !v)
          }}
        >
          {collapsed ? 'SHOW' : 'HIDE'}
        </button>
      </div>
      {!collapsed && (
        <div style={s.list}>
          {recent.map((ev, i) => (
            <div key={`${ev.event_type}-${ev.pos[0]}-${ev.pos[1]}-${i}`} style={s.event}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: EVENT_COLORS[ev.event_type] || '#555',
                marginTop: 4,
                flexShrink: 0,
              }} />
              <span style={{ color: EVENT_COLORS[ev.event_type] || '#888' }}>
                {ev.event_type.replace('_', ' ')}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                ({ev.pos[0]},{ev.pos[1]})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
