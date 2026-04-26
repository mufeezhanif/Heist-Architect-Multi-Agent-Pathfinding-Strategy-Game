/* ── DraggablePanel — reusable draggable floating panel ── */
import { useRef, useState, useCallback, ReactNode } from 'react'

interface Props {
  children: ReactNode
  title: string
  subtitle?: string
  color: string
  defaultPos: { x: number; y: number }
  width: number
  onClose?: () => void
  extraHeader?: ReactNode
}

export default function DraggablePanel({
  children, title, subtitle, color, defaultPos, width, onClose, extraHeader,
}: Props) {
  const [pos, setPos] = useState(defaultPos)
  const drag = useRef({ active: false, ox: 0, oy: 0, px: 0, py: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    drag.current = { active: true, ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y }

    const onMove = (ev: MouseEvent) => {
      if (!drag.current.active) return
      setPos({
        x: drag.current.px + (ev.clientX - drag.current.ox),
        y: drag.current.py + (ev.clientY - drag.current.oy),
      })
    }
    const onUp = () => {
      drag.current.active = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 4px 30px rgba(0,0,0,0.5), 0 0 15px ${color}22`,
        border: `1px solid ${color}44`,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          cursor: 'grab',
          padding: '10px 12px 8px',
          borderBottom: `1px solid ${color}33`,
          background: `${color}0d`,
          userSelect: 'none',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{
              fontFamily: 'Space Grotesk, monospace',
              fontWeight: 700,
              fontSize: '0.8rem',
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>{title}</span>
            {extraHeader}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Drag indicator */}
            <span style={{ fontSize: 10, color: `${color}77`, fontFamily: 'monospace' }}>⠿ drag</span>
            {onClose && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: `${color}88`, fontSize: 14, lineHeight: 1, padding: '0 2px',
                }}
                title="Hide panel"
              >✕</button>
            )}
          </div>
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3, fontFamily: 'monospace', fontWeight: 400 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
