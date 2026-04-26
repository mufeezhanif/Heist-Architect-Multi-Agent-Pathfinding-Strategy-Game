/* ── InlinePanel — non-draggable static wrapper for sidebar embedding ── */
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  title: string
  subtitle?: string
  color: string
}

export default function InlinePanel({ children, title, subtitle, color }: Props) {
  return (
    <div
      className="glass-panel"
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 10px ${color}22`,
        border: `1px solid ${color}44`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: `1px solid ${color}33`,
          background: `${color}0d`,
          borderRadius: '8px 8px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}`,
            }}
          />
          <span
            style={{
              fontFamily: 'Space Grotesk, monospace',
              fontWeight: 700,
              fontSize: '0.8rem',
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {title}
          </span>
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              marginTop: 3,
              fontFamily: 'monospace',
              fontWeight: 400,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
