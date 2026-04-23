/* ── MinimaxPanel — minimax decision tree visualization ── */
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useGameStore } from '../store/gameStore'

const PANEL_W = 340
const PANEL_H = 240

interface MNode {
  action: string
  score: number
  pruned?: boolean
  children?: MNode[]
}

function buildMinimaxTree(logs: Record<string, unknown>[]): MNode | null {
  if (logs.length === 0) return null

  // Build a simple tree from logged actions
  const root: MNode = { action: 'Warden', score: 0, children: [] }

  for (const log of logs) {
    const action = (log.action as string) || 'Move'
    const score = (log.score as number) || 0
    const pruned = (log.pruned as boolean) || false
    const child: MNode = { action, score, pruned, children: [] }

    // Simulate child evaluations
    if (log.evaluations && Array.isArray(log.evaluations)) {
      for (const ev of log.evaluations as Record<string, unknown>[]) {
        child.children!.push({
          action: (ev.thief_response as string) || 'Thief move',
          score: (ev.value as number) || 0,
          pruned: (ev.pruned as boolean) || false,
        })
      }
    }

    root.children!.push(child)
  }

  // Find best action
  if (root.children!.length > 0) {
    const best = root.children!.reduce((a, b) => a.score > b.score ? a : b)
    root.score = best.score
  }

  return root
}

export default function MinimaxPanel() {
  const svgRef = useRef<SVGSVGElement>(null)
  const minimaxLog = useGameStore((s) => s.minimaxLog)
  const show = useGameStore((s) => s.showMinimax)

  useEffect(() => {
    if (!svgRef.current || !show) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const root = buildMinimaxTree(minimaxLog)
    if (!root || !root.children?.length) {
      svg.append('text')
        .attr('x', PANEL_W / 2)
        .attr('y', PANEL_H / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#8892b0')
        .attr('font-family', 'monospace')
        .attr('font-size', 12)
        .text('Minimax tree appears after turn execution…')
      return
    }

    const hierarchy = d3.hierarchy(root, (d) => d.children)
    const treeLayout = d3.tree<MNode>().size([PANEL_W - 40, PANEL_H - 60])
    const treeData = treeLayout(hierarchy)

    const g = svg.append('g').attr('transform', 'translate(20, 30)')

    // Links
    g.selectAll('.link')
      .data(treeData.links())
      .join('line')
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y)
      .attr('stroke', (d) => d.target.data.pruned ? 'rgba(255,255,255,0.1)' : 'rgba(255, 107, 53, 0.4)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d) => d.target.data.pruned ? '3,3' : 'none')

    // Nodes
    const nodeGroups = g.selectAll('.node')
      .data(treeData.descendants())
      .join('g')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)

    nodeGroups.append('rect')
      .attr('x', -20)
      .attr('y', -8)
      .attr('width', 40)
      .attr('height', 16)
      .attr('rx', 4)
      .attr('fill', (d) => {
        if (d.data.pruned) return 'rgba(255,255,255,0.05)'
        if (d.depth === 0) return 'rgba(255, 0, 60, 0.2)'
        return d.data.score > 0 ? 'rgba(0, 255, 102, 0.2)' : 'rgba(255, 0, 60, 0.2)'
      })
      .attr('stroke', (d) => d.data.pruned ? '#333' : 'var(--neon-magenta)')
      .attr('stroke-width', 1)

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 3)
      .attr('fill', (d) => d.data.pruned ? '#495670' : '#e6f1ff')
      .attr('font-size', 9)
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text((d) => `${d.data.score.toFixed(1)}`)

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -12)
      .attr('fill', '#a8b2d1')
      .attr('font-size', 8)
      .attr('font-family', 'monospace')
      .text((d) => {
        const a = d.data.action
        return a.length > 14 ? a.slice(0, 12) + '…' : a
      })

  }, [minimaxLog, show])

  if (!show) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 360,
      width: PANEL_W,
      height: PANEL_H,
      zIndex: 15,
    }} className="glass-panel">
      <div style={{
        padding: '12px',
        fontSize: '0.85rem',
        fontFamily: 'Space Grotesk, sans-serif',
        fontWeight: 700,
        color: 'var(--neon-magenta)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        borderBottom: '1px solid var(--glass-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Warden's Strategy — Minimax
        </div>
        <div style={{ fontSize: '0.7rem', color: '#8892b0', textTransform: 'none', letterSpacing: 0, marginTop: 4, fontWeight: 400 }}>
          Deciding how to reposition guards to catch you
        </div>
      </div>
      <svg ref={svgRef} width={PANEL_W} height={PANEL_H - 45} />
    </div>
  )
}
