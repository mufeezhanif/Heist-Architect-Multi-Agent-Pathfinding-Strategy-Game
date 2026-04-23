/**
 * BenchPage — MAPF benchmark harness with CSV export.
 * Pick a sample map (or upload a .map file), set # agents and # trials,
 * run, see aggregate + per-trial stats, export CSV.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GridCanvas2D from '../components/GridCanvas2D'
import {
  arenaSamples, benchRun, benchExportCSV,
  type BenchResponse, type SampleInfo,
} from '../api/observatory'

export default function BenchPage() {
  const [samples, setSamples] = useState<SampleInfo[]>([])
  const [selected, setSelected] = useState<string>('rooms-24')
  const [numAgents, setNumAgents] = useState(4)
  const [numTrials, setNumTrials] = useState(10)
  const [seed, setSeed] = useState(42)
  const [maxIter, setMaxIter] = useState(100)
  const [uploadText, setUploadText] = useState<string | null>(null)
  const [uploadName, setUploadName] = useState<string>('')
  const [useUpload, setUseUpload] = useState(false)
  const [grid, setGrid] = useState<{ width: number; height: number; cells: number[][] } | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BenchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    arenaSamples().then((r) => {
      setSamples(r.samples)
      setSelected(r.samples[0]?.name || 'rooms-24')
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (useUpload) return
    fetch(`/api/arena/sample/${selected}`, { method: 'POST' })
      .then((r) => r.json())
      .then((g) => setGrid({ width: g.width, height: g.height, cells: g.cells }))
      .catch(console.error)
  }, [selected, useUpload])

  useEffect(() => {
    if (!useUpload || !uploadText) return
    fetch('/api/arena/grid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map_text: uploadText, name: uploadName }),
    })
      .then((r) => r.json())
      .then((g) => setGrid({ width: g.width, height: g.height, cells: g.cells }))
      .catch((e) => setError(e.message))
  }, [useUpload, uploadText, uploadName])

  async function handleUpload(file: File) {
    const text = await file.text()
    setUploadText(text); setUploadName(file.name); setUseUpload(true)
  }

  async function runBench() {
    setRunning(true); setError(null)
    try {
      const r = await benchRun({
        grid: useUpload ? { map_text: uploadText! } : { sample: selected },
        num_agents: numAgents,
        num_trials: numTrials,
        seed: seed,
        max_iterations: maxIter,
      })
      setResult(r)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setRunning(false)
    }
  }

  async function downloadCSV() {
    if (!result) return
    const blob = await benchExportCSV(result.results)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mapf_${useUpload ? uploadName : selected}_${numAgents}a_${numTrials}t.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const chart = useMemo(() => {
    if (!result) return null
    const values = result.results.map((r) => r.runtime_ms)
    const max = Math.max(...values, 1)
    return { values, max }
  }, [result])

  return (
    <div className="obs-page">
      <header className="obs-header">
        <Link to="/" className="obs-back">← Observatory</Link>
        <h1>MAPF Lab</h1>
        <p>Multi-Agent Path Finding benchmark harness. Run N trials on random start/goal pairs, collect CBS stats, export CSV.</p>
      </header>

      <div className="obs-bench-config">
        <div className="obs-control-group">
          <label>
            <input type="radio" checked={!useUpload} onChange={() => setUseUpload(false)} /> Built-in sample
          </label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={useUpload}>
            {samples.map((s) => (
              <option key={s.name} value={s.name}>{s.name} ({s.width}×{s.height})</option>
            ))}
          </select>
        </div>
        <div className="obs-control-group">
          <label>
            <input type="radio" checked={useUpload} onChange={() => setUseUpload(true)} /> Upload MovingAI .map
          </label>
          <input type="file" accept=".map,.txt" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          {uploadName && <span style={{ fontSize: 11, opacity: 0.7 }}>{uploadName}</span>}
        </div>
        <div className="obs-control-group">
          <label>Agents:</label>
          <input type="number" min={1} max={30} value={numAgents} onChange={(e) => setNumAgents(parseInt(e.target.value) || 1)} />
          <label>Trials:</label>
          <input type="number" min={1} max={100} value={numTrials} onChange={(e) => setNumTrials(parseInt(e.target.value) || 1)} />
          <label>Seed:</label>
          <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 0)} />
          <label>Max iter:</label>
          <input type="number" value={maxIter} onChange={(e) => setMaxIter(parseInt(e.target.value) || 100)} />
        </div>
        <button className="obs-run" disabled={running} onClick={runBench}>
          {running ? 'Running…' : '▶ Run Benchmark'}
        </button>
      </div>

      {error && <div className="obs-error">{error}</div>}

      <div className="obs-bench-layout">
        <div className="obs-canvas-wrap">
          {grid && (
            <GridCanvas2D
              width={grid.width} height={grid.height} cells={grid.cells}
              title={useUpload ? uploadName : selected}
            />
          )}
        </div>

        <div className="obs-bench-results">
          {!result && <p className="obs-muted">Configure parameters and click Run.</p>}
          {result && (
            <>
              <h3>Summary</h3>
              <div className="obs-stats" style={{ flexDirection: 'column', gap: 6 }}>
                <Stat label="Success rate" value={`${(result.summary.success_rate * 100).toFixed(1)}%`} color={result.summary.success_rate > 0.8 ? '#00ff66' : '#fcee0a'} />
                <Stat label="Trials" value={`${result.summary.successful} / ${result.summary.total_trials}`} />
                <Stat label="Avg runtime" value={`${result.summary.avg_runtime_ms.toFixed(2)} ms`} />
                <Stat label="Avg cost" value={result.summary.avg_cost} />
                <Stat label="Avg makespan" value={result.summary.avg_makespan} />
                <Stat label="Avg conflicts" value={result.summary.avg_conflicts} />
              </div>

              <button onClick={downloadCSV} style={{ marginTop: 12 }}>⬇ Download CSV</button>

              <h3 style={{ marginTop: 16 }}>Per-trial runtime</h3>
              {chart && (
                <div className="obs-bench-chart">
                  {chart.values.map((v, i) => (
                    <div
                      key={i}
                      className="obs-bench-bar"
                      style={{
                        height: `${(v / chart.max) * 100}%`,
                        background: result.results[i].success ? '#00ff66' : '#ff003c',
                      }}
                      title={`trial ${i}: ${v.toFixed(1)}ms`}
                    />
                  ))}
                </div>
              )}

              <h3 style={{ marginTop: 16 }}>Per-trial results</h3>
              <div className="obs-bench-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>ok</th><th>cost</th><th>makespan</th><th>conflicts</th><th>ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.trial}>
                        <td>{r.trial}</td>
                        <td style={{ color: r.success ? '#00ff66' : '#ff003c' }}>{r.success ? '✓' : '✗'}</td>
                        <td>{r.total_cost?.toFixed(0) ?? '—'}</td>
                        <td>{r.makespan ?? '—'}</td>
                        <td>{r.conflicts_resolved ?? '—'}</td>
                        <td>{r.runtime_ms.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="obs-stat">
      <div className="obs-stat-label">{label}</div>
      <div className="obs-stat-value" style={{ color: color || '#00f0ff' }}>
        {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}
      </div>
    </div>
  )
}
