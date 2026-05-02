/* ── Heist Architect — REST + WebSocket API client ── */
import { useGameStore } from '../store/gameStore'
import { normalizeAgent, normalizeGuard } from './normalize'

const API = '/api'

// ── REST helpers ──
async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(`${API}${url}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// ── Game API ──
export async function createGame(mode: string = 'pvai') {
  const backendMode =
    mode === 'pvai' ? 'pva_mastermind'
      : mode === 'spectator' ? 'ai_vs_ai'
        : mode
  const data = await post<{ game_id: string; building: unknown; state: unknown }>(
    '/game/create',
    { mode: backendMode },
  )
  return data
}

export async function getGameState(gameId: string) {
  return get<unknown>(`/game/${gameId}/state`)
}

export async function getBuilding(gameId: string) {
  return get<unknown>(`/game/${gameId}/building`)
}

export async function planPaths(gameId: string, waypoints: Record<string, [number, number]>) {
  return post<unknown>(`/game/${gameId}/plan`, { waypoints })
}

export async function executeTurn(gameId: string) {
  return post<unknown>(`/game/${gameId}/execute`)
}

// ── WebSocket ──
let ws: WebSocket | null = null

export function connectWebSocket(gameId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  ws = new WebSocket(`${protocol}://${host}/ws/game/${gameId}`)

  ws.onopen = () => {
    useGameStore.getState().setConnected(true)
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    const s = useGameStore.getState()

    switch (data.type) {
      case 'connected':
        if (data.state) {
          if (data.state.crew) s.setCrew(data.state.crew.map(normalizeAgent))
          if (data.state.guards) s.setGuards(data.state.guards.map(normalizeGuard))
          if (data.state.event_log) s.setEventLog(data.state.event_log)
          if (data.state.alert_level !== undefined) s.setAlertLevel(data.state.alert_level)
          if (data.state.max_turns !== undefined) s.setMaxTurns(data.state.max_turns)
          if (data.state.bayesian_heatmap && Object.keys(data.state.bayesian_heatmap).length > 0)
            s.setBayesianHeatmap(data.state.bayesian_heatmap)
        }
          if (data.god_mode) {
            useGameStore.setState({ godMode: true } as Record<string, unknown>)
          }
        break

      case 'cbs_event':
        s.addCBSEvent(data)
        break

      case 'plan_complete':
        s.setPaths(data.paths || {})
        s.setPlanning(false)

        // Add algorithm narration
        if (data.algorithms_used) {
          const algos = data.algorithms_used
          if (algos.astar) s.addNarration({ type: 'info', text: `🔍 A*: ${algos.astar}` })
          if (algos.cbs) s.addNarration({ type: 'info', text: `🌳 CBS: ${algos.cbs}` })
          if (algos.csp && typeof algos.csp !== 'string') {
            for (const c of algos.csp) {
              s.addNarration({ type: 'info', text: `📋 CSP: ${c.description} — ${c.satisfied ? '✅ Satisfied' : '❌ Violated'}` })
            }
          }
        }

        // Auto-execute if quick mode triggered it
        if ((s as unknown as Record<string, unknown>)._autoExecuteAfterPlan) {
          useGameStore.setState({ _autoExecuteAfterPlan: false } as Record<string, unknown>)
          sendWS({ action: 'execute' })
        }

        break

      case 'step':
        // Track execution step count
        if (data.step_total) s.setExecutionTotal(data.step_total)
        s.setExecutionStep(data.step || 0)

        // Add narration entries
        if (data.narration && Array.isArray(data.narration)) {
          for (const n of data.narration) {
            s.addNarration(n)
          }
        }

        // Animate individual steps
        if (data.crew_positions) {
          s.setCrew(
            s.crew.map((c) => ({
              ...c,
              pos: data.crew_positions[c.agent_id] || c.pos,
            })),
          )
        }
        if (data.guard_positions) {
          s.setGuards(
            s.guards.map((g) => ({
              ...g,
              pos: data.guard_positions[g.guard_id] || g.pos,
            })),
          )
        }
        if (data.alert_level !== undefined) {
          s.setAlertLevel(data.alert_level)
        }
        if (data.alert_message) {
          s.addEventLog(data.alert_message)
        }
        break

      case 'turn_result':
        s.setTurnResult(data)

        if (data.crew) {
          s.setCrew(data.crew.map(normalizeAgent))
        }
        if (data.guards) {
          s.setGuards(data.guards.map(normalizeGuard))
        }

        // Add algorithm narration
        if (data.algorithms_used) {
          const algos = data.algorithms_used
          if (algos.bayesian) s.addNarration({ type: 'info', text: `📊 Bayesian: ${algos.bayesian}` })
          if (algos.warden) s.addNarration({ type: 'info', text: `🛡️ Warden: ${algos.warden}` })
        }

        // Add turn narration
        if (data.narration && Array.isArray(data.narration)) {
          for (const n of data.narration) {
            s.addNarration(n)
          }
        }

        // Update positions (even if full snapshots were not provided)
        if (data.crew_positions) {
          s.setCrew(
            s.crew.map((c) => ({
              ...c,
              pos: data.crew_positions[c.agent_id] || c.pos,
            })),
          )
        }
        if (data.guard_positions) {
          s.setGuards(
            s.guards.map((g) => ({
              ...g,
              pos: data.guard_positions[g.guard_id] || g.pos,
            })),
          )
        }
        // Clear paths, waypoints, and pending moves so player can re-plan
        if (data.game_status === 'planning' || data.game_status === 'active') {
          s.setPaths({})
          s.clearWaypoints()
          s.clearPendingMoves()
          s.setPlanning(false)
          s.setExecutionMode('idle')
        }

        break

      case 'ability_result':
        if (data.success && data.message) {
          s.addEventLog(data.message)
        }
        if (data.crew) {
          s.setCrew(data.crew.map(normalizeAgent))
        }
        if (data.guards) {
          s.setGuards(data.guards.map(normalizeGuard))
        }
        if (data.event_log) {
          s.setEventLog(data.event_log)
        }
          if (Array.isArray(data.objectives_completed)) {
            s.setObjectivesCompleted(data.objectives_completed as string[])
          }
        break

      case 'state':
        if (data.state?.crew) s.setCrew(data.state.crew.map(normalizeAgent))
        if (data.state?.guards) s.setGuards(data.state.guards.map(normalizeGuard))
        if (data.state?.max_turns !== undefined) s.setMaxTurns(data.state.max_turns)
        break
    }
  }

  ws.onclose = () => {
    useGameStore.getState().setConnected(false)
  }
}

export function sendWS(data: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

export function disconnectWebSocket() {
  if (ws) {
    ws.close()
    ws = null
  }
}
