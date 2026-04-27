# Heist Architect — Project & AI Algorithm Documentation

> Evaluation-ready reference for the **Heist Architect** game.
> Explains the project workflow, data flow, and **every AI algorithm** with
> direct citations to the files and line ranges where they are implemented.

---

## 1. Project Overview

**Heist Architect** is a turn-based stealth strategy game where a player (the
*Mastermind*) plans paths for a 3-member crew (Hacker, Thief, Muscle) through
a 30×25 grid building patrolled by guards, cameras, and sensors controlled by
an AI *Warden*. The game showcases **five classical AI algorithms** working
together in a single coherent system.

| Layer | Tech | Folder |
|-------|------|--------|
| Backend | Python 3.11 + FastAPI + WebSockets | [backend/](backend/) |
| AI core | Pure-Python algorithms (numpy for Bayesian) | [backend/algorithms/](backend/algorithms/) |
| Game logic | Dataclasses + enum-driven state machine | [backend/game/](backend/game/) |
| Frontend | React 18 + TypeScript + Vite | [frontend/src/](frontend/src/) |
| 3D | Three.js via @react-three/fiber | [frontend/src/three/](frontend/src/three/) |
| State | Zustand store, framer-motion, d3 | [frontend/src/store/](frontend/src/store/) |

---

## 2. End-to-End Workflow

```
┌──────────────┐   waypoints   ┌────────────────┐   plan_complete  ┌──────────────┐
│  Mastermind  │ ─────────────▶│   FastAPI WS   │ ────────────────▶│   Frontend   │
│   (player)   │               │ (CBS + CSP)    │                  │   3D scene   │
└──────────────┘               └────────────────┘                  └──────────────┘
       ▲                              │                                    │
       │ execute                      │ tree_log streamed live             │
       │                              ▼                                    ▼
       │                       ┌──────────────┐                    ┌──────────────┐
       │                       │  Game engine │                    │ CBS / Bayes /│
       └────── turn_result ────│  (Bayesian + │ ◀──────────────────│  Minimax     │
                               │   Minimax)   │                    │  panels      │
                               └──────────────┘                    └──────────────┘
```

### Turn-by-turn data flow

1. **Player** drags waypoints onto the 3D maze
   ([frontend/src/three/WaypointPicker.tsx](frontend/src/three/WaypointPicker.tsx)).
2. Frontend sends `{action:"plan", waypoints:{...}}` over WebSocket
   ([frontend/src/api/client.ts](frontend/src/api/client.ts)).
3. Backend **plans** all crew paths simultaneously via CBS (which calls A*),
   constrained by CSP temporal dependencies
   ([backend/game/engine.py](backend/game/engine.py) — `plan_paths`).
4. CBS streams its constraint-tree exploration as `cbs_event` messages
   ([backend/api/websocket.py](backend/api/websocket.py)).
5. Frontend renders the d3 tree live
   ([frontend/src/visualizations/CBSTreePanel.tsx](frontend/src/visualizations/CBSTreePanel.tsx)).
6. Player presses **Execute**; engine runs the turn step-by-step.
7. After execution, the engine:
   - feeds sensor events into a **Bayesian update** of the Warden's belief grid,
   - runs **Minimax** to pick the Warden's next action.
8. `turn_result` returns: crew positions, detections, Bayesian heatmap,
   Minimax decision tree.

---

## 3. AI Algorithms — How and Where

There are **five algorithms**. Each section below answers, in order:
*what is it, where is it implemented, how does it integrate with the rest of
the game?*

---

### 3.1 A* Search (Space-Time variant)

> **Course topic:** Informed Search · **Complexity:** O(b^d) · **Role:** Single-agent path planner used as low-level solver inside CBS.

**File:** [backend/algorithms/astar.py](backend/algorithms/astar.py)

| Symbol | Lines | Responsibility |
|--------|------:|----------------|
| `SpaceTimeNode` dataclass | 27–48 | State = `(x, y, t)`; same cell at different times is a different node — so CBS can forbid `(3,4)` only at `t=5`. |
| `SearchResult` dataclass | 51–58 | Output: `path`, `cost`, `nodes_expanded`, `success`, `timesteps`. |
| `manhattan_distance(...)` | 65–71 | Admissible & consistent heuristic for 4-connected grids. |
| `astar_search(building, start, goal, constraints, edge_constraints, ...)` | 78–151 | Core loop. Open set is a `heapq` priority queue ordered by `f = g + h`. Expands 4 neighbors plus a **WAIT** action; rejects any neighbor that violates a CBS vertex/edge constraint. |
| `_reconstruct(node)` | 158–169 | Walks parent pointers to build the path + timesteps. |

**Where it is called from:**

- Inside CBS at [backend/algorithms/cbs.py](backend/algorithms/cbs.py) lines
  **180** (root planning) and **245** (re-planning a constrained agent after a branch).
- The grid `neighbors()` and `is_walkable()` methods come from
  [backend/game/building.py](backend/game/building.py).

**Why space-time?** Because CBS hands A* constraints of the form
"agent X must not be at cell (x,y) at time t", every node must include
time as a dimension. This is the only difference from textbook A*.

---

### 3.2 Conflict-Based Search (CBS)

> **Course topic:** Multi-Agent Pathfinding (MAPF) · **Complexity:** Exponential worst-case, efficient in practice · **Role:** Plans collision-free paths for the **entire crew** simultaneously.

**File:** [backend/algorithms/cbs.py](backend/algorithms/cbs.py)

| Symbol | Lines | Responsibility |
|--------|------:|----------------|
| `Conflict` dataclass | 26–40 | A pair of agents at the same `(x,y,t)` (vertex) or swapping cells (edge). |
| `Constraint` dataclass | 43–53 | "Agent X must not be at (x,y,t)". Generated whenever CBS resolves a conflict. |
| `CTNode` dataclass | 56–69 | One node of the **constraint tree**: a set of constraints + the resulting paths + total cost. Comparable so it can sit in a `heapq`. |
| `CBSResult` dataclass | 72–80 | Final paths + makespan + `tree_log` for visualization. |
| `detect_first_conflict(paths)` | 87–127 | Scans every pair of agent paths for the first vertex or edge collision. |
| `cbs_search(building, agents, extra_constraints, max_iterations)` | 134–266 | High-level best-first search. |
| `_get_agent_constraints(...)` | 273–284 | Filters the global constraint list down to one agent before re-planning. |
| `_build_result(...)` | 287–315 | Assembles the final `CBSResult` once a conflict-free node is reached. |

**Algorithm (in code order):**

1. **Root** — plan each agent independently with A* (lines **165–185**).
2. Push root into a min-heap keyed by total path cost (line **199**).
3. **Pop** lowest-cost CT node (line **211**).
4. **Detect** first conflict among all agent paths (line **214**).
5. If no conflict → solution; emit `cbs_solution` log entry and return.
6. Otherwise **branch** on both involved agents (line **236**), adding one
   new `Constraint` per child, and re-run A* for that constrained agent
   (lines **245–252**). Push the children back onto the heap.
7. Each iteration appends an entry to `tree_log` (`cbs_root`, `cbs_conflict`,
   `cbs_branch`, `cbs_branch_fail`, `cbs_solution`) — these are streamed to
   the frontend (see §4).

**Visualization:** the tree is rendered via d3 in
[frontend/src/visualizations/CBSTreePanel.tsx](frontend/src/visualizations/CBSTreePanel.tsx).

---

### 3.3 Constraint Satisfaction (CSP) — Temporal Dependencies

> **Course topic:** CSP / Constraint Propagation · **Complexity:** O(n·d) · **Role:** Enforces ordering rules like *"Hacker must disable the alarm before Thief enters the vault"*.

**File:** [backend/algorithms/csp.py](backend/algorithms/csp.py)

| Symbol | Lines | Responsibility |
|--------|------:|----------------|
| `Dependency` dataclass | 27–40 | `(prereq_agent, prereq_target) → (dependent_agent, blocked_cells)`. |
| `ExtractionWindow` dataclass | 43–48 | "All crew reach extraction within `window` turns of each other." |
| `build_dependencies(deps_config)` | 56–76 | Loads dependencies from the level config. |
| `generate_temporal_constraints(...)` | 84–125 | **Constraint propagation:** converts each dependency into a list of CBS `Constraint` objects that block the dependent agent's cells until the prereq agent is known to have arrived. |
| `iterative_csp_cbs(...)` | 128–164 | Solves CBS in rounds: round 1 uses a conservative blocking estimate; subsequent rounds tighten the constraints using actual arrival times observed in the previous solution. |
| `validate_dependencies(...)` | 171–199 | Post-checks that the final CBS solution honors every temporal dependency. |

**How it plugs in:**

CBS accepts a list of constraints via its `extra_constraints` parameter.
The engine passes the CSP-generated constraints there:

```python
# backend/game/engine.py · plan_paths(...)
extra = generate_temporal_constraints(state.dependencies)
result = cbs_search(state.building, agents, extra_constraints=extra)
satisfied = validate_dependencies(state.dependencies, result.paths)
```
([backend/game/engine.py](backend/game/engine.py) — `plan_paths` around line **278**.)

This is a textbook example of **propagating temporal constraints into the
spatial domain** so that a single search algorithm (CBS+A*) can honor them.

---

### 3.4 Bayesian Belief Tracking

> **Course topic:** Bayesian Networks / Probabilistic Reasoning · **Complexity:** O(W·H) per update · **Role:** The Warden's tracker — a probability distribution over the grid estimating where the crew is hiding.

**File:** [backend/algorithms/bayesian.py](backend/algorithms/bayesian.py)

| Symbol | Lines | Responsibility |
|--------|------:|----------------|
| `ObservationType` enum | 27–35 | DOOR_TRIGGER, MOTION_TRIGGER, CAMERA_SPOTTED, SOUND_HEARD, plus their *silent* counterparts. |
| `Observation` dataclass | 38–43 | A single sensor reading for the current turn. |
| `BeliefGrid` dataclass | 46–67 | `numpy` array `P(thief_at_cell)`; uniform-init over walkable cells. |
| `bayesian_update(belief, observations)` | 76–119 | **Bayes' theorem applied per observation:** posterior ∝ likelihood × prior, then normalize. Observations within a turn are treated as conditionally independent given the thief position. |
| `predict_movement(belief, building, stay_prob)` | 126–168 | Hidden-Markov-style **prediction step**: each cell's mass is partly retained (`stay_prob`) and partly spread evenly to its walkable neighbors. |
| `_compute_likelihood(belief, obs)` | 175–253 | The **sensor model** `P(obs | thief_at_cell)` for every cell. Triggered sensors concentrate probability near the sensor; *silent* sensors push probability away. |
| `get_top_cells(belief, n)` | 256–264 | Top-N most-suspicious cells (drives the right-sidebar list and HUD warnings). |
| `belief_to_dict(belief)` | 267–273 | Serializes the heatmap for the WebSocket payload. |

**Lifecycle in a turn:**

1. After every `execute_step`, sensors fire and emit `SensorEvent`s
   ([backend/game/sensors.py](backend/game/sensors.py)).
2. The engine converts events to `Observation`s and calls
   `bayesian_update` (engine line **368**), then `predict_movement` (line **370**).
3. The new belief grid is stored on the `GameState` and shipped to the frontend
   inside the `turn_result` WebSocket message.
4. The frontend renders the heatmap overlay on the maze
   ([frontend/src/three/BayesianOverlay3D.tsx](frontend/src/three/BayesianOverlay3D.tsx)) and a
   top-cells list
   ([frontend/src/visualizations/BayesianPanel.tsx](frontend/src/visualizations/BayesianPanel.tsx)).

---

### 3.5 Minimax with Alpha-Beta Pruning

> **Course topic:** Adversarial Search · **Complexity:** O(b^d), reduced to ~O(b^(d/2)) with perfect pruning · **Role:** Warden decision-maker — picks the next guard move / camera rotation / sensor deployment.

**File:** [backend/algorithms/minimax.py](backend/algorithms/minimax.py)

| Symbol | Lines | Responsibility |
|--------|------:|----------------|
| `ActionType` enum | 27–32 | MOVE_GUARD, ROTATE_CAMERA, DEPLOY_SENSOR, LOCKDOWN, DO_NOTHING. |
| `WardenAction` dataclass | 35–43 | A single Warden move with target/direction. |
| `WardenState` dataclass | 46–73 | Warden-perspective snapshot (guard positions, camera dirs, belief grid, alert level, vision cells per guard). Has a deep `copy()` for simulation. |
| `EvalResult` dataclass | 76–82 | Best action + score + `tree_log` for visualization. |
| `generate_actions(state, building)` | 91–145 | Action enumerator. Limits branching factor by targeting only the **top-N suspicious cells** (from the Bayesian belief) and direct neighbors. |
| `_get_high_prob_cells(grid, n)` | 148–157 | Plucks the highest-belief cells — links Bayesian → Minimax. |
| `evaluate(state, building)` | 165–198 | Heuristic: detection potential + coverage of high-prob cells + belief concentration + alert bonus. |
| `minimax_search(state, building, max_depth)` | 205–284 | **Minimax with alpha-beta**. Warden = MAX, simulated thief response = MIN. Logs every node, prune, and root action into `tree_log`. |
| `_apply_action(...)` | 287–311 | Forward simulation of a Warden action. |
| `_simulate_thief_move(state)` | 314–336 | The MIN player's "move": probability mass leaks away from cells occupied by guards (thieves avoid guards). |

**Coupling with the Bayesian module:**
`generate_actions` and `evaluate` both consume the Bayesian belief grid, so
Minimax effectively asks: *"given what I currently believe about the thieves,
which action maximizes my detection score?"*

**Visualization:** the Minimax tree is rendered with d3 in
[frontend/src/visualizations/MinimaxPanel.tsx](frontend/src/visualizations/MinimaxPanel.tsx).

---

## 4. The Game Engine — Where Algorithms Meet

**File:** [backend/game/engine.py](backend/game/engine.py)

This is the orchestration layer. It owns the global `GameState` and is the
**only** module that calls every algorithm.

| Symbol | Lines | Responsibility |
|--------|------:|----------------|
| `GameStatus` enum | 45 | PLANNING / EXECUTING / WON / LOST. |
| `AlertLevel` enum | 51 | GREEN → YELLOW → RED → LOCKDOWN; controls guard vision range and sensor sensitivity. |
| `GameMode` enum | 57 | PVA_MASTERMIND (player plans, AI is Warden) / AI_VS_AI. |
| `GameState` dataclass | 94 | Holds building, crew, guards, sensors, dependencies, belief grid, paths, planning artefacts, alert state, narration log. |
| `create_game(...)` | 218 | Factory: builds the medium 30×25 level, spawns crew/guards, wires sensors and CSP dependencies. |
| `plan_paths(...)` | 278 | **CSP → CBS → A*** pipeline. Calls `generate_temporal_constraints`, then `cbs_search`, then `validate_dependencies`. Returns the `tree_log` so the WS layer can stream it. |
| `execute_step(...)` | 301 | Advances every agent one tick, runs sensor checks, computes detections. |
| `execute_turn(...)` | 335 | Loops `execute_step` until the turn budget is exhausted, then runs **Bayesian update + prediction** and **Minimax** (`_run_warden_ai`). |
| `use_ability(...)` | 405 | Crew ability handling (KNOCK_OUT, DISABLE_DEVICE, PICK_LOCK, SPRINT). |
| `_update_alert(...)` | 495 | Translates suspicion score into the four-stage alert ladder. |
| `_decay_alert(...)` | 570 | Suspicion bleeds off over time. |
| `ai_mastermind_plan(...)` | 592 | AI-vs-AI mode: an AI controls the crew via the same CBS/CSP pipeline. |
| `_check_detections(...)` | 637 | Guard line-of-sight + camera cone evaluation. |
| `_check_objectives(...)` | 670 | Marks role-based objectives complete. |
| `_check_endgame(...)` | 695 | Win/Loss decision. |

The engine is also where the **narration log** is appended, so every algorithm
event gets a natural-language sentence on the Play-by-Play panel.

---

## 5. Supporting Game Modules

### 5.1 Building grid — [backend/game/building.py](backend/game/building.py)

- `CellType` enum (line 9) and `SensorType` / `ObjectiveType` enums.
- `Building` dataclass (line 42) with `is_walkable()`, `neighbors()` (4-connected),
  `find_objectives()`, and `get_camera_vision()` (cone projection used by sensors).
- `create_medium_building()` (line 127) hand-crafts the 30×25 layout used in evaluation.
- **Algorithm hooks:** `neighbors()` and `is_walkable()` are consumed directly by
  A* / CBS; the dimensions seed the Bayesian `BeliefGrid`.

### 5.2 Agents — [backend/game/agents.py](backend/game/agents.py)

- `CrewMember` (line 26): role-specific abilities (Hacker → DISABLE_DEVICE,
  Thief → PICK_LOCK, Muscle → KNOCK_OUT) with 3 uses and 2-turn cooldowns.
- `Guard` (line 61): `advance_patrol()` supports LINEAR (ping-pong),
  LOOP (cyclic), and RANDOM patrols; `get_vision_cells()` widens with alert level.
- `create_default_crew()` and `create_default_guards()` initialize the level.

### 5.3 Sensors — [backend/game/sensors.py](backend/game/sensors.py)

- `SensorSystem.check_all()` (line 39) returns **both triggered and silent**
  events — silent events are critical because they let the Bayesian likelihood
  function eliminate cells where the thief *isn't*.
- `_camera_cone()` (line 97) computes the cone vision used by camera sensors.
- These events are converted to `Observation`s in the engine and fed to
  `bayesian_update`.

---

## 6. API Layer

### 6.1 REST — [backend/api/routes.py](backend/api/routes.py)

| Endpoint | Purpose |
|----------|---------|
| `POST /game/create` | Create a game, returns `game_id` + initial state. |
| `GET /game/{id}/state` | Perspective-aware state snapshot. |
| `GET /game/{id}/building` | Static building geometry. |
| `POST /game/{id}/plan` | Run CBS/CSP, return `paths`, `tree_log`, conflict count. |
| `POST /game/{id}/execute` | Run one turn, return positions / detections / score. |
| `POST /game/{id}/ai-plan` | AI-vs-AI plan. |

### 6.2 WebSocket — [backend/api/websocket.py](backend/api/websocket.py)

**Inbound actions** (sent by the frontend):

| `action` | Effect |
|----------|--------|
| `"plan"` | Run `plan_paths()`, **stream every `cbs_event`** as it is generated, then send `plan_complete`. |
| `"execute"` | Run `execute_turn()`, stream `step` events, send final `turn_result`. |
| `"ability"` | Trigger a crew ability. |
| `"ai_plan"` / `"ai_step"` | AI-vs-AI driver. |
| `"state"` | On-demand state refresh. |

**Outbound events**:

| Event | Payload highlights |
|-------|--------------------|
| `connected` | Initial state + `god_mode` flag. |
| `cbs_event` | Live CBS tree exploration entries. |
| `plan_complete` | Final paths, costs, `algorithm_used` tags (A*, CBS, CSP). |
| `step` | Per-tick movement + narration. |
| `turn_result` | Crew/guard state, detections, **Bayesian heatmap**, **Minimax tree**, narration. |
| `ability_result` | Ability outcome and updated agents. |
| `state` | Snapshot. |

---

## 7. Frontend Architecture

### 7.1 State store — [frontend/src/store/gameStore.ts](frontend/src/store/gameStore.ts)

A Zustand store. Notable slices:

- **Connection / screen:** `screen`, `gameMode`, `connected`, `godMode`.
- **World:** `building`, `crew`, `guards`.
- **Planning:** `waypoints`, `paths`, `cbsEvents`, `planning`.
- **Execution:** `turn`, `gameStatus`, `score`, `objectivesCompleted`,
  `alertLevel`, `eventLog`.
- **AI visualizations:** `bayesianHeatmap`, `minimaxLog`, `sensorEvents`,
  `turnResult`.
- **UI controls:** `aiSpeed`, `executionMode`, `stepQueue`,
  `showCBSTree`, `showBayesian`, `showMinimax`, `showAstarViz`.
- **Tutorial / narration:** `isTutorial`, `tutorialStep`, `narrationEntries`.

### 7.2 WebSocket client — [frontend/src/api/client.ts](frontend/src/api/client.ts)

- `createGame()`, `getGameState()`, `planPaths()`, `executeTurn()` REST helpers.
- `connectWebSocket()` opens the socket and routes each `event` type into the
  matching store action.
- `sendWS()` posts player actions back to the backend.
- [frontend/src/api/normalize.ts](frontend/src/api/normalize.ts) maps the
  backend payload (`{id, x, y, detected, abilities, ...}`) to the typed
  frontend shapes.

### 7.3 3D rendering — [frontend/src/three/](frontend/src/three/)

- [GameScene.tsx](frontend/src/three/GameScene.tsx) — top-level canvas, isometric
  `OrbitControls`, lights, fog, error boundary.
- [Building3D.tsx](frontend/src/three/Building3D.tsx) — walls, floors, doors, objectives.
- [Agents3D.tsx](frontend/src/three/Agents3D.tsx) — animated crew/guard meshes.
- [Paths3D.tsx](frontend/src/three/Paths3D.tsx) — CBS-planned paths drawn as lines.
- [WaypointPicker.tsx](frontend/src/three/WaypointPicker.tsx) — click-to-set waypoints.
- [BayesianOverlay3D.tsx](frontend/src/three/BayesianOverlay3D.tsx) — Warden heatmap as a
  ground-plane shader.

### 7.4 Algorithm UI panels

| Algorithm | Panel | File |
|-----------|-------|------|
| CBS tree | "Route Planning (CBS)" | [frontend/src/visualizations/CBSTreePanel.tsx](frontend/src/visualizations/CBSTreePanel.tsx) |
| Bayesian | "Warden's Suspicion" | [frontend/src/visualizations/BayesianPanel.tsx](frontend/src/visualizations/BayesianPanel.tsx) |
| Minimax | "Guard Strategy (Minimax)" | [frontend/src/visualizations/MinimaxPanel.tsx](frontend/src/visualizations/MinimaxPanel.tsx) |
| Algorithm chips | A* / CBS / CSP / Bayesian / Minimax indicators | [frontend/src/components/AlgorithmStatus.tsx](frontend/src/components/AlgorithmStatus.tsx) |
| Sensor alerts | Live sensor triggers | [frontend/src/components/SensorLog.tsx](frontend/src/components/SensorLog.tsx) |
| Play-by-play | Plain-English narration | [frontend/src/components/NarrationPanel.tsx](frontend/src/components/NarrationPanel.tsx) |

These panels live in two sidebars flanking the maze:

- [frontend/src/components/LeftSidebar.tsx](frontend/src/components/LeftSidebar.tsx) — algorithm
  status, sensors, narration.
- [frontend/src/components/RightSidebar.tsx](frontend/src/components/RightSidebar.tsx) — speed/viz
  controls, CBS / Bayesian / Minimax panels.

---

## 8. Data Management Summary

| Concern | Owner | Notes |
|---------|-------|-------|
| Persistent game registry | `GAMES: dict[str, GameState]` in [backend/game/engine.py](backend/game/engine.py) | In-memory only — sufficient for evaluation. |
| Live updates | WebSocket `cbs_event` / `step` / `turn_result` | One socket per game; events streamed as they are generated. |
| Frontend state | Zustand `useGameStore` | Single source of truth for all UI components. |
| Belief grid storage | `GameState.belief_grid` (numpy array) | Updated only inside `execute_turn`. |
| Tree logs | `tree_log` lists inside `CBSResult` and `EvalResult` | Sent to frontend; never persisted server-side after the turn. |
| Configuration | [.env.example](.env.example) → `HEIST_GOD_MODE` | Toggles guard/camera detection for testing. |

---

## 9. Cheat-Sheet for the Viva

| Question | One-line answer | Cite |
|----------|-----------------|------|
| Heuristic used by A*? | Manhattan distance — admissible & consistent on a 4-connected grid. | [astar.py L65](backend/algorithms/astar.py) |
| Why "space-time" A*? | CBS produces constraints `(x,y,t)`; node state must include `t`. | [astar.py L27](backend/algorithms/astar.py) |
| What does CBS branch on? | The first detected vertex or edge conflict; one child per involved agent, each with a new `Constraint`. | [cbs.py L87, L236](backend/algorithms/cbs.py) |
| Is CBS optimal? | Yes — it's a best-first search on the constraint tree with admissible costs. | [cbs.py L134](backend/algorithms/cbs.py) |
| How is CSP integrated? | `generate_temporal_constraints` → CBS `extra_constraints` → `validate_dependencies`. | [csp.py L84](backend/algorithms/csp.py) |
| Bayes' rule in code? | `posterior = likelihood * prior; posterior /= posterior.sum()`. | [bayesian.py L102](backend/algorithms/bayesian.py) |
| Why include silent sensors? | They invert the likelihood and let us *eliminate* cells, sharpening the belief. | [bayesian.py L221](backend/algorithms/bayesian.py) |
| How does Minimax use the belief? | `generate_actions` targets the top-N highest-belief cells; `evaluate` rewards covering them. | [minimax.py L91, L165](backend/algorithms/minimax.py) |
| What does alpha-beta prune? | Branches where `alpha >= beta`, i.e. the maximizer can no longer improve via this subtree. | [minimax.py L256](backend/algorithms/minimax.py) |

---

*Generated for evaluation reference — every claim above is grounded in the
files cited; click any link in VS Code to jump straight to the implementation.*
