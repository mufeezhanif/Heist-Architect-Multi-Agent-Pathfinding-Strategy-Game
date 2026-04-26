/* ── MinimaxPanel — guard strategy tree with plain-English summary ── */
import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { useGameStore } from '../store/gameStore'
import DraggablePanel from '../components/DraggablePanel'
import InlinePanel from '../components/InlinePanel'

const PANEL_W = 340
const TREE_H = 190

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

export default function MinimaxPanel({ inline = false }: { inline?: boolean } = {}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const minimaxLog = useGameStore((s) => s.minimaxLog)
  const show = useGameStore((s) => s.showMinimax)
  const toggleViz = useGameStore((s) => s.toggleViz)

  // Plain-English summary
  const summary = useMemo(() => {
    if (!minimaxLog.length) return null
    const root = buildMinimaxTree(minimaxLog)
    if (!root?.children?.length) return null
    const best = root.children.reduce((a, b) => a.score > b.score ? a : b)
    const pruned = root.children.filter(c => c.pruned).length
    return { bestAction: best.action, bestScore: best.score, total: root.children.length, pruned }
  }, [minimaxLog])

  useEffect(() => {
    if (!svgRef.current || !show) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const root = buildMinimaxTree(minimaxLog)
    if (!root || !root.children?.length) {
      svg.append('text')
        .attr('x', PANEL_W / 2)
        .attr('y', TREE_H / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#8892b0')
        .attr('font-family', 'monospace')
        .attr('font-size', 12)
        .text('Guard strategy tree will appear here…')
      return
    }

    const hierarchy = d3.hierarchy(root, (d) => d.children)
    const treeData = d3.tree<MNode>().size([PANEL_W - 40, TREE_H - 50])(hierarchy)
    const g = svg.append('g').attr('transform', 'translate(20, 25)')

    g.selectAll('.link')
      .data(treeData.links())
      .join('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      .attr('stroke', d => d.target.data.pruned ? 'rgba(255,255,255,0.1)' : 'rgba(255,107,53,0.4)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => d.target.data.pruned ? '3,3' : 'none')

    const nodeGroups = g.selectAll('.node')
      .data(treeData.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    nodeGroups.append('rect')
      .attr('x', -20).attr('y', -8).attr('width', 40).attr('height', 16).attr('rx', 4)
      .attr('fill', d => {
        if (d.data.pruned) return 'rgba(255,255,255,0.05)'
        if (d.depth === 0) return 'rgba(255,0,60,0.2)'
        return d.data.score > 0 ? 'rgba(0,255,102,0.2)' : 'rgba(255,0,60,0.2)'
      })
      .attr('stroke', d => d.data.pruned ? '#333' : 'var(--neon-magenta)')
      .attr('stroke-width', 1)

    nodeGroups.append('text')
      .attr('text-anchor', 'middle').attr('dy', 3)
      .attr('fill', d => d.data.pruned ? '#495670' : '#e6f1ff')
      .attr('font-size', 9).attr('font-family', 'monospace').attr('font-weight', 'bold')
      .text(d => `${d.data.score.toFixed(1)}`)

    nodeGroups.append('text')
      .attr('text-anchor', 'middle').attr('dy', -12)
      .attr('fill', '#a8b2d1').attr('font-size', 8).attr('font-family', 'monospace')
      .text(d => d.data.action.length > 14 ? d.data.action.slice(0, 12) + '…' : d.data.action)
  }, [minimaxLog, show])

  if (!show) return null

  const body = (
    <>
      {/* Plain-English summary */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,0,60,0.12)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
        {summary ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 14 }}>🎯</span>
              <span style={{ color: '#fcee0a' }}>
                Guards chose: <span style={{ color: 'var(--neon-magenta)', fontWeight: 700 }}>{summary.bestAction}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, color: '#8892b0', fontSize: '0.68rem' }}>
              <span>📋 {summary.total} moves evaluated</span>
              {summary.pruned > 0 && <span>✂️ {summary.pruned} discarded (too weak)</span>}
              <span style={{ color: summary.bestScore > 0 ? 'var(--neon-magenta)' : 'var(--neon-green)' }}>
                Threat: {summary.bestScore > 0 ? `+${summary.bestScore.toFixed(1)}` : summary.bestScore.toFixed(1)}
              </span>
            </div>
          </>
        ) : (
          <div style={{ color: '#8892b0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏳</span> Guard strategy appears after each turn execution
          </div>
        )}
      </div>
      {/* Legend */}
      <div style={{ padding: '4px 12px 5px', display: 'flex', gap: 10, fontSize: '0.65rem', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,0,60,0.08)' }}>
        <span style={{ color: 'var(--neon-green)' }}>■ Good for guards</span>
        <span style={{ color: 'var(--neon-magenta)' }}>■ Bad for you</span>
        <span style={{ color: '#495670' }}>-- Pruned</span>
      </div>
      <svg ref={svgRef} width={PANEL_W} height={TREE_H} />
    </>
  )

  if (inline) {
    return (
      <InlinePanel title="Guard Strategy (Minimax)" subtitle="How guards decide where to move to catch your crew" color="var(--neon-magenta)">
        {body}
      </InlinePanel>
    )
  }

  return (
    <DraggablePanel
      title="Guard Strategy (Minimax)"
      subtitle="How guards decide where to move to catch your crew"
      color="var(--neon-magenta)"
      defaultPos={{ x: 380, y: 480 }}
      width={PANEL_W}
      onClose={() => toggleViz('showMinimax')}
    >
      {body}
    </DraggablePanel>
  )
}
