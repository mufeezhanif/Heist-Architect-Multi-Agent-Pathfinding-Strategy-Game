/**
 * GridCanvas2D — SVG renderer for a 2D grid with rich overlays.
 * Used by Arena and Bench pages. Intentionally simple & fast: pure SVG,
 * no Three.js, scales to ~40x40 grids easily.
 */
import { useMemo, useRef } from 'react'

export interface GridCanvas2DProps {
  width: number                    // grid width in cells
  height: number                   // grid height in cells
  cells: number[][]                // 1 = walkable, 0 = wall
  cellSize?: number                // px per cell (default auto-fit ~22px)

  start?: [number, number]
  goal?: [number, number]

  path?: [number, number][]        // solid path line
  paths?: Record<string, [number, number][]>  // multiple paths (CBS)

  frontier?: [number, number, number][]  // open list cells [x,y,f]
  closed?: [number, number][]            // closed set cells
  current?: [number, number]             // currently-being-expanded cell

  agents?: { id: string; pos: [number, number]; color?: string; label?: string }[]

  heatmap?: Record<string, number>       // "x,y" → probability (0-1) for Bayesian overlay

  onCellClick?: (x: number, y: number, ev: React.MouseEvent) => void
  onCellHover?: (x: number, y: number) => void

  showGrid?: boolean
  title?: string
}

const DEFAULT_COLORS = [
  '#00f0ff', '#ff003c', '#00ff66', '#fcee0a',
  '#ff6b35', '#c77dff', '#06d6a0', '#ffb4a2',
]

export default function GridCanvas2D(props: GridCanvas2DProps) {
  const {
    width, height, cells, cellSize: cellSizeProp,
    start, goal, path, paths, frontier, closed, current,
    agents, heatmap, onCellClick, onCellHover,
    showGrid = true, title,
  } = props

  const svgRef = useRef<SVGSVGElement>(null)

  const cellSize = cellSizeProp ?? Math.max(12, Math.min(32, Math.floor(640 / Math.max(width, height))))
  const svgW = width * cellSize
  const svgH = height * cellSize

  const pathSet = useMemo(() => {
    const s = new Set<string>()
    if (path) for (const [x, y] of path) s.add(`${x},${y}`)
    return s
  }, [path])

  const closedSet = useMemo(() => {
    const s = new Set<string>()
    if (closed) for (const [x, y] of closed) s.add(`${x},${y}`)
    return s
  }, [closed])

  const frontierMap = useMemo(() => {
    const m = new Map<string, number>()
    if (frontier) for (const [x, y, f] of frontier) m.set(`${x},${y}`, f)
    return m
  }, [frontier])

  const pathsEntries = paths ? Object.entries(paths) : []

  function cellFill(x: number, y: number): string {
    if (cells[y]?.[x] === 0) return '#0a0a12'  // wall

    // Heatmap overlay (Bayesian belief)
    if (heatmap) {
      const v = heatmap[`${x},${y}`] ?? 0
      if (v > 0.001) {
        // red intensity proportional to probability (capped at 1)
        const alpha = Math.min(1, v * 8)
        return `rgba(255, 0, 60, ${alpha})`
      }
    }

    const key = `${x},${y}`
    if (current && current[0] === x && current[1] === y) return '#fcee0a'
    if (pathSet.has(key)) return '#00ff66'
    if (frontierMap.has(key)) {
      // orange gradient by f-value (lower = lighter)
      return 'rgba(252, 238, 10, 0.35)'
    }
    if (closedSet.has(key)) return 'rgba(0, 240, 255, 0.15)'
    return '#15151f'
  }

  function handleClick(ev: React.MouseEvent<SVGSVGElement>) {
    if (!onCellClick) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * width)
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * height)
    if (x >= 0 && x < width && y >= 0 && y < height) onCellClick(x, y, ev)
  }

  function handleMove(ev: React.MouseEvent<SVGSVGElement>) {
    if (!onCellHover) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * width)
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * height)
    if (x >= 0 && x < width && y >= 0 && y < height) onCellHover(x, y)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {title && (
        <div style={{ fontSize: 14, color: '#00f0ff', fontWeight: 600, letterSpacing: 1 }}>
          {title}
        </div>
      )}
      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        onClick={handleClick}
        onMouseMove={handleMove}
        style={{
          background: '#050508',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          cursor: onCellClick ? 'crosshair' : 'default',
          display: 'block',
        }}
      >
        {/* Cells */}
        {cells.map((row, y) =>
          row.map((_, x) => (
            <rect
              key={`${x},${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={cellFill(x, y)}
              stroke={showGrid ? 'rgba(255, 255, 255, 0.04)' : 'none'}
              strokeWidth={showGrid ? 0.5 : 0}
            />
          ))
        )}

        {/* Frontier f-value labels (only if cell is big enough) */}
        {cellSize >= 24 && frontier && frontier.length < 200 && frontier.map(([fx, fy, f], i) => (
          <text
            key={`f${i}`}
            x={fx * cellSize + cellSize / 2}
            y={fy * cellSize + cellSize / 2 + 3}
            fill="#fcee0a"
            fontSize={Math.max(8, cellSize * 0.35)}
            textAnchor="middle"
            fontFamily="monospace"
          >
            {f.toFixed(0)}
          </text>
        ))}

        {/* Multiple paths (CBS) */}
        {pathsEntries.map(([id, pts], idx) => {
          if (!Array.isArray(pts) || pts.length < 2) return null
          const color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
          const d = pts.map((p, i) => {
            if (!Array.isArray(p) || p.length < 2) return ''
            const [x, y] = p
            const cx = x * cellSize + cellSize / 2
            const cy = y * cellSize + cellSize / 2
            return `${i === 0 ? 'M' : 'L'}${cx},${cy}`
          }).filter(Boolean).join(' ')
          if (!d) return null
          return (
            <g key={id}>
              <path d={d} stroke={color} strokeWidth={3} fill="none" opacity={0.85}
                    strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => {
                if (!Array.isArray(p) || p.length < 2) return null
                const [x, y] = p
                return (
                  <circle key={i} cx={x * cellSize + cellSize / 2}
                          cy={y * cellSize + cellSize / 2}
                          r={2} fill={color} opacity={0.8} />
                )
              })}
            </g>
          )
        })}

        {/* Single solid path */}
        {path && path.length >= 2 && (
          <path
            d={path.map(([x, y], i) => {
              const cx = x * cellSize + cellSize / 2
              const cy = y * cellSize + cellSize / 2
              return `${i === 0 ? 'M' : 'L'}${cx},${cy}`
            }).join(' ')}
            stroke="#00ff66"
            strokeWidth={4}
            fill="none"
            opacity={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Start marker */}
        {start && (
          <g transform={`translate(${start[0] * cellSize + cellSize / 2}, ${start[1] * cellSize + cellSize / 2})`}>
            <circle r={cellSize / 2.8} fill="#00ff66" opacity={0.9} />
            <text y={3} textAnchor="middle" fontSize={Math.max(10, cellSize * 0.5)} fill="#050508" fontWeight="bold">S</text>
          </g>
        )}

        {/* Goal marker */}
        {goal && (
          <g transform={`translate(${goal[0] * cellSize + cellSize / 2}, ${goal[1] * cellSize + cellSize / 2})`}>
            <circle r={cellSize / 2.8} fill="#ff003c" opacity={0.9} />
            <text y={3} textAnchor="middle" fontSize={Math.max(10, cellSize * 0.5)} fill="#fff" fontWeight="bold">G</text>
          </g>
        )}

        {/* Agents */}
        {agents && agents.map((a, i) => {
          if (!a || !Array.isArray(a.pos) || a.pos.length < 2) return null
          const color = a.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
          return (
            <g key={a.id} transform={`translate(${a.pos[0] * cellSize + cellSize / 2}, ${a.pos[1] * cellSize + cellSize / 2})`}>
              <circle r={cellSize / 3} fill={color} stroke="#fff" strokeWidth={1} />
              {a.label && (
                <text y={-cellSize * 0.45} textAnchor="middle" fontSize={10} fill="#fff" fontWeight="600">
                  {a.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
