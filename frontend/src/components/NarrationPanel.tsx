/* ── NarrationPanel — play-by-play narration during execution ── */
import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  move: { icon: '🏃', color: '#00d4ff' },
  sensor: { icon: '⚠️', color: '#ffcc00' },
  warden: { icon: '🛡️', color: '#e94560' },
  objective: { icon: '✅', color: '#00ff88' },
  alert: { icon: '🚨', color: '#ff4444' },
  info: { icon: '🤖', color: '#9b59b6' },
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    right: 12,
    top: 240,
    width: 280,
    maxHeight: 320,
    background: 'rgba(10, 10, 25, 0.92)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 15,
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
  },
  panelInline: {
    position: 'relative',
    width: '100%',
    maxHeight: 360,
    background: 'rgba(10, 10, 25, 0.92)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '8px 12px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#00d4ff',
    textTransform: 'uppercase',
    letterSpacing: 2,
    borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerDesc: {
    fontSize: 9,
    color: 'var(--text-muted)',
    fontWeight: 400,
    letterSpacing: 0,
    textTransform: 'none',
  },
  list: {
    padding: '6px 0',
    overflowY: 'auto',
    flex: 1,
  },
  entry: {
    display: 'flex',
    gap: 8,
    padding: '6px 12px',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 1.5,
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    transition: 'background 0.3s',
  },
  icon: {
    fontSize: 13,
    flexShrink: 0,
    width: 20,
    textAlign: 'center',
  },
  empty: {
    padding: '20px 12px',
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
  },
}

interface Props { inline?: boolean }

export default function NarrationPanel({ inline = false }: Props = {}) {
  const narrationEntries = useGameStore((s) => s.narrationEntries)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [narrationEntries])

  return (
    <div style={inline ? s.panelInline : s.panel}>
      <div style={s.header}>
        <span>Play-by-Play</span>
        <span style={s.headerDesc}>What's happening & why</span>
      </div>
      <div style={s.list} ref={listRef}>
        {narrationEntries.length === 0 ? (
          <div style={s.empty}>
            Narration will appear here during execution.<br />
            It explains each move, sensor trigger, and Warden reaction.
          </div>
        ) : (
          narrationEntries.map((entry, i) => {
            const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.info
            return (
              <div
                key={i}
                style={{
                  ...s.entry,
                  background: i === narrationEntries.length - 1 ? 'rgba(0, 212, 255, 0.04)' : 'transparent',
                }}
              >
                <span style={s.icon}>{config.icon}</span>
                <span style={{ color: config.color }}>{entry.text}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
