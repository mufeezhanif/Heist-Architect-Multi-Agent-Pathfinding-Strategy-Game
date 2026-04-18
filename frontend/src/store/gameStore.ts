/* ── Heist Architect — Zustand global store ── */
import { create } from 'zustand'

// ── Types ──
export interface Cell {
  type: string
  room_id: string | null
  walkable: boolean
}

export interface Building {
  width: number
  height: number
  grid: Cell[][]
  cameras: { id: string; pos: [number, number]; direction: string; vision: [number, number][] }[]
  entries: [number, number][]
  extraction_points: [number, number][]
  objectives: { id: string; pos: [number, number]; label: string }[]
}

export interface Agent {
  agent_id: string
  role: string
  pos: [number, number]
  alive: boolean
}

export interface Guard {
  guard_id: string
  pos: [number, number]
  patrol: [number, number][]
  knocked_out: boolean
  vision: [number, number][]
}

export interface CBSEvent {
  step: string
  [key: string]: unknown
}

export interface TurnResult {
  turn: number
  crew_positions: Record<string, [number, number]>
  guard_positions: Record<string, [number, number]>
  sensor_events: { sensor_id: string; event_type: string; pos: [number, number] }[]
  detections: string[]
  objectives_completed: string[]
  bayesian_heatmap: Record<string, number>
  warden_action: Record<string, unknown> | null
  minimax_log: Record<string, unknown>[]
  game_status: string
  score: number
}

export interface GameState {
  // Connection
  screen: 'landing' | 'game'
  gameMode: 'pvai' | 'spectator' | null
  gameId: string | null
  connected: boolean

  // Building
  building: Building | null

  // Agents
  crew: Agent[]
  guards: Guard[]

  // Planning
  waypoints: Record<string, [number, number]>
  selectedAgent: string | null
  paths: Record<string, [number, number][]>
  cbsEvents: CBSEvent[]
  planning: boolean

  // Turn state
  turn: number
  gameStatus: 'active' | 'won' | 'lost'
  score: number
  objectivesCompleted: string[]

  // Visualizations
  bayesianHeatmap: Record<string, number>
  minimaxLog: Record<string, unknown>[]
  sensorEvents: { sensor_id: string; event_type: string; pos: [number, number] }[]
  turnResult: TurnResult | null

  // AI vs AI
  aiSpeed: number
  aiRunning: boolean

  // Viz panel toggles
  showCBSTree: boolean
  showBayesian: boolean
  showMinimax: boolean
  showAstarViz: boolean

  // Actions
  setScreen: (s: 'landing' | 'game') => void
  setGameMode: (m: 'pvai' | 'spectator') => void
  setGameId: (id: string) => void
  setConnected: (c: boolean) => void
  setBuilding: (b: Building) => void
  setCrew: (c: Agent[]) => void
  setGuards: (g: Guard[]) => void
  setWaypoint: (agentId: string, pos: [number, number]) => void
  clearWaypoints: () => void
  setSelectedAgent: (id: string | null) => void
  setPaths: (p: Record<string, [number, number][]>) => void
  addCBSEvent: (e: CBSEvent) => void
  clearCBSEvents: () => void
  setPlanning: (p: boolean) => void
  setTurnResult: (r: TurnResult) => void
  setBayesianHeatmap: (h: Record<string, number>) => void
  setMinimaxLog: (l: Record<string, unknown>[]) => void
  setAiSpeed: (s: number) => void
  setAiRunning: (r: boolean) => void
  toggleViz: (name: 'showCBSTree' | 'showBayesian' | 'showMinimax' | 'showAstarViz') => void
  reset: () => void
}

const initialState = {
  screen: 'landing' as const,
  gameMode: null,
  gameId: null,
  connected: false,
  building: null,
  crew: [],
  guards: [],
  waypoints: {},
  selectedAgent: null,
  paths: {},
  cbsEvents: [],
  planning: false,
  turn: 0,
  gameStatus: 'active' as const,
  score: 0,
  objectivesCompleted: [],
  bayesianHeatmap: {},
  minimaxLog: [],
  sensorEvents: [],
  turnResult: null,
  aiSpeed: 1,
  aiRunning: false,
  showCBSTree: true,
  showBayesian: true,
  showMinimax: false,
  showAstarViz: true,
}

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setScreen: (s) => set({ screen: s }),
  setGameMode: (m) => set({ gameMode: m }),
  setGameId: (id) => set({ gameId: id }),
  setConnected: (c) => set({ connected: c }),
  setBuilding: (b) => set({ building: b }),
  setCrew: (c) => set({ crew: c }),
  setGuards: (g) => set({ guards: g }),
  setWaypoint: (agentId, pos) =>
    set((s) => ({ waypoints: { ...s.waypoints, [agentId]: pos } })),
  clearWaypoints: () => set({ waypoints: {} }),
  setSelectedAgent: (id) => set({ selectedAgent: id }),
  setPaths: (p) => set({ paths: p }),
  addCBSEvent: (e) => set((s) => ({ cbsEvents: [...s.cbsEvents, e] })),
  clearCBSEvents: () => set({ cbsEvents: [] }),
  setPlanning: (p) => set({ planning: p }),
  setTurnResult: (r) =>
    set({
      turnResult: r,
      turn: r.turn,
      gameStatus: r.game_status as 'active' | 'won' | 'lost',
      score: r.score,
      sensorEvents: r.sensor_events,
      bayesianHeatmap: r.bayesian_heatmap,
      minimaxLog: r.minimax_log,
      objectivesCompleted: r.objectives_completed,
    }),
  setBayesianHeatmap: (h) => set({ bayesianHeatmap: h }),
  setMinimaxLog: (l) => set({ minimaxLog: l }),
  setAiSpeed: (s) => set({ aiSpeed: s }),
  setAiRunning: (r) => set({ aiRunning: r }),
  toggleViz: (name) => set((s) => ({ [name]: !s[name] })),
  reset: () => set(initialState),
}))
