/* ── Heist Architect — REST + WebSocket API client ── */
import { useGameStore } from '../store/gameStore'

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
  const data = await post<{ game_id: string; building: unknown; state: unknown }>(
    '/game/create',
    { mode },
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
  const store = useGameStore.getState()
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
        // Initial state from server
        if (data.state) {
          if (data.state.crew) s.setCrew(data.state.crew)
          if (data.state.guards) s.setGuards(data.state.guards)
        }
        break

      case 'cbs_event':
        s.addCBSEvent(data)
        break

      case 'plan_complete':
        s.setPaths(data.paths || {})
        s.setPlanning(false)
        break

      case 'turn_result':
        s.setTurnResult(data)
        // Update crew/guard positions
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
        break

      case 'state':
        if (data.state?.crew) s.setCrew(data.state.crew)
        if (data.state?.guards) s.setGuards(data.state.guards)
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
