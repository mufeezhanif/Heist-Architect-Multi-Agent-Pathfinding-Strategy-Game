/* ── SensorLog — recent sensor events display ── */
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
    top: 200,
    left: 12,
    width: 220,
    maxHeight: 200,
    background: 'rgba(10, 10, 25, 0.85)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 12,
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
}

export default function SensorLog() {
  const sensorEvents = useGameStore((st) => st.sensorEvents)

  // Only show trigger events, not silent ones
  const triggers = sensorEvents.filter(
    (e) => !e.event_type.includes('silent'),
  )

  if (triggers.length === 0) return null

  return (
    <div style={s.panel}>
      <div style={s.title}>Sensor Alerts</div>
      <div style={s.list}>
        {triggers.map((ev, i) => (
          <div key={i} style={s.event}>
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
            <span style={{ color: '#555' }}>
              ({ev.pos[0]},{ev.pos[1]})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
