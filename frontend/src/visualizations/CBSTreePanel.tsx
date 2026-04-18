/* ── CBSTreePanel — animated CBS constraint tree using D3 ── */
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useGameStore } from '../store/gameStore'

const PANEL_W = 340
const PANEL_H = 280

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

  let rootId = 'root'
  nodes.set(rootId, { id: rootId, parent: null, label: 'Root', cost: 0, status: 'exploring', children: [] })

  for (const ev of events) {
    const step = ev.step as string

    if (step === 'cbs_init' || step === 'astar_start') {
      // Initialization events
    } else if (step === 'cbs_expand') {
      const nodeId = (ev.node_id as string) || `n${nodes.size}`
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, { id: nodeId, parent: rootId, label: `Expand`, cost: (ev.cost as number) || 0, status: 'exploring', children: [] })
        nodes.get(rootId)!.children.push(nodes.get(nodeId)!)
      }
    } else if (step === 'cbs_conflict') {
      const parentId = (ev.parent_id as string) || [...nodes.keys()].pop() || rootId
      const nodeId = `conflict_${nodes.size}`
      const agent1 = (ev.agent1 as string) || '?'
      const agent2 = (ev.agent2 as string) || '?'
      const node: TreeNode = {
        id: nodeId,
        parent: parentId,
        label: `${agent1}↔${agent2}`,
        cost: 0,
        status: 'conflict',
        children: [],
      }
      nodes.set(nodeId, node)

      const parent = nodes.get(parentId)
      if (parent) parent.children.push(node)
    } else if (step === 'cbs_branch') {
      const parentId = (ev.parent_id as string) || [...nodes.keys()].pop() || rootId
      const nodeId = (ev.branch_id as string) || `branch_${nodes.size}`
      const node: TreeNode = {
        id: nodeId,
        parent: parentId,
        label: `Branch ${(ev.agent as string) || ''}`,
        cost: (ev.cost as number) || 0,
        status: 'exploring',
        children: [],
      }
      nodes.set(nodeId, node)
      const parent = nodes.get(parentId)
      if (parent) parent.children.push(node)
    } else if (step === 'cbs_solution') {
      // Mark last node as resolved
      const lastNode = [...nodes.values()].pop()
      if (lastNode) lastNode.status = 'resolved'
    }
  }

  return nodes.get(rootId) || null
}

export default function CBSTreePanel() {
  const svgRef = useRef<SVGSVGElement>(null)
  const cbsEvents = useGameStore((s) => s.cbsEvents)
  const show = useGameStore((s) => s.showCBSTree)

  useEffect(() => {
    if (!svgRef.current || !show) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const root = buildTree(cbsEvents)
    if (!root || root.children.length === 0) {
      svg.append('text')
        .attr('x', PANEL_W / 2)
        .attr('y', PANEL_H / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#555')
        .attr('font-family', 'monospace')
        .attr('font-size', 12)
        .text('CBS tree will appear during planning…')
      return
    }

    const hierarchy = d3.hierarchy(root, (d) => d.children)
    const treeLayout = d3.tree<TreeNode>().size([PANEL_W - 40, PANEL_H - 60])
    const treeData = treeLayout(hierarchy)

    const g = svg.append('g').attr('transform', 'translate(20, 30)')

    // Links
    g.selectAll('.link')
      .data(treeData.links())
      .join('line')
      .attr('class', 'link')
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y)
      .attr('stroke', '#333')
      .attr('stroke-width', 1)

    // Nodes
    const statusColor: Record<string, string> = {
      exploring: '#00d4ff',
      conflict: '#e94560',
      resolved: '#00ff88',
      pruned: '#444',
    }

    const nodeGroups = g.selectAll('.node')
      .data(treeData.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)

    nodeGroups.append('circle')
      .attr('r', 6)
      .attr('fill', (d) => statusColor[d.data.status] || '#555')
      .attr('stroke', (d) => d.data.status === 'resolved' ? '#00ff88' : 'none')
      .attr('stroke-width', 2)

    nodeGroups.append('text')
      .attr('dy', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#aaa')
      .attr('font-size', 9)
      .attr('font-family', 'monospace')
      .text((d) => d.data.label)

  }, [cbsEvents, show])

  if (!show) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 12,
      width: PANEL_W,
      height: PANEL_H,
      background: 'rgba(10, 10, 25, 0.9)',
      border: '1px solid rgba(0, 212, 255, 0.25)',
      borderRadius: 8,
      overflow: 'hidden',
      zIndex: 15,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        padding: '6px 12px',
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#00d4ff',
        textTransform: 'uppercase',
        letterSpacing: 2,
        borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
      }}>
        CBS Constraint Tree ({cbsEvents.length} steps)
      </div>
      <svg ref={svgRef} width={PANEL_W} height={PANEL_H - 28} />
    </div>
  )
}
