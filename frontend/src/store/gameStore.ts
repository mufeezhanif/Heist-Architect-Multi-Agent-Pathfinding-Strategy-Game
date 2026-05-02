/* ── Heist Architect — Zustand global store ── */
import { create, type StoreApi, type UseBoundStore } from 'zustand'

// ── Types ──
export interface Cell {
  type: string
  room_id: string | null
  walkable: boolean
  sensor: string | null
}

export interface Building {
  width: number
  height: number
  grid: Cell[][]
  cameras: { id: string; pos: [number, number]; direction: string; active?: boolean; vision: [number, number][] }[]
  entries: [number, number][]
  extraction_points: [number, number][]
  objectives: { id: string; pos: [number, number]; label: string }[]
}

export interface Agent {
  agent_id: string
  role: string
  pos: [number, number]
  alive: boolean
  abilities: string[]
  ability_uses: Record<string, number>
  ability_cooldowns: Record<string, number>
  detected: boolean
}

export interface Guard {
  guard_id: string
  pos: [number, number]
  patrol: [number, number][]
  patrol_type: string
  knocked_out: boolean
  knocked_out_turns: number
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
  detections: { type: string; crew_id: string; x: number; y: number }[]
  objectives_completed: string[]
  bayesian_heatmap: Record<string, number>
  warden_action: Record<string, unknown> | null
  game_status: string
  score: number
  alert_level: number
  event_log: string[]
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
  maxTurns: number
  gameStatus: 'active' | 'won' | 'lost'
  score: number
  objectivesCompleted: string[]
  alertLevel: number     // 0=green, 1=yellow, 2=red, 3=lockdown
  eventLog: string[]

  // Visualizations
  bayesianHeatmap: Record<string, number>
  sensorEvents: { sensor_id: string; event_type: string; pos: [number, number] }[]
  turnResult: TurnResult | null

  // AI vs AI
  aiSpeed: number
  aiRunning: boolean

  // Viz panel toggles
  showCBSTree: boolean
  showBayesian: boolean
  showAstarViz: boolean

  // Move mode
  moveMode: 'quick' | 'strategic'
  pendingMoves: Record<string, [number, number]>   // agentId → destination (quick mode)
  previewPaths: Record<string, [number, number][]>  // instant path preview before CBS

  // Tutorial
  isTutorial: boolean
  tutorialStep: number

  // Execution control
  executionStep: number
  executionTotal: number
  executionMode: 'idle' | 'stepping' | 'playing' | 'paused' | 'done'
  stepQueue: Record<string, unknown>[]    // queued step messages for manual stepping

  // Narration
  narrationEntries: { text: string; type: 'move' | 'sensor' | 'warden' | 'objective' | 'alert' | 'info' }[]

  // Help
  showHelp: boolean
  showHowToPlay: boolean

  // UI settings
  showSecurityLabels: boolean
  uiTheme: 'dark' | 'light'
    godMode: boolean

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
  setMaxTurns: (n: number) => void
  setTurnResult: (r: TurnResult) => void
  setBayesianHeatmap: (h: Record<string, number>) => void
  setAlertLevel: (l: number) => void
  addEventLog: (msg: string) => void
  setEventLog: (log: string[]) => void
  setAiSpeed: (s: number) => void
  setAiRunning: (r: boolean) => void
  toggleViz: (name: 'showCBSTree' | 'showBayesian' | 'showAstarViz') => void
  setMoveMode: (m: 'quick' | 'strategic') => void
  setPendingMove: (agentId: string, pos: [number, number]) => void
  clearPendingMoves: () => void
  setPreviewPaths: (p: Record<string, [number, number][]>) => void
  setIsTutorial: (t: boolean) => void
  setTutorialStep: (step: number) => void
  advanceTutorial: () => void
  setExecutionStep: (step: number) => void
  setExecutionTotal: (total: number) => void
  setExecutionMode: (mode: 'idle' | 'stepping' | 'playing' | 'paused' | 'done') => void
  pushStepToQueue: (step: Record<string, unknown>) => void
  popStepFromQueue: () => Record<string, unknown> | undefined
  clearStepQueue: () => void
  addNarration: (entry: { text: string; type: 'move' | 'sensor' | 'warden' | 'objective' | 'alert' | 'info' }) => void
  clearNarration: () => void
  setShowHelp: (show: boolean) => void
  setShowHowToPlay: (show: boolean) => void
  setShowSecurityLabels: (show: boolean) => void
  toggleTheme: () => void
  reset: () => void
    setObjectivesCompleted: (list: string[]) => void
}

const initialState = {
  screen: 'landing' as const,
  gameMode: null as 'pvai' | 'spectator' | null,
  gameId: null as string | null,
  connected: false,
  building: null as Building | null,
  crew: [] as Agent[],
  guards: [] as Guard[],
  waypoints: {} as Record<string, [number, number]>,
  selectedAgent: null as string | null,
  paths: {} as Record<string, [number, number][]>,
  cbsEvents: [] as CBSEvent[],
  planning: false,
  turn: 0,
  maxTurns: 50,
  gameStatus: 'active' as const,
  score: 0,
  objectivesCompleted: [] as string[],
  alertLevel: 0,
  eventLog: [] as string[],
  bayesianHeatmap: {} as Record<string, number>,
  sensorEvents: [] as { sensor_id: string; event_type: string; pos: [number, number] }[],
  turnResult: null as TurnResult | null,
  aiSpeed: 1,
  aiRunning: false,
  showCBSTree: true,
  showBayesian: true,
  showAstarViz: true,
  moveMode: 'quick' as const,
  pendingMoves: {} as Record<string, [number, number]>,
  previewPaths: {} as Record<string, [number, number][]>,
  isTutorial: false,
  tutorialStep: 0,
  executionStep: 0,
  executionTotal: 0,
  executionMode: 'idle' as const,
  stepQueue: [] as Record<string, unknown>[],
  narrationEntries: [] as { text: string; type: 'move' | 'sensor' | 'warden' | 'objective' | 'alert' | 'info' }[],
  showHelp: false,
  showHowToPlay: false,
  showSecurityLabels: true,
  uiTheme: 'dark' as const,
    godMode: false,
}

export const useGameStore: UseBoundStore<StoreApi<GameState>> = create<GameState>()((set) => ({
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
  setMaxTurns: (n) => set({ maxTurns: n }),
  setTurnResult: (r) =>
    set({
      turnResult: r,
      turn: r.turn,
      gameStatus: (r.game_status === 'planning' ? 'active' : r.game_status) as 'active' | 'won' | 'lost',
      score: r.score,
      sensorEvents: r.sensor_events,
      bayesianHeatmap: r.bayesian_heatmap,
      objectivesCompleted: r.objectives_completed,
      alertLevel: r.alert_level,
      eventLog: r.event_log || [],
    }),
  setBayesianHeatmap: (h) => set({ bayesianHeatmap: h }),
  setAlertLevel: (l) => set({ alertLevel: l }),
  addEventLog: (msg) => set((s) => ({ eventLog: [...s.eventLog.slice(-19), msg] })),
  setEventLog: (log) => set({ eventLog: log }),
  setAiSpeed: (s) => set({ aiSpeed: s }),
  setAiRunning: (r) => set({ aiRunning: r }),
  toggleViz: (name) => set((s) => ({ [name]: !s[name] })),
  setMoveMode: (m) => set({ moveMode: m }),
  setPendingMove: (agentId, pos) =>
    set((s) => ({ pendingMoves: { ...s.pendingMoves, [agentId]: pos } })),
  clearPendingMoves: () => set({ pendingMoves: {} }),
  setPreviewPaths: (p) => set({ previewPaths: p }),
  setIsTutorial: (t) => set({ isTutorial: t }),
  setTutorialStep: (step) => set({ tutorialStep: step }),
  advanceTutorial: () => set((s) => ({ tutorialStep: s.tutorialStep + 1 })),
  setExecutionStep: (step) => set({ executionStep: step }),
  setExecutionTotal: (total) => set({ executionTotal: total }),
  setExecutionMode: (mode) => set({ executionMode: mode }),
  pushStepToQueue: (step) => set((s) => ({ stepQueue: [...s.stepQueue, step] })),
  popStepFromQueue: () => {
    const s = useGameStore.getState()
    const [first, ...rest] = s.stepQueue
    set({ stepQueue: rest, executionStep: s.executionStep + 1 })
    return first
  },
  clearStepQueue: () => set({ stepQueue: [], executionStep: 0, executionTotal: 0, executionMode: 'idle' }),
  addNarration: (entry) =>
    set((s) => ({ narrationEntries: [...s.narrationEntries.slice(-29), entry] })),
  clearNarration: () => set({ narrationEntries: [] }),
  setShowHelp: (show) => set({ showHelp: show }),
  setShowHowToPlay: (show) => set({ showHowToPlay: show }),
  setShowSecurityLabels: (show) => set({ showSecurityLabels: show }),
  toggleTheme: () => set((s) => ({ uiTheme: s.uiTheme === 'dark' ? 'light' : 'dark' })),
  reset: () => set(initialState),
    setObjectivesCompleted: (list) => set({ objectivesCompleted: list }),
}))
