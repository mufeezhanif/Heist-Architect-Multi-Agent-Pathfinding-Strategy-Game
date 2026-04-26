/* ── CBSTreePanel — CBS constraint tree with plain-English summary ── */
import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { useGameStore } from '../store/gameStore'
import DraggablePanel from '../components/DraggablePanel'
import InlinePanel from '../components/InlinePanel'

const PANEL_W = 340
const TREE_H = 200

interface TreeNode {
  id: string
  parent: string | null
  label: string
  cost: number
  status: 'exploring' | 'conflict' | 'resolved' | 'pruned'
  children: TreeNode[]
}

function buildTree(events: { step: string;[key: string]: unknown }[]): TreeNode | null {
  const nodes = new Map<string, TreeNode>()
  const rootId = 'root'
  nodes.set(rootId, { id: rootId, parent: null, label: 'Start', cost: 0, status: 'exploring', children: [] })

  for (const ev of events) {
    const step = ev.step as string
    if (step === 'cbs_expand') {
      const nodeId = (ev.node_id as string) || `n${nodes.size}`
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, { id: nodeId, parent: rootId, label: 'Try', cost: (ev.cost as number) || 0, status: 'exploring', children: [] })
        nodes.get(rootId)!.children.push(nodes.get(nodeId)!)
      }
    } else if (step === 'cbs_conflict') {
      const parentId = (ev.parent_id as string) || [...nodes.keys()].pop() || rootId
      const nodeId = `conflict_${nodes.size}`
      const a1 = (ev.agent1 as string) || '?'
      const a2 = (ev.agent2 as string) || '?'
      const node: TreeNode = { id: nodeId, parent: parentId, label: `${a1}↔${a2}`, cost: 0, status: 'conflict', children: [] }
      nodes.set(nodeId, node)
      nodes.get(parentId)?.children.push(node)
    } else if (step === 'cbs_branch') {
      const parentId = (ev.parent_id as string) || [...nodes.keys()].pop() || rootId
      const nodeId = (ev.branch_id as string) || `branch_${nodes.size}`
      const node: TreeNode = {
        id: nodeId, parent: parentId,
        label: `Re-route ${(ev.agent as string) || ''}`,
        cost: (ev.cost as number) || 0, status: 'exploring', children: [],
      }
      nodes.set(nodeId, node)
      nodes.get(parentId)?.children.push(node)
    } else if (step === 'cbs_solution') {
      const lastNode = [...nodes.values()].pop()
      if (lastNode) lastNode.status = 'resolved'
    }
  }

  return nodes.get(rootId) || null
}

export default function CBSTreePanel({ inline = false }: { inline?: boolean } = {}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const cbsEvents = useGameStore((s) => s.cbsEvents)
  const show = useGameStore((s) => s.showCBSTree)
  const toggleViz = useGameStore((s) => s.toggleViz)

  // Plain-English summary
  const summary = useMemo(() => {
    const conflicts = cbsEvents.filter(e => e.step === 'cbs_conflict').length
    const branches = cbsEvents.filter(e => e.step === 'cbs_branch').length
    const solved = cbsEvents.some(e => e.step === 'cbs_solution')
    return { conflicts, branches, solved }
  }, [cbsEvents])

  useEffect(() => {
    if (!svgRef.current || !show) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const root = buildTree(cbsEvents)
    if (!root || root.children.length === 0) {
      svg.append('text')
        .attr('x', PANEL_W / 2).attr('y', TREE_H / 2)
        .attr('text-anchor', 'middle').attr('fill', '#8892b0')
        .attr('font-family', 'monospace').attr('font-size', 12)
        .text('Planning tree will appear here…')
      return
    }

    const hierarchy = d3.hierarchy(root, (d) => d.children)
    const treeData = d3.tree<TreeNode>().size([PANEL_W - 40, TREE_H - 40])(hierarchy)
    const g = svg.append('g').attr('transform', 'translate(20,20)')

    const statusColor: Record<string, string> = {
      exploring: 'var(--neon-cyan)',
      conflict: 'var(--neon-magenta)',
      resolved: 'var(--neon-green)',
      pruned: '#495670',
    }

    g.selectAll('.link')
      .data(treeData.links())
      .join('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      .attr('stroke', 'rgba(0,240,255,0.2)').attr('stroke-width', 1.5)

    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    nodes.append('circle')
      .attr('r', 5)
      .attr('fill', d => statusColor[d.data.status] || '#555')
      .attr('stroke', d => d.data.status === 'resolved' ? 'var(--neon-green)' : 'none')
      .attr('stroke-width', 2)

    nodes.append('text')
      .attr('dy', -9).attr('text-anchor', 'middle')
      .attr('fill', '#a8b2d1').attr('font-size', 8).attr('font-family', 'monospace')
      .text(d => d.data.label)
  }, [cbsEvents, show])

  if (!show) return null

  const statusEmoji = summary.solved ? '✅' : summary.conflicts > 0 ? '⚠️' : '🔍'
  const statusText = summary.solved
    ? 'All crew paths are collision-free!'
    : summary.conflicts > 0
    ? `${summary.conflicts} crew member collision${summary.conflicts > 1 ? 's' : ''} — trying detours`
    : cbsEvents.length === 0
    ? 'Waiting for you to assign waypoints & plan…'
    : 'Calculating collision-free routes…'

  const body = (
    <>
      {/* Plain-English status */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,240,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontFamily: 'monospace' }}>
          <span style={{ fontSize: 15 }}>{statusEmoji}</span>
          <span style={{ color: summary.solved ? 'var(--neon-green)' : summary.conflicts > 0 ? '#fcee0a' : '#8892b0' }}>
            {statusText}
          </span>
        </div>
        {cbsEvents.length > 0 && (
          <div style={{ display: 'flex', gap: 12, color: '#8892b0', fontSize: '0.68rem', fontFamily: 'monospace', marginTop: 4 }}>
            <span>🔍 {cbsEvents.length} paths explored</span>
            {summary.branches > 0 && <span style={{ color: 'var(--neon-cyan)' }}>🔀 {summary.branches} reroutes tried</span>}
          </div>
        )}
      </div>
      {/* Color legend */}
      <div style={{ padding: '4px 12px 5px', display: 'flex', gap: 12, fontSize: '0.65rem', fontFamily: 'monospace', borderBottom: '1px solid rgba(0,240,255,0.08)' }}>
        <span style={{ color: 'var(--neon-cyan)' }}>● Exploring</span>
        <span style={{ color: 'var(--neon-magenta)' }}>● Conflict</span>
        <span style={{ color: 'var(--neon-green)' }}>● Resolved</span>
      </div>
      <svg ref={svgRef} width={PANEL_W} height={TREE_H} />
    </>
  )

  if (inline) {
    return (
      <InlinePanel title="Route Planning (CBS)" subtitle="How AI finds safe paths without crew colliding" color="var(--neon-cyan)">
        {body}
      </InlinePanel>
    )
  }

  return (
    <DraggablePanel
      title="Route Planning (CBS)"
      subtitle="How AI finds safe paths without crew colliding"
      color="var(--neon-cyan)"
      defaultPos={{ x: 20, y: 480 }}
      width={PANEL_W}
      onClose={() => toggleViz('showCBSTree')}
    >
      {body}
    </DraggablePanel>
  )
}

