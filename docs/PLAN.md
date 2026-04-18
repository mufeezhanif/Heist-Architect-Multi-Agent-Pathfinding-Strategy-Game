# HEIST ARCHITECT — Project Plan

## Project Structure

```
heist-architect/
├── frontend/
│   ├── src/
│   │   ├── components/         # React UI (panels, controls, HUD)
│   │   ├── three/              # Three.js 3D scene (building, agents, cameras)
│   │   ├── visualizations/     # CBS tree, Bayesian heatmap, Minimax tree, A* glow
│   │   ├── store/              # Zustand global state
│   │   ├── api/                # WebSocket + REST client to Python backend
│   │   ├── assets/             # 3D models, textures, sounds
│   │   └── App.tsx
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── algorithms/             # ⭐ HAND-WRITTEN — viva-ready, one file per algo
│   │   ├── __init__.py
│   │   ├── astar.py            # A* Search (~150 lines)
│   │   ├── cbs.py              # Conflict-Based Search (~200 lines)
│   │   ├── bayesian.py         # Bayesian Probability Tracker (~150 lines)
│   │   ├── minimax.py          # Minimax + Alpha-Beta Pruning (~150 lines)
│   │   └── csp.py              # Temporal Constraint Checker (~100 lines)
│   ├── game/                   # Game engine (Copilot-assisted)
│   │   ├── engine.py           # Turn loop, win/lose, fog of war
│   │   ├── building.py         # Grid graph, rooms, corridors
│   │   ├── agents.py           # Crew + guard entities, abilities
│   │   └── sensors.py          # Door/motion/camera/sound sensors
│   ├── api/
│   │   ├── routes.py           # FastAPI REST endpoints
│   │   └── websocket.py        # WebSocket for streaming CBS/Bayesian steps
│   ├── main.py                 # FastAPI app entry
│   └── requirements.txt
│
├── docs/                       # Documentation + proposal
└── prompts/                    # Copilot prompts (gitignored)
```

---

## Algorithm Files — Viva Strategy

Each algorithm file follows this structure for maximum viva readability:

```python
"""
MODULE: astar.py
ALGORITHM: A* Search
COURSE TOPIC: Informed Search (Week 5)
COMPLEXITY: O(b^d) time, O(b^d) space
PURPOSE IN GAME: Low-level pathfinder for CBS — finds optimal path
                 for a single agent on the building grid.
"""

# ---- DATA STRUCTURES ----
# (explain: what each class/dict represents)

# ---- HEURISTIC FUNCTION ----
# (explain: why Manhattan distance, admissibility)

# ---- CORE ALGORITHM ----
# (explain: open set, closed set, f = g + h, neighbor expansion)

# ---- CONSTRAINT SUPPORT ----
# (explain: how CBS injects blocked (cell, time) pairs)
```

**During viva, you open the file and walk through these 4 sections.** If the professor asks "modify the heuristic," you change the heuristic function. If they ask "what if you used Euclidean," you swap `abs(dx) + abs(dy)` to `sqrt(dx² + dy²)`.

### What you must be able to explain per file:

| File | Key viva questions to prepare |
|------|-------------------------------|
| `astar.py` | What is f(n)=g(n)+h(n)? Why Manhattan? What's admissibility? How does the open/closed set work? |
| `cbs.py` | What's the constraint tree? How do you detect conflicts? Why branch on both agents? What's optimality guarantee? |
| `bayesian.py` | What's Bayes' theorem? What's prior vs posterior? How do sensor observations update beliefs? What's the movement transition model? |
| `minimax.py` | What's the game tree? What's alpha-beta pruning? What's the evaluation function? How deep do you search? |
| `csp.py` | What's a constraint? How do temporal dependencies translate to CBS constraints? How is backtracking used? |

---

## Phases

### PHASE 1 — Foundation (Days 1–5)

**Goal:** Backend algorithms working + basic frontend rendering a 3D building.

**Features:**
- [ ] Python project scaffolding (FastAPI, folder structure, requirements.txt)
- [ ] `building.py` — Grid graph model: rooms as cell clusters, corridors as edges, doors as transition points. Hardcoded medium building (10-15 rooms, 6-8 corridors)
- [ ] `astar.py` — A* on the building grid. Inputs: start cell, goal cell, set of blocked (cell, time) constraints. Outputs: path as list of (cell, timestep) pairs. Supports wait actions.
- [ ] `cbs.py` — Conflict-Based Search. Inputs: list of (agent, start, goal). Outputs: conflict-free paths for all agents + constraint tree log. Streams each CBS step (plan, conflict, branch, resolve) as JSON events.
- [ ] `csp.py` — Temporal dependency checker. Inputs: dependency list like ("hacker", "alarm_panel", "thief", "vault"). Outputs: additional CBS constraints blocking dependent agents until preconditions met.
- [ ] FastAPI endpoints: `POST /game/create`, `POST /game/plan` (submit waypoints → get CBS solution)
- [ ] React project scaffolding (Vite + TypeScript + Zustand)
- [ ] Three.js scene: fixed isometric camera, ground plane, basic box geometry for rooms/walls, ambient + point lighting (dark cyberpunk with neon edge glow)
- [ ] Render hardcoded building as 3D low-poly geometry (rooms = floor planes, walls = extruded boxes, corridors = connecting paths)
- [ ] Basic agent spheres/capsules placed on the 3D grid

**End of Phase 1 checkpoint:** You can call the backend with 3 agent waypoints, get CBS-resolved paths back, and see 3 colored spheres sitting in a 3D building.

---

### PHASE 2 — Core Game Loop (Days 6–10)

**Goal:** Playable Mastermind turn: set waypoints → CBS plans → agents move.

**Features:**
- [ ] `agents.py` — Crew member entities (Hacker/Thief/Muscle) with movement costs, abilities, positions. Guard entities with patrol waypoints.
- [ ] `sensors.py` — Sensor types (door, motion, camera, sound). Each sensor has a position + trigger radius/cone. Returns observation events per turn.
- [ ] `bayesian.py` — Probability grid tracker. Maintains P(thief_at_cell) for every cell. Update cycle: prior → sensor observations → likelihood → posterior via Bayes' theorem → movement prediction (transition model spreading probability to neighbors).
- [ ] `minimax.py` — Warden AI decision maker. Action space: move guard to cell, rotate camera, deploy sensor, trigger lockdown. Evaluation function: detection probability from Bayesian beliefs × guard coverage - risk of leaving zones open. Alpha-beta pruning, depth 2-3.
- [ ] Game engine turn loop: Planning phase → CBS solve → Execution phase (agents move) → Resolution phase (sensor checks, Bayesian update, win/lose check)
- [ ] Frontend: Click-to-set-waypoint system on 3D map (raycasting from mouse to grid)
- [ ] Frontend: Agent path rendering as glowing neon lines on the 3D grid
- [ ] Frontend: "Execute turn" button → agents animate along paths (smooth lerp movement in 3D)
- [ ] Frontend: Guard entities rendered with patrol route preview lines (red)
- [ ] Frontend: Camera vision cones as semi-transparent 3D cone meshes
- [ ] WebSocket connection: stream CBS solving steps from backend to frontend

**End of Phase 2 checkpoint:** You can play a full turn as Mastermind — set waypoints for 3 crew, see CBS resolve conflicts, watch agents move in 3D, guards patrol, sensors trigger.

---

### PHASE 3 — Visualizations + Warden AI (Days 11–15)

**Goal:** All 4 algorithm visualizations working. AI Warden plays against you. Full PvAI game playable.

**Features:**
- [ ] CBS Constraint Tree panel (React + D3.js or react-flow): Animated tree that grows as CBS runs. Root → conflict detected → branch left/right → resolve → deeper conflicts. Nodes show constraint text, cost. Winning branch glows green, rejected fades gray.
- [ ] A* Frontier Visualization: When CBS runs A* for an agent, the 3D grid cells glow outward from start (blue = open set, dark = closed set, green = final path). Animated expansion over ~2 seconds.
- [ ] Bayesian Heatmap: 3D grid overlay — each cell has a semi-transparent colored plane above it. Color = probability (blue transparent → yellow → red opaque). Updates every turn after sensor resolution. Side panel shows top-5 probability cells with exact values.
- [ ] Minimax Decision Tree panel: Shows Warden AI's evaluated options as a tree. Each node = action ("Move Guard 1 to Corridor B"), leaf = evaluation score. Pruned branches shown as grayed out. Best action highlighted.
- [ ] Warden AI integration: Each turn after Mastermind executes, Warden AI runs minimax, selects best action, executes guard/camera movement. Bayesian heatmap updates. Sensor events collected.
- [ ] Fog of war for Mastermind: Guards visible only when in line-of-sight of a crew member. Last-known positions shown as ghost outlines.
- [ ] Detection system: Guard detects thief if thief is in guard's vision (adjacent + facing direction) for 1 full turn. Camera detects if thief is in cone for 2 consecutive turns. Detection = Warden wins.
- [ ] Turn counter, planning time resource, objective tracker in HUD
- [ ] Dependency chain display: Visual arrows showing "Hacker must do X before Thief can do Y"
- [ ] Heist timeline bar (Gantt-style): Shows all agents' movement schedules for current CBS plan

**End of Phase 3 checkpoint:** Full PvAI game — play as Mastermind against AI Warden. All 4 visualizations operational. Win/lose conditions working.

---

### PHASE 4 — AI vs AI + Landing Page + Polish (Days 16–21)

**Goal:** AI vs AI spectator mode. Cinematic landing page. Sound effects. Deployment-ready.

**Features:**
- [ ] AI Mastermind: Automated waypoint selection — evaluates objective ordering + guard positions, generates waypoints, runs CBS. Simple heuristic: prioritize objectives by proximity, avoid high-Bayesian-probability zones.
- [ ] AI vs AI Spectator mode: Both AIs play automatically. Full map visible (no fog of war). All visualizations active simultaneously. Speed controls (1x, 2x, 4x, pause, step-by-step). Toggle which visualizations are visible.
- [ ] Cinematic landing page: 3D building slowly rotating in background. "HEIST ARCHITECT" title with neon glow animation. Particle effects (floating dust/light). Mode selection buttons: [Play as Mastermind] [Watch AI vs AI]. Cyberpunk aesthetic.
- [ ] Sound effects: CBS conflict detection beep, agent movement footstep, sensor trigger alert, camera rotation whir, heist success/fail stinger, UI click sounds.
- [ ] Polish: Loading states, error handling, smooth transitions between phases, responsive layout.
- [ ] Building variety: 2-3 hardcoded building layouts of increasing complexity.
- [ ] Win/lose screen with heist score breakdown (speed bonus, stealth bonus, CBS efficiency).
- [ ] README.md for GitHub: Project description, screenshots, tech stack, how to run.
- [ ] Deploy: Frontend on Vercel, Backend on Railway/Render.

**End of Phase 4:** Complete, deployed, demo-ready game.

---

## Future Improvements (Post-Submission)

These are **not in scope for the 3-week deadline** but listed for the report and to show project extensibility:

- Player vs AI (Human as Warden) — player controls guards, AI plans heist
- Player vs Player (Local) — split-screen, two humans on same machine
- Campaign mode — 10 progressive missions with increasing difficulty
- Sandbox/Level Editor — player draws custom buildings
- Online multiplayer (WebSocket-based)
- More crew member types (Ghost scout, Demolition expert)
- Multiple building floors connected by stairs/elevators
- Replay system — rewatch completed heists

---

## Resume Bullet Point

```
Heist Architect — Multi-Agent Pathfinding Strategy Game
• Engineered a real-time strategy game around the NP-hard Multi-Agent Pathfinding
  problem, implementing Conflict-Based Search (CBS) with A* as the low-level solver
  for collision-free path coordination of 3+ simultaneous agents
• Built a Bayesian probability tracking system for adversarial AI using Bayes' theorem
  with sensor-driven posterior updates and Hidden Markov movement prediction
• Developed Minimax adversarial search with alpha-beta pruning for AI guard
  repositioning decisions with a multi-factor evaluation function
• Created a 3D cyberpunk game interface using React + Three.js with real-time
  algorithm visualizations: animated CBS constraint trees, A* frontier expansion,
  Bayesian probability heatmaps, and Minimax decision trees
Tech: Python, FastAPI, React, TypeScript, Three.js, D3.js, WebSocket
```

---

## Viva Preparation Checklist

- [ ] Can open `astar.py` and explain every function
- [ ] Can modify A* heuristic live (Manhattan → Euclidean → Diagonal)
- [ ] Can open `cbs.py` and trace through a conflict resolution example
- [ ] Can add a new constraint type to CBS live
- [ ] Can open `bayesian.py` and walk through a Bayes' theorem update with numbers
- [ ] Can change the prior distribution and show how it affects tracking
- [ ] Can open `minimax.py` and explain the evaluation function
- [ ] Can adjust minimax depth and explain the performance tradeoff
- [ ] Can explain why CBS is optimal and what its time complexity is
- [ ] Can explain the difference between MAPF and single-agent pathfinding
- [ ] Can draw the CBS constraint tree for a 3-agent example on whiteboard
