/**
 * Observatory API client — talks to /arena, /theater, /bench endpoints
 * via the Vite proxy (/api/* → backend localhost:8000/*).
 */

export interface GridData {
  name: string
  width: number
  height: number
  cells: number[][]
}

export interface AStarStep {
  step: number
  current: [number, number]
  g: number
  f: number
  frontier: [number, number, number][]  // [x, y, f]
  closed: [number, number][]
}

export interface AStarRunResult {
  success: boolean
  path: [number, number][]
  cost: number
  nodes_expanded: number
  runtime_ms: number
  steps: AStarStep[]
}

export interface AStarResponse extends AStarRunResult {
  mode: 'single' | 'race'
  grid: GridData
  start: [number, number]
  goal: [number, number]
  heuristic?: string
  runs?: Record<string, AStarRunResult>
}

export interface CBSAgent {
  id: string
  start: [number, number]
  goal: [number, number]
}

export interface CBSResponse {
  grid: GridData
  agents: CBSAgent[]
  success: boolean
  paths: Record<string, [number, number][]>
  total_cost: number
  makespan: number
  conflicts_resolved: number
  tree_log: any[]
  runtime_ms: number
}

export interface BenchResult {
  trial: number
  num_agents: number
  success: boolean
  total_cost?: number
  makespan?: number
  conflicts_resolved?: number
  runtime_ms: number
  ct_nodes?: number
  error?: string
}

export interface BenchResponse {
  grid: { name: string; width: number; height: number }
  config: { num_agents: number; num_trials: number; seed: number | null }
  summary: {
    total_trials: number
    successful: number
    success_rate: number
    avg_runtime_ms: number
    avg_cost: number
    avg_makespan: number
    avg_conflicts: number
  }
  results: BenchResult[]
}

export interface SampleInfo {
  name: string
  width: number
  height: number
  walkable_cells: number
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function arenaSamples(): Promise<{ samples: SampleInfo[]; heuristics: string[] }> {
  return request('/arena/samples')
}

export async function runAStar(body: {
  grid: { sample?: string; map_text?: string; cells?: number[][]; width?: number; height?: number; name?: string }
  start: [number, number]
  goal: [number, number]
  heuristic?: string
  compare?: string[]
  max_expansions?: number
}): Promise<AStarResponse> {
  return request('/arena/astar', { method: 'POST', body: JSON.stringify(body) })
}

export async function runCBS(body: {
  grid: { sample?: string; map_text?: string }
  agents: CBSAgent[]
  max_iterations?: number
}): Promise<CBSResponse> {
  return request('/arena/cbs', { method: 'POST', body: JSON.stringify(body) })
}

export async function theaterStart(): Promise<any> {
  return request('/theater/start', { method: 'POST', body: '{}' })
}

export async function theaterTurn(gameId: string): Promise<any> {
  return request(`/theater/${gameId}/turn`, { method: 'POST', body: '{}' })
}

export async function benchRun(body: {
  grid: { sample?: string; map_text?: string }
  num_agents: number
  num_trials: number
  seed?: number
  max_iterations?: number
}): Promise<BenchResponse> {
  return request('/bench/run', { method: 'POST', body: JSON.stringify(body) })
}

export async function benchExportCSV(results: BenchResult[]): Promise<Blob> {
  const res = await fetch('/api/bench/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  })
  if (!res.ok) throw new Error(`export failed: ${res.status}`)
  return res.blob()
}
