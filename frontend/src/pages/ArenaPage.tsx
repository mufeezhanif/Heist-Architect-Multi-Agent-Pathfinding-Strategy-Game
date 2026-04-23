/**
 * ArenaPage — interactive A* and CBS inspector.
 * Two tabs: "A* Search" and "CBS Multi-Agent".
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import GridCanvas2D from '../components/GridCanvas2D'
import {
  arenaSamples, runAStar, runCBS,
  type AStarResponse, type AStarRunResult, type CBSResponse, type SampleInfo,
} from '../api/observatory'

type Tab = 'astar' | 'cbs'
type ClickMode = 'start' | 'goal' | 'agent-start' | 'agent-goal'

export default function ArenaPage() {
  const [tab, setTab] = useState<Tab>('astar')
  const [samples, setSamples] = useState<SampleInfo[]>([])
  const [heuristics, setHeuristics] = useState<string[]>([])
  const [selectedSample, setSelectedSample] = useState<string>('rooms-24')
  const [grid, setGrid] = useState<{ width: number; height: number; cells: number[][] } | null>(null)

  useEffect(() => {
    arenaSamples().then((r) => {
      setSamples(r.samples)
      setHeuristics(r.heuristics)
      setSelectedSample(r.samples[0]?.name || 'rooms-24')
    }).catch(console.error)
  }, [])

  // Load sample preview whenever selection changes
  useEffect(() => {
    if (!selectedSample) return
    fetch(`/api/arena/sample/${selectedSample}`, { method: 'POST' })
      .then((r) => r.json())
      .then((g) => setGrid({ width: g.width, height: g.height, cells: g.cells }))
      .catch(console.error)
  }, [selectedSample])

  return (
    <div className="obs-page">
      <header className="obs-header">
        <Link to="/" className="obs-back">← Observatory</Link>
        <h1>Algorithm Arena</h1>
        <p>Interactive inspector for pathfinding algorithms. Pick a map, set start/goal, watch the algorithm think step by step.</p>
        <div className="obs-tabs">
          <button className={tab === 'astar' ? 'active' : ''} onClick={() => setTab('astar')}>A* Search</button>
          <button className={tab === 'cbs' ? 'active' : ''} onClick={() => setTab('cbs')}>CBS Multi-Agent</button>
        </div>
      </header>

      <div className="obs-map-picker">
        <label>Map:</label>
        <select value={selectedSample} onChange={(e) => setSelectedSample(e.target.value)}>
          {samples.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.width}×{s.height}, {s.walkable_cells} walkable)
            </option>
          ))}
        </select>
      </div>

      {grid && tab === 'astar' && (
        <AStarInspector grid={grid} gridName={selectedSample} heuristics={heuristics} />
      )}
      {grid && tab === 'cbs' && (
        <CBSInspector grid={grid} gridName={selectedSample} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// A* Inspector
// ─────────────────────────────────────────────────────────────

function AStarInspector({
  grid, gridName, heuristics,
}: {
  grid: { width: number; height: number; cells: number[][] }
  gridName: string
  heuristics: string[]
}) {
  const [start, setStart] = useState<[number, number] | null>(null)
  const [goal, setGoal] = useState<[number, number] | null>(null)
  const [clickMode, setClickMode] = useState<ClickMode>('start')
  const [heuristic, setHeuristic] = useState<string>('manhattan')
  const [compareMode, setCompareMode] = useState<boolean>(false)
  const [selectedCompare, setSelectedCompare] = useState<string[]>(['manhattan', 'euclidean', 'zero'])
  const [result, setResult] = useState<AStarResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedMs, setSpeedMs] = useState(60)

  useEffect(() => { setStart(null); setGoal(null); setResult(null); setStepIdx(0) }, [gridName])

  const handleCellClick = useCallback((x: number, y: number) => {
    if (grid.cells[y][x] === 0) return  // can't put on wall
    if (clickMode === 'start') { setStart([x, y]); setClickMode('goal') }
    else { setGoal([x, y]); setClickMode('start') }
    setResult(null); setStepIdx(0)
  }, [clickMode, grid.cells])

  const canRun = start && goal && !running
  async function run() {
    if (!start || !goal) return
    setRunning(true); setError(null)
    try {
      const body = {
        grid: { sample: gridName },
        start, goal,
        heuristic: compareMode ? undefined : heuristic,
        compare: compareMode ? selectedCompare : undefined,
        max_expansions: 5000,
      }
      const r = await runAStar(body)
      setResult(r); setStepIdx(0)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setRunning(false)
    }
  }

  // Timeline playback
  useEffect(() => {
    if (!playing || !result) return
    const maxSteps = compareMode
      ? Math.max(...Object.values(result.runs || {}).map((r) => r.steps.length))
      : (result.steps?.length || 0)
    if (stepIdx >= maxSteps - 1) { setPlaying(false); return }
    const id = setTimeout(() => setStepIdx((i) => i + 1), speedMs)
    return () => clearTimeout(id)
  }, [playing, stepIdx, result, speedMs, compareMode])

  return (
    <div className="obs-inspector">
      <div className="obs-toolbar">
        <div className="obs-control-group">
          <label>Click places:</label>
          <button className={clickMode === 'start' ? 'active' : ''} onClick={() => setClickMode('start')}>Start</button>
          <button className={clickMode === 'goal' ? 'active' : ''} onClick={() => setClickMode('goal')}>Goal</button>
        </div>
        <div className="obs-control-group">
          <label><input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} /> Race heuristics</label>
          {!compareMode && (
            <>
              <label>Heuristic:</label>
              <select value={heuristic} onChange={(e) => setHeuristic(e.target.value)}>
                {heuristics.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </>
          )}
        </div>
        <button className="obs-run" disabled={!canRun} onClick={run}>
          {running ? 'Running…' : '▶ Run A*'}
        </button>
        {start && goal && (
          <button onClick={() => { setStart(null); setGoal(null); setResult(null) }}>Clear</button>
        )}
      </div>

      {compareMode && (
        <div className="obs-control-group" style={{ marginBottom: 8 }}>
          <label>Compare:</label>
          {heuristics.map((h) => (
            <label key={h} style={{ marginRight: 8 }}>
              <input
                type="checkbox"
                checked={selectedCompare.includes(h)}
                onChange={() => setSelectedCompare((s) => s.includes(h) ? s.filter((x) => x !== h) : [...s, h])}
              /> {h}
            </label>
          ))}
        </div>
      )}

      {error && <div className="obs-error">{error}</div>}

      {/* Canvas(es) */}
      {!compareMode && (
        <SingleAStarView
          grid={grid} start={start} goal={goal}
          result={result && result.mode === 'single' ? result : null}
          stepIdx={stepIdx}
          onCellClick={handleCellClick}
        />
      )}
      {compareMode && result && result.mode === 'race' && result.runs && (
        <div className="obs-race-grid">
          {Object.entries(result.runs).map(([h, run]) => (
            <RaceRun key={h}
              name={h}
              grid={grid} start={start} goal={goal}
              run={run} stepIdx={stepIdx}
            />
          ))}
        </div>
      )}
      {compareMode && !result && start && goal && (
        <div className="obs-canvas-wrap">
          <GridCanvas2D
            width={grid.width} height={grid.height} cells={grid.cells}
            start={start || undefined} goal={goal || undefined}
            onCellClick={handleCellClick}
          />
        </div>
      )}
      {!start || !goal ? null : null}

      {/* Timeline */}
      {result && (
        <TimelineBar
          stepIdx={stepIdx}
          maxSteps={
            (result.mode === 'race'
              ? Math.max(...Object.values(result.runs || {}).map((r) => r.steps.length))
              : (result.steps?.length || 0)) - 1
          }
          playing={playing}
          onToggle={() => setPlaying((p) => !p)}
          onChange={setStepIdx}
          speedMs={speedMs}
          onSpeed={setSpeedMs}
        />
      )}

      {/* Stats */}
      {result && <AStarStats result={result} />}
    </div>
  )
}

function SingleAStarView({
  grid, start, goal, result, stepIdx, onCellClick,
}: {
  grid: { width: number; height: number; cells: number[][] }
  start: [number, number] | null
  goal: [number, number] | null
  result: AStarRunResult | null
  stepIdx: number
  onCellClick: (x: number, y: number) => void
}) {
  const step = result?.steps?.[stepIdx]
  const isDone = result ? stepIdx >= result.steps.length - 1 : false
  return (
    <div className="obs-canvas-wrap">
      <GridCanvas2D
        width={grid.width} height={grid.height} cells={grid.cells}
        start={start || undefined} goal={goal || undefined}
        frontier={step?.frontier}
        closed={step?.closed}
        current={step?.current}
        path={isDone && result?.success ? result.path : undefined}
        onCellClick={onCellClick}
      />
    </div>
  )
}

function RaceRun({
  name, grid, start, goal, run, stepIdx,
}: {
  name: string
  grid: { width: number; height: number; cells: number[][] }
  start: [number, number] | null
  goal: [number, number] | null
  run: AStarRunResult
  stepIdx: number
}) {
  const clamped = Math.min(stepIdx, run.steps.length - 1)
  const step = run.steps[clamped]
  const isDone = stepIdx >= run.steps.length - 1
  return (
    <div className="obs-race-panel">
      <div className="obs-race-header">
        <span className="obs-race-name">{name}</span>
        <span className="obs-race-stat">{run.nodes_expanded} expanded</span>
        <span className="obs-race-stat">cost {run.cost.toFixed(0)}</span>
        <span className="obs-race-stat">{run.runtime_ms.toFixed(1)}ms</span>
      </div>
      <GridCanvas2D
        width={grid.width} height={grid.height} cells={grid.cells}
        cellSize={Math.max(10, Math.floor(440 / Math.max(grid.width, grid.height)))}
        start={start || undefined} goal={goal || undefined}
        frontier={step?.frontier}
        closed={step?.closed}
        current={step?.current}
        path={isDone && run.success ? run.path : undefined}
      />
    </div>
  )
}

function TimelineBar({
  stepIdx, maxSteps, playing, onToggle, onChange, speedMs, onSpeed,
}: {
  stepIdx: number
  maxSteps: number
  playing: boolean
  onToggle: () => void
  onChange: (i: number) => void
  speedMs: number
  onSpeed: (ms: number) => void
}) {
  return (
    <div className="obs-timeline">
      <button onClick={onToggle}>{playing ? '⏸' : '▶'}</button>
      <button onClick={() => onChange(0)}>⏮</button>
      <button onClick={() => onChange(Math.max(0, stepIdx - 1))}>←</button>
      <button onClick={() => onChange(Math.min(maxSteps, stepIdx + 1))}>→</button>
      <button onClick={() => onChange(maxSteps)}>⏭</button>
      <input
        type="range"
        min={0} max={Math.max(0, maxSteps)}
        value={stepIdx}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ flex: 1 }}
      />
      <span className="obs-step-label">{stepIdx} / {maxSteps}</span>
      <label style={{ marginLeft: 12 }}>Speed:</label>
      <input type="range" min={10} max={300} value={310 - speedMs} onChange={(e) => onSpeed(310 - parseInt(e.target.value))} />
    </div>
  )
}

function AStarStats({ result }: { result: AStarResponse }) {
  if (result.mode === 'single') {
    return (
      <div className="obs-stats">
        <Stat label="Heuristic" value={result.heuristic || '—'} />
        <Stat label="Success" value={result.success ? 'YES' : 'NO'} color={result.success ? '#00ff66' : '#ff003c'} />
        <Stat label="Path length" value={result.path.length} />
        <Stat label="Cost" value={result.cost} />
        <Stat label="Nodes expanded" value={result.nodes_expanded} />
        <Stat label="Runtime" value={`${result.runtime_ms.toFixed(2)} ms`} />
      </div>
    )
  }
  return (
    <div className="obs-stats-table">
      <table>
        <thead>
          <tr>
            <th>Heuristic</th><th>Success</th><th>Path</th><th>Cost</th><th>Expanded</th><th>Runtime</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(result.runs || {}).map(([h, r]) => (
            <tr key={h}>
              <td>{h}</td>
              <td style={{ color: r.success ? '#00ff66' : '#ff003c' }}>{r.success ? 'YES' : 'NO'}</td>
              <td>{r.path.length}</td>
              <td>{r.cost.toFixed(0)}</td>
              <td>{r.nodes_expanded}</td>
              <td>{r.runtime_ms.toFixed(2)} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="obs-stat">
      <div className="obs-stat-label">{label}</div>
      <div className="obs-stat-value" style={{ color: color || '#00f0ff' }}>{typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CBS Inspector
// ─────────────────────────────────────────────────────────────

const CBS_COLORS = ['#00f0ff', '#ff003c', '#00ff66', '#fcee0a', '#ff6b35', '#c77dff']

function CBSInspector({
  grid, gridName,
}: {
  grid: { width: number; height: number; cells: number[][] }
  gridName: string
}) {
  type AgentDef = { id: string; start: [number, number] | null; goal: [number, number] | null }
  const [agents, setAgents] = useState<AgentDef[]>([
    { id: 'a1', start: null, goal: null },
    { id: 'a2', start: null, goal: null },
  ])
  const [activeAgent, setActiveAgent] = useState<string>('a1')
  const [clickTarget, setClickTarget] = useState<'start' | 'goal'>('start')
  const [result, setResult] = useState<CBSResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [showAllConflicts, setShowAllConflicts] = useState(true)

  useEffect(() => { setResult(null) }, [gridName])

  function handleClick(x: number, y: number) {
    if (grid.cells[y][x] === 0) return
    setAgents((prev) => prev.map((a) => {
      if (a.id !== activeAgent) return a
      return clickTarget === 'start' ? { ...a, start: [x, y] } : { ...a, goal: [x, y] }
    }))
    setClickTarget((t) => t === 'start' ? 'goal' : 'start')
  }

  function addAgent() {
    setAgents((prev) => [...prev, { id: `a${prev.length + 1}`, start: null, goal: null }])
  }
  function removeAgent(id: string) {
    setAgents((prev) => prev.filter((a) => a.id !== id))
    if (activeAgent === id && agents.length > 1) setActiveAgent(agents[0].id)
  }

  const canRun = agents.every((a) => a.start && a.goal) && agents.length >= 1
  async function run() {
    if (!canRun) return
    setRunning(true); setError(null)
    try {
      const r = await runCBS({
        grid: { sample: gridName },
        agents: agents.map((a) => ({ id: a.id, start: a.start!, goal: a.goal! })),
        max_iterations: 150,
      })
      setResult(r)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setRunning(false)
    }
  }

  const displayAgents = agents
    .filter((a) => a.start)
    .map((a, i) => ({ id: a.id, pos: a.start!, color: CBS_COLORS[i % CBS_COLORS.length], label: a.id }))

  // Paths for rendering from result
  const paths = result?.paths
  const conflictEvents = useMemo(
    () => (result?.tree_log || []).filter((e: any) => e.type === 'cbs_conflict'),
    [result],
  )

  return (
    <div className="obs-inspector">
      <div className="obs-toolbar">
        <div className="obs-control-group">
          <label>Agent:</label>
          <select value={activeAgent} onChange={(e) => setActiveAgent(e.target.value)}>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select>
          <button onClick={addAgent}>+ Add</button>
          {agents.length > 1 && <button onClick={() => removeAgent(activeAgent)}>− Remove</button>}
        </div>
        <div className="obs-control-group">
          <label>Next click sets:</label>
          <button className={clickTarget === 'start' ? 'active' : ''} onClick={() => setClickTarget('start')}>Start</button>
          <button className={clickTarget === 'goal' ? 'active' : ''} onClick={() => setClickTarget('goal')}>Goal</button>
        </div>
        <button className="obs-run" disabled={!canRun || running} onClick={run}>
          {running ? 'Running…' : '▶ Run CBS'}
        </button>
        <button onClick={() => { setAgents(agents.map((a) => ({ ...a, start: null, goal: null }))); setResult(null) }}>Clear</button>
      </div>

      <div className="obs-agents-chips">
        {agents.map((a, i) => (
          <div key={a.id} className="obs-chip" style={{ borderColor: CBS_COLORS[i % CBS_COLORS.length] }}>
            <span style={{ color: CBS_COLORS[i % CBS_COLORS.length], fontWeight: 600 }}>{a.id}</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>
              {a.start ? `S(${a.start[0]},${a.start[1]})` : 'S?'} → {a.goal ? `G(${a.goal[0]},${a.goal[1]})` : 'G?'}
            </span>
          </div>
        ))}
      </div>

      {error && <div className="obs-error">{error}</div>}

      <div className="obs-cbs-layout">
        <div className="obs-canvas-wrap">
          <GridCanvas2D
            width={grid.width} height={grid.height} cells={grid.cells}
            paths={paths}
            agents={displayAgents}
            onCellClick={handleClick}
          />
          {/* Goal markers separately */}
        </div>

        <div className="obs-cbs-sidebar">
          <h3>CBS Conflict Tree</h3>
          {!result && <p className="obs-muted">Set start/goal for each agent, then click Run.</p>}
          {result && (
            <>
              <div className="obs-stats" style={{ flexDirection: 'column', gap: 6 }}>
                <Stat label="Success" value={result.success ? 'YES' : 'NO'} color={result.success ? '#00ff66' : '#ff003c'} />
                <Stat label="Total cost" value={result.total_cost} />
                <Stat label="Makespan" value={result.makespan} />
                <Stat label="Conflicts resolved" value={result.conflicts_resolved} />
                <Stat label="Runtime" value={`${result.runtime_ms.toFixed(2)} ms`} />
              </div>
              <div className="obs-tree-log">
                <div className="obs-tree-log-header">
                  <strong>Tree events ({result.tree_log.length})</strong>
                  <label style={{ fontSize: 11 }}>
                    <input type="checkbox" checked={showAllConflicts} onChange={(e) => setShowAllConflicts(e.target.checked)} /> all events
                  </label>
                </div>
                <div className="obs-tree-log-scroll">
                  {(showAllConflicts ? result.tree_log : conflictEvents).map((ev: any, i: number) => (
                    <TreeLogEntry key={i} ev={ev} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TreeLogEntry({ ev }: { ev: any }) {
  const color = {
    cbs_root: '#00f0ff',
    cbs_conflict: '#ff003c',
    cbs_branch: '#fcee0a',
    cbs_branch_fail: '#8a8a8a',
    cbs_solution: '#00ff66',
  }[ev.type as string] || '#ffffff'
  let text = ev.type
  if (ev.type === 'cbs_conflict') {
    text = `Conflict: ${ev.agent1} vs ${ev.agent2} @ ${JSON.stringify(ev.cell)} t=${ev.time}`
  } else if (ev.type === 'cbs_branch') {
    text = `Branch: re-plan ${ev.agent} with new constraint`
  } else if (ev.type === 'cbs_root') {
    text = `Root: initial cost ${(ev.cost ?? 0).toFixed(1)}`
  } else if (ev.type === 'cbs_solution') {
    text = `Solution: cost ${(ev.total_cost ?? 0).toFixed(1)}, makespan ${ev.makespan}`
  }
  return (
    <div className="obs-tree-entry" style={{ borderLeftColor: color }}>
      <span style={{ color, fontSize: 11, fontWeight: 600 }}>{ev.type}</span>
      <span style={{ fontSize: 12 }}>{text}</span>
    </div>
  )
}
