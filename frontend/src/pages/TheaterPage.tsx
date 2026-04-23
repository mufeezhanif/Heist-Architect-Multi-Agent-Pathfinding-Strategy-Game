/**
 * TheaterPage — AI-vs-AI spectator using the existing game engine.
 * Displays a live 2D view of the heist with Bayesian belief heatmap, minimax log, and
 * narrated thought bubbles for every algorithm decision.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import GridCanvas2D from '../components/GridCanvas2D'
import { theaterStart, theaterTurn } from '../api/observatory'

interface TheaterGame {
  game_id: string
  building: any
  state: any
  plan: any
}

interface TurnData {
  game_over: boolean
  status: string
  turn: number
  score: number
  alert_level: number
  crew_positions: Record<string, [number, number]>
  guard_positions: Record<string, [number, number]>
  sensor_events: any[]
  detections: any[]
  objectives_completed: string[]
  bayesian_heatmap: Record<string, number>
  warden_action: any
  minimax_log: any[]
  event_log: string[]
  ai_plan: any
}

const CREW_COLORS: Record<string, string> = {
  hacker: '#00f0ff',
  thief: '#00ff66',
  muscle: '#fcee0a',
}

export default function TheaterPage() {
  const [game, setGame] = useState<TheaterGame | null>(null)
  const [turns, setTurns] = useState<TurnData[]>([])
  const [running, setRunning] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [speedMs, setSpeedMs] = useState(800)
  const [error, setError] = useState<string | null>(null)
  const [thoughts, setThoughts] = useState<{ side: 'crew' | 'warden'; text: string; turn: number }[]>([])
  const [showLayer, setShowLayer] = useState<'none' | 'bayesian' | 'paths'>('bayesian')
  const stopRef = useRef(false)

  const currentTurn = turns[turns.length - 1]

  async function startGame() {
    setError(null); setRunning(true); stopRef.current = false
    try {
      const g = await theaterStart()
      setGame(g)
      setTurns([])
      setThoughts([])
      // Absorb initial plan narration as first thoughts
      const narr = (g.plan?.narration || []) as { type: string; text: string }[]
      setThoughts(narr.map((n) => ({ side: 'crew' as const, text: n.text, turn: 0 })))
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setRunning(false)
    }
  }

  async function nextTurn() {
    if (!game) return
    setRunning(true); setError(null)
    try {
      const t: TurnData = await theaterTurn(game.game_id)
      setTurns((prev) => [...prev, t])

      const newThoughts: typeof thoughts = []
      if (t.ai_plan?.narration) {
        for (const n of t.ai_plan.narration) {
          newThoughts.push({ side: 'crew', text: n.text, turn: t.turn })
        }
      }
      if (t.warden_action) {
        const txt = typeof t.warden_action === 'object'
          ? `Warden: ${t.warden_action.action || 'observing'} (score ${t.warden_action.score?.toFixed?.(2) ?? '—'})`
          : `Warden: ${String(t.warden_action)}`
        newThoughts.push({ side: 'warden', text: txt, turn: t.turn })
      }
      for (const msg of (t.event_log || []).slice(-3)) {
        newThoughts.push({ side: 'crew', text: msg, turn: t.turn })
      }
      if (newThoughts.length) setThoughts((prev) => [...prev, ...newThoughts].slice(-50))
      return t
    } catch (e: any) {
      setError(e.message || String(e))
      return null
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (!autoPlay || !game) return
    if (currentTurn?.game_over) { setAutoPlay(false); return }
    stopRef.current = false
    let cancelled = false
    ;(async () => {
      await new Promise((r) => setTimeout(r, speedMs))
      if (cancelled || stopRef.current) return
      const t = await nextTurn()
      if (t?.game_over) setAutoPlay(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, currentTurn, game?.game_id])

  // Build grid for rendering
  const gridView = useMemo(() => {
    if (!game) return null
    const b = game.building
    const cells: number[][] = b.grid.map((row: any[]) =>
      row.map((c: any) => (c.walkable ? 1 : 0))
    )
    return { width: b.width, height: b.height, cells }
  }, [game])

  // Agent + guard markers
  const agents = useMemo(() => {
    const out: { id: string; pos: [number, number]; color: string; label: string }[] = []
    if (!game) return out

    // Crew: prefer live turn's crew_positions, else initial state.crew objects with x/y fields
    const crewFromTurn = currentTurn?.crew_positions
    if (crewFromTurn) {
      for (const [id, pos] of Object.entries(crewFromTurn)) {
        if (!Array.isArray(pos) || pos.length < 2) continue
        out.push({ id, pos: [pos[0], pos[1]] as [number, number], color: CREW_COLORS[id] || '#00f0ff', label: id.slice(0, 3) })
      }
    } else if (Array.isArray(game.state?.crew)) {
      for (const c of game.state.crew) {
        if (typeof c?.x !== 'number' || typeof c?.y !== 'number') continue
        const id = c.id || c.role || c.agent_id || 'crew'
        out.push({ id, pos: [c.x, c.y], color: CREW_COLORS[id] || '#00f0ff', label: String(id).slice(0, 3) })
      }
    }

    // Guards: live turn's guard_positions (dict) OR initial state.guards (list of objects)
    const guardsFromTurn = currentTurn?.guard_positions
    if (guardsFromTurn) {
      for (const [id, pos] of Object.entries(guardsFromTurn)) {
        if (!Array.isArray(pos) || pos.length < 2) continue
        out.push({ id, pos: [pos[0], pos[1]] as [number, number], color: '#ff003c', label: 'G' })
      }
    } else if (Array.isArray(game.state?.guards)) {
      for (const g of game.state.guards) {
        if (typeof g?.x !== 'number' || typeof g?.y !== 'number') continue
        out.push({ id: g.id || 'guard', pos: [g.x, g.y], color: '#ff003c', label: 'G' })
      }
    }

    return out
  }, [currentTurn, game])

  // Paths from last ai_plan
  const paths = useMemo(() => {
    if (showLayer !== 'paths') return undefined
    return currentTurn?.ai_plan?.paths || game?.plan?.paths
  }, [currentTurn, game, showLayer])

  const objectives = useMemo(() => {
    const list = game?.building?.objectives || []
    return list.map((o: any) => ({ id: o.id, pos: o.pos as [number, number] }))
  }, [game])

  const heatmap = showLayer === 'bayesian' ? (currentTurn?.bayesian_heatmap || {}) : undefined

  return (
    <div className="obs-page">
      <header className="obs-header">
        <Link to="/" className="obs-back">← Observatory</Link>
        <h1>AI Theater</h1>
        <p>Watch two AIs duel: the autonomous crew plans via CBS + A*, the Warden decides via Minimax over a Bayesian belief of crew location.</p>
      </header>

      <div className="obs-toolbar">
        <button className="obs-run" onClick={startGame} disabled={running}>
          {game ? 'Restart' : '▶ Start AI-vs-AI Game'}
        </button>
        {game && !currentTurn?.game_over && (
          <>
            <button onClick={nextTurn} disabled={running || autoPlay}>Next Turn</button>
            <button onClick={() => setAutoPlay((p) => !p)}>{autoPlay ? '⏸ Pause' : '▶ Auto-play'}</button>
            <label style={{ marginLeft: 8 }}>Speed:</label>
            <input type="range" min={200} max={2000} value={speedMs} onChange={(e) => setSpeedMs(parseInt(e.target.value))} />
            <span style={{ fontSize: 11, opacity: 0.7 }}>{speedMs}ms</span>
          </>
        )}
        <div className="obs-control-group" style={{ marginLeft: 'auto' }}>
          <label>Overlay:</label>
          <select value={showLayer} onChange={(e) => setShowLayer(e.target.value as any)}>
            <option value="none">None</option>
            <option value="bayesian">Bayesian belief</option>
            <option value="paths">Planned paths</option>
          </select>
        </div>
      </div>

      {error && <div className="obs-error">{error}</div>}

      {game && gridView && (
        <div className="obs-theater-layout">
          <div className="obs-canvas-wrap">
            <GridCanvas2D
              width={gridView.width} height={gridView.height} cells={gridView.cells}
              agents={agents}
              paths={paths}
              heatmap={heatmap}
              title={game.building?.name}
            />
            {/* Objective markers rendered as small dots over the grid via agents list */}
          </div>

          <div className="obs-theater-sidebar">
            <div className="obs-stats" style={{ flexDirection: 'column', gap: 6 }}>
              <Stat label="Turn" value={currentTurn?.turn ?? 0} />
              <Stat label="Status" value={(currentTurn?.status || 'active').toUpperCase()} color={currentTurn?.status === 'won' ? '#00ff66' : currentTurn?.status === 'lost' ? '#ff003c' : '#00f0ff'} />
              <Stat label="Score" value={currentTurn?.score ?? 0} />
              <Stat label="Alert level" value={['GREEN', 'YELLOW', 'RED', 'LOCKDOWN'][currentTurn?.alert_level ?? 0]} color={['#00ff66', '#fcee0a', '#ff6b35', '#ff003c'][currentTurn?.alert_level ?? 0]} />
              <Stat label="Objectives" value={`${currentTurn?.objectives_completed?.length ?? 0} / ${objectives.length}`} />
            </div>

            <div className="obs-thoughts">
              <h3>Thought bubbles</h3>
              <div className="obs-thoughts-scroll">
                {thoughts.length === 0 && <p className="obs-muted">Start the game to see AI reasoning.</p>}
                {thoughts.slice().reverse().map((t, i) => (
                  <div key={i} className={`obs-thought obs-thought-${t.side}`}>
                    <span className="obs-thought-label">{t.side === 'crew' ? '🦊 Crew' : '🛡️ Warden'}</span>
                    <span className="obs-thought-turn">t{t.turn}</span>
                    <div className="obs-thought-text">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {currentTurn?.minimax_log && currentTurn.minimax_log.length > 0 && (
              <div className="obs-minimax-log">
                <h3>Minimax decisions</h3>
                <ul>
                  {currentTurn.minimax_log.slice(0, 5).map((m: any, i: number) => (
                    <li key={i} style={{ fontSize: 11, opacity: 0.8 }}>
                      {m.action ?? JSON.stringify(m)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {!game && !error && (
        <div className="obs-placeholder">
          <p>Click <strong>Start AI-vs-AI Game</strong> to begin. The crew AI will autonomously plan routes to objectives, and the Warden AI will track them via Bayesian inference and deploy guards via Minimax.</p>
        </div>
      )}
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
