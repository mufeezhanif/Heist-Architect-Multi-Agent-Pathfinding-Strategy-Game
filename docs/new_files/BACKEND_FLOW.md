# Backend Flow Documentation

## Overview
The backend is a Python FastAPI application that manages game logic, runs AI algorithms, and streams real-time updates via WebSocket.

---

## Architecture Components

### 1. **Main Application**
**File:** `backend/main.py`

**Purpose:** FastAPI app entry point with CORS and routing

**Setup:**
```python
app = FastAPI()
app.add_middleware(CORSMiddleware)  # Allow frontend connections
app.include_router(router, prefix="/game")  # REST endpoints
app.include_router(ws_router)  # WebSocket endpoint
```

**CORS Origins:** Allows localhost:5173 (dev) and Vercel domains (production)

---

### 2. **REST API Routes**
**File:** `backend/api/routes.py`

#### **POST /game/create**
**Purpose:** Initialize new game

**Flow:**
1. Receives `{mode: "pva_mastermind" | "ai_vs_ai"}`
2. Calls `create_game(mode)` from engine
3. Returns `{game_id, building, state}`

**What Happens:**
- Creates 30x25 building grid with rooms, doors, cameras
- Places 3 crew members at entry points
- Places 4 guards with patrol routes
- Initializes Bayesian belief grid (uniform distribution)
- Sets up CSP dependencies (e.g., "hacker must disable alarm before thief enters vault")
- Stores game in memory dict `_games[game_id] = state`

#### **GET /game/{id}/state**
**Purpose:** Fetch current game state

**Returns:**
- Crew positions, health, abilities, cooldowns
- Guard positions, patrol routes, knocked_out status
- Turn number, score, alert level
- Objectives completed
- Event log (last 10 messages)
- Bayesian heatmap (if perspective="warden")

**Perspective Parameter:**
- `mastermind` - Hides guards not visible to crew (fog of war)
- `warden` - Shows Bayesian heatmap
- `spectator` - Shows everything

#### **POST /game/{id}/plan**
**Purpose:** Compute collision-free paths using CBS

**Input:** `{waypoints: {agent_id: [x, y], ...}}`

**Flow:**
1. Extracts start positions from current crew locations
2. Calls `plan_paths(game, waypoints)`
3. Inside `plan_paths()`:
   - Generates CSP temporal constraints
   - Calls `cbs_search()` with building, agents, constraints
   - CBS runs A* for each agent, resolves conflicts
4. Returns `{success, paths, total_cost, conflicts_resolved, tree_log}`

**tree_log:** Array of CBS events for frontend visualization

#### **POST /game/{id}/execute**
**Purpose:** Execute one full turn

**Flow:**
1. Calls `execute_turn(game)`
2. Moves all agents along their planned paths (step-by-step)
3. Checks sensors, detections, objectives at each step
4. Updates Bayesian belief grid with sensor observations
5. Runs Warden AI to respond
6. Returns `{turn, crew_positions, guard_positions, sensor_events, bayesian_heatmap, warden_action, score, alert_level}`

#### **POST /game/{id}/ai-plan**
**Purpose:** AI Mastermind auto-plans (for AI vs AI mode)

**Flow:**
1. Finds uncompleted objectives
2. Assigns nearest objective to each crew member
3. Calls `plan_paths()` with auto-generated waypoints
4. Returns CBS result

---

### 3. **WebSocket Handler**
**File:** `backend/api/websocket.py`

**Endpoint:** `ws://host/ws/game/{gameId}`

**Connection Flow:**
1. Client connects
2. Server sends `{type: "connected", state, god_mode}`
3. Server enters message loop, waits for actions

**Supported Actions:**

#### **action: "plan"**
**Input:** `{action: "plan", waypoints: {...}}`

**Flow:**
1. Calls `plan_paths(game, waypoints)`
2. Streams CBS events: `await _stream_cbs_events(websocket, tree_log)`
   - Sends each CBS tree node as separate message
   - Delay: 0.08s between events for animation
3. Validates CSP dependencies
4. Sends `{type: "plan_complete", paths, algorithms_used}`

**algorithms_used:**
```python
{
  "astar": "A* computed shortest paths for 3 agents",
  "cbs": "CBS resolved 2 conflicts between agents",
  "csp": [{prereq: "hacker", dependent: "thief", satisfied: True}]
}
```

#### **action: "execute"**
**Input:** `{action: "execute"}`

**Flow:**
1. Calls `execute_turn(game)`
2. Streams steps: `await _stream_steps(websocket, result)`
   - Each step = 1 cell movement for all agents
   - Sends `{type: "step", crew_positions, guard_positions, sensor_events, detections}`
   - Delay: 0.25s between steps for smooth animation
3. Sends `{type: "turn_result", bayesian_heatmap, warden_action, score, algorithms_used}`

**Narration Generation:**
- Movement: "Hacker moves to (5, 8)"
- Sensors: "Motion Sensor at (12, 13)"
- Detections: "Guard spotted thief at (15, 18)"
- Objectives: "Objective completed: hack_server"

#### **action: "ability"**
**Input:** `{action: "ability", agent_id, ability, target}`

**Flow:**
1. Calls `use_ability(game, agent_id, ability, target)`
2. Validates: agent alive, ability available, not on cooldown
3. Executes ability logic (see Abilities section)
4. Sends `{type: "ability_result", success, message, crew, guards}`

#### **action: "ai_plan"**
**Input:** `{action: "ai_plan"}`

**Flow:**
1. Calls `ai_mastermind_plan(game)` - auto-generates waypoints
2. Streams CBS events
3. Sends plan_complete

#### **action: "ai_step"**
**Input:** `{action: "ai_step"}`

**Flow:**
1. Calls `ai_mastermind_plan()` - plan
2. Streams CBS events
3. Calls `execute_turn()` - execute
4. Streams steps
5. Sends turn_result

**Used in:** AI vs AI spectator mode for automated gameplay

---

## Game Engine

### **File:** `backend/game/engine.py`

### **GameState Class**
**Purpose:** Complete game state container

**Key Fields:**
- `game_id` - Unique identifier
- `building` - Grid layout
- `crew` - List of CrewMember objects
- `guards` - List of Guard objects
- `sensors` - SensorSystem
- `belief` - BeliefGrid (Bayesian tracker)
- `dependencies` - List of CSP Dependency objects
- `turn` - Current turn number
- `status` - PLANNING | EXECUTING | WON | LOST
- `alert_level` - GREEN | YELLOW | RED | LOCKDOWN
- `current_paths` - CBS result from last plan
- `path_step` - Current step in path execution
- `event_log` - Game narrative messages

### **Game Creation: create_game()**

**Steps:**
1. Generate UUID for game_id
2. Call `create_medium_building()` - creates 30x25 grid
3. Find entry cells (marked 'E' in layout)
4. Call `create_default_crew(entry_positions)` - places hacker, thief, muscle
5. Call `create_default_guards(building)` - places 4 guards with patrols
6. Call `create_default_sensors(building)` - creates door/motion/camera sensors
7. Initialize `BeliefGrid.uniform(building)` - uniform probability distribution
8. Build CSP dependencies:
   ```python
   Dependency(
     prereq_agent="hacker",
     prereq_target=(alarm_x, alarm_y),
     dependent_agent="thief",
     blocked_cells=[(vault_x, vault_y)],
     description="Hacker disables alarm → Thief enters vault"
   )
   ```
9. Apply difficulty preset if mode="pva_mastermind":
   - Reduce guards to 3
   - Lower vision range
   - Remove door sensors
10. Store in `_games` dict
11. Return GameState

### **Path Planning: plan_paths()**

**Input:** `game, waypoints`

**Steps:**
1. Build agents dict: `{agent_id: (start, goal)}`
2. Generate CSP temporal constraints: `generate_temporal_constraints(dependencies)`
   - For each dependency, create CBS vertex constraints
   - Blocks dependent agent from blocked_cells until prereq completes
3. Call `cbs_search(building, agents, extra_constraints)`
4. If success:
   - Store paths in `game.current_paths`
   - Set `game.status = EXECUTING`
   - Reset `game.path_step = 0`
5. Return CBSResult

### **Turn Execution: execute_turn()**

**Purpose:** Execute one full turn with step-by-step movement

**Steps:**

1. **Increment turn counter**
   ```python
   game.turn += 1
   ```

2. **Tick cooldowns**
   - Crew ability cooldowns decrease by 1
   - Building lockdown timers decrease by 1

3. **Decay alert**
   - If no recent detections, suspicion decreases
   - Alert level may drop: LOCKDOWN → RED → YELLOW → GREEN

4. **Determine max steps**
   - Find longest path among all agents
   - `max_steps = max(len(path) for path in paths)`

5. **Execute each step** (loop):
   ```python
   for step in range(max_steps):
       execute_step(game)  # Move everyone 1 cell
   ```

6. **execute_step() details:**
   - Move crew: `crew.x, crew.y = path[path_step]`
   - Move guards: `guard.advance_patrol(building, alert_level)`
   - Check sensors: `sensors.check_all(agent_positions)`
   - Check detections: `_check_detections(game)`
   - Update alert: `_update_alert(game, detections, sensor_events)`
   - Return StepResult with positions, events, detections

7. **Bayesian update**
   - Convert sensor events to Observations
   - Call `bayesian_update(belief, observations)`
   - Call `predict_movement(belief, building)`

8. **Warden AI**
   - Call `_run_warden_ai(game)`
   - Finds highest probability cell in belief grid
   - Moves nearest guard toward that cell
   - Or rotates camera to face it

9. **Check objectives**
   - For each crew member on objective cell:
     - If role matches objective type → complete it
     - Add to `objectives_completed`
     - Award 50 points

10. **Check endgame**
    - If turn >= max_turns → LOST
    - If all crew dead → LOST
    - If all objectives complete + all crew at extraction → WON

11. **Scoring**
    - Subtract points for sensor events
    - Add points for stealth (no detections)

12. **Return to planning**
    - Set `game.status = PLANNING`
    - Clear `current_paths`
    - Reset `path_step = 0`

13. **Return TurnResult**

### **Alert System**

**Suspicion Points:**
- Guard detection: +2
- Camera detection: +1
- Sensor trigger: +0.5

**Alert Levels:**
- 0-2 suspicion → GREEN (normal)
- 3-6 suspicion → YELLOW (investigating)
- 7-11 suspicion → RED (converging)
- 12+ suspicion → LOCKDOWN (next detection = game over)

**Effects:**
- YELLOW: Guards get +1 vision range
- RED: Guards get +2 vision range, move toward last known position
- LOCKDOWN: Guards get +3 vision range, next detection ends game

**Decay:**
- Every turn without detection, suspicion decreases by 1
- Alert level drops when suspicion crosses threshold

### **Abilities**

#### **KNOCK_OUT (Muscle)**
**Range:** Adjacent (1 cell)
**Effect:** Guard knocked out for 6 turns
**Logic:**
```python
for guard in guards:
    if distance(crew, guard) <= 1:
        guard.knocked_out = True
        guard.knocked_out_turns = 6
```

#### **DISABLE_DEVICE (Hacker)**
**Range:** 4 cells
**Effect:** Disables camera OR completes security objective
**Logic:**
```python
# Priority 1: Disable camera
for camera in cameras:
    if distance(crew, camera) <= 4:
        camera.active = False
        
# Priority 2: Complete security objective (alarm/camera)
for cell in adjacent_cells:
    if cell.objective in [DISABLE_ALARM, DISABLE_CAMERA]:
        objectives_completed.append(cell.objective)
        cell.objective = None
```

#### **PICK_LOCK (Thief)**
**Range:** Adjacent (1 cell)
**Effect:** Unlocks door OR steals loot
**Logic:**
```python
# Priority 1: Steal loot
for cell in adjacent_cells:
    if cell.objective == STEAL_LOOT:
        objectives_completed.append("steal_loot")
        
# Priority 2: Unlock door
for cell in adjacent_cells:
    if cell.is_locked:
        cell.is_locked = False
```

#### **SPRINT (Thief)**
**Range:** Self
**Effect:** Move 2 extra steps immediately
**Logic:**
```python
for _ in range(2):
    next_step = path_step + 1
    if next_step < len(path):
        crew.x, crew.y = path[next_step]
        path_step += 1
```

---

## Game Entities

### **Building**
**File:** `backend/game/building.py`

**Grid Layout (30x25):**
- `#` = Wall (not walkable)
- `.` = Floor (walkable)
- `-` = Corridor (walkable)
- `D` = Door (walkable, has sensor)
- `E` = Entry (crew spawn)
- `X` = Extraction (win condition)
- `S` = Hack Server objective
- `L` = Steal Loot objective
- `A` = Disable Alarm objective
- `C` = Disable Camera objective

**Cell Class:**
```python
@dataclass
class Cell:
    x, y: int
    cell_type: CellType
    room_id: str | None
    sensor: SensorType | None
    objective: ObjectiveType | None
    is_locked: bool
    lockdown_turns: int
```

**Camera Class:**
```python
@dataclass
class Camera:
    camera_id: str
    x, y: int
    direction: int  # 0=N, 1=E, 2=S, 3=W
    cone_length: int
    active: bool
```

**Vision Cone Calculation:**
```python
def get_camera_vision(camera):
    dir_vectors = [(0,-1), (1,0), (0,1), (-1,0)]
    dx, dy = dir_vectors[camera.direction]
    perp_dx, perp_dy = -dy, dx  # Perpendicular for cone width
    
    for dist in range(1, cone_length + 1):
        center = (camera.x + dx*dist, camera.y + dy*dist)
        half_width = dist // 2
        for w in range(-half_width, half_width + 1):
            cell = (center.x + perp_dx*w, center.y + perp_dy*w)
            if walkable(cell):
                visible.append(cell)
```

### **Agents**
**File:** `backend/game/agents.py`

**CrewMember:**
```python
@dataclass
class CrewMember:
    agent_id: str
    role: CrewRole  # HACKER | THIEF | MUSCLE
    x, y: int
    movement_speed: int  # tiles per turn
    health: int
    abilities: list[AbilityType]
    ability_uses: dict[str, int]  # remaining uses
    ability_cooldowns: dict[str, int]  # turns until ready
    detected: bool
    alive: bool
```

**Guard:**
```python
@dataclass
class Guard:
    guard_id: str
    x, y: int
    vision_range: int
    patrol_route: list[tuple[int, int]]
    patrol_index: int
    patrol_type: PatrolType  # LINEAR | LOOP | RANDOM
    knocked_out: bool
    knocked_out_turns: int
    alert_bonus_range: int  # extra vision from alert
```

**Patrol Types:**
- **LINEAR:** A→B→C→B→A (ping-pong)
- **LOOP:** A→B→C→A→B→C (circular)
- **RANDOM:** Picks random walkable neighbor each turn

### **Sensors**
**File:** `backend/game/sensors.py`

**Sensor Types:**
1. **Door Sensor**
   - Triggers when agent is ON door cell
   - Generates: DOOR_TRIGGER or DOOR_SILENT

2. **Motion Sensor**
   - Triggers when agent within radius (2 cells)
   - Generates: MOTION_TRIGGER or MOTION_SILENT

3. **Camera**
   - Triggers when agent in vision cone
   - Generates: CAMERA_SPOTTED (with exact position) or CAMERA_CLEAR

4. **Sound Sensor**
   - Triggers on special actions (abilities) within radius
   - Generates: SOUND_HEARD

**SensorEvent:**
```python
@dataclass
class SensorEvent:
    sensor_id: str
    event_type: SensorEventType
    sensor_x, sensor_y: int
    timestep: int
    triggered_by: str | None  # agent_id
    exact_pos: tuple[int, int] | None  # cameras only
```

---

## AI Systems Integration

### **CBS Integration**
**When:** Planning phase
**Input:** Waypoints from player/AI
**Output:** Collision-free paths
**Connection:** `plan_paths()` calls `cbs_search()`, stores result in `game.current_paths`

### **CSP Integration**
**When:** Before CBS planning
**Input:** Game dependencies
**Output:** CBS vertex constraints
**Connection:** `generate_temporal_constraints()` creates constraints, passed to CBS as `extra_constraints`

### **Bayesian Integration**
**When:** After turn execution
**Input:** Sensor events from turn
**Output:** Updated belief grid
**Connection:** `execute_turn()` calls `bayesian_update()`, stores result in `game.belief`

### **Warden AI Integration**
**When:** After Bayesian update
**Input:** Belief grid
**Output:** Guard movement or camera rotation
**Connection:** `_run_warden_ai()` finds max probability cell, moves guard toward it

---

## Data Flow Summary

### **Game Creation:**
```
POST /game/create
  → create_game()
    → create_medium_building()
    → create_default_crew()
    → create_default_guards()
    → create_default_sensors()
    → BeliefGrid.uniform()
    → build dependencies
  → store in _games
  → return {game_id, building, state}
```

### **Planning:**
```
WS {action: "plan", waypoints}
  → plan_paths(game, waypoints)
    → generate_temporal_constraints(dependencies)
    → cbs_search(building, agents, constraints)
      → A* for each agent
      → detect conflicts
      → branch on conflicts
      → repeat until solution
    → return CBSResult
  → stream CBS events to frontend
  → send plan_complete
```

### **Execution:**
```
WS {action: "execute"}
  → execute_turn(game)
    → for each step:
      → move crew along paths
      → move guards on patrols
      → check sensors
      → check detections
      → update alert
      → stream step to frontend
    → bayesian_update(belief, observations)
    → predict_movement(belief)
    → _run_warden_ai(game)
    → check objectives
    → check endgame
  → send turn_result
```

---

## Error Handling

**Game Not Found:**
```python
game = get_game(game_id)
if not game:
    raise HTTPException(404, "Game not found")
```

**Invalid Game State:**
```python
if game.status not in (PLANNING, EXECUTING):
    raise HTTPException(400, f"Game is in {game.status} phase")
```

**Path Planning Failure:**
```python
result = cbs_search(...)
if not result.success:
    return CBSResult(success=False, paths={})
```

**WebSocket Disconnect:**
```python
try:
    while True:
        data = await websocket.receive_json()
        # handle message
except WebSocketDisconnect:
    pass  # cleanup handled by framework
```

---

## God Mode

**Environment Variable:** `HEIST_GOD_MODE=1`

**Effect:** Disables all guard and camera detections

**Implementation:**
```python
GOD_MODE = os.environ.get("HEIST_GOD_MODE", "").lower() in ("1", "true", "yes")

def _check_detections(game):
    if GOD_MODE:
        return []  # No detections ever
    # normal detection logic
```

**Use Case:** Testing, demonstrations, debugging

---

## Summary

**Backend Responsibilities:**
1. Manage game state (crew, guards, building)
2. Run AI algorithms (A*, CBS, CSP, Bayesian)
3. Validate moves and abilities
4. Check win/loss conditions
5. Stream real-time updates to frontend

**Key Technologies:**
- **FastAPI** - Web framework
- **WebSocket** - Real-time communication
- **NumPy** - Bayesian grid calculations
- **Python dataclasses** - Clean data structures

**Performance:**
- Games stored in memory (not persistent)
- CBS limited to 200 iterations
- A* limited to 60 timesteps
- Bayesian grid: O(W×H) per update
