# Frontend Flow Documentation

## Overview
The frontend is a React + TypeScript application using Zustand for state management and WebSocket for real-time communication with the backend.

---

## Architecture Components

### 1. **State Management (Zustand Store)**
**File:** `frontend/src/store/gameStore.ts`

**Purpose:** Single source of truth for all game state

**Key State Variables:**
- `screen`: "landing" | "game" - Controls which screen is shown
- `gameMode`: "pvai" | "spectator" - Player vs AI or AI vs AI
- `building`: Grid layout with walls, floors, doors, cameras
- `crew`: Array of player's agents (hacker, thief, muscle)
- `guards`: Array of enemy guards with patrol routes
- `waypoints`: Where each agent should move (set by clicking)
- `paths`: CBS-computed collision-free paths for all agents
- `cbsEvents`: Tree visualization events from CBS algorithm
- `bayesianHeatmap`: Probability grid showing where Warden thinks thieves are
- `alertLevel`: 0=green, 1=yellow, 2=red, 3=lockdown
- `executionMode`: Controls step-by-step animation playback

**Example State Update Flow:**
```
User clicks cell → setWaypoint() → waypoints updated → 
UI shows marker → User clicks "Plan" → API call → 
CBS runs → paths received → setPaths() → UI shows paths
```

---

### 2. **API Client (REST + WebSocket)**
**File:** `frontend/src/api/client.ts`

#### REST Endpoints (Initial Setup):
- `POST /game/create` - Creates new game, returns gameId + building
- `GET /game/{id}/state` - Fetches current game state
- `GET /game/{id}/building` - Fetches building layout

#### WebSocket Connection:
**URL:** `ws://host/ws/game/{gameId}`

**Message Types Received:**

1. **connected** - Initial handshake
   - Receives: Full game state, crew, guards, event log
   - Updates: Store with initial data

2. **cbs_event** - CBS tree node created/explored
   - Receives: Node ID, parent, constraints, cost
   - Updates: Adds to `cbsEvents` array for tree visualization
   - Example: `{type: "cbs_branch", node_id: 5, constrained_agent: "hacker"}`

3. **plan_complete** - CBS finished computing paths
   - Receives: `paths` (dict of agent → waypoint list), `total_cost`, `conflicts_resolved`
   - Updates: `setPaths()`, clears planning flag
   - Triggers: Path rendering on game board

4. **step** - Single movement step during execution
   - Receives: Updated positions for crew/guards, sensor events, detections
   - Updates: Animates agents moving one cell
   - Frequency: Multiple per turn (one per movement step)

5. **turn_result** - Full turn completed
   - Receives: Final positions, Bayesian heatmap, Warden action, score, alert level
   - Updates: All game state, clears paths/waypoints for next planning phase
   - Triggers: Return to planning mode

6. **ability_result** - Ability used (knock out, hack, etc.)
   - Receives: Success status, updated crew/guard states
   - Updates: Agent abilities, cooldowns, guard knocked_out status

**Message Types Sent:**
- `{action: "plan", waypoints: {...}}` - Request path planning
- `{action: "execute"}` - Execute planned paths
- `{action: "ability", agent_id, ability, target}` - Use agent ability
- `{action: "ai_plan"}` - AI Mastermind auto-plans (spectator mode)
- `{action: "ai_step"}` - AI plans + executes in one action

---

### 3. **Main App Component**
**File:** `frontend/src/App.tsx`

**Render Logic:**
```
if (screen === "landing") → Show LandingPage
else → Show Game Layout:
  ├─ LeftSidebar (crew info, abilities)
  ├─ GameBoard2D (main maze view)
  ├─ Controls (plan/execute buttons)
  ├─ RightSidebar (visualizations, logs)
  └─ Overlays (tutorial, help, game over)
```

**Component Hierarchy:**
```
App
├─ LandingPage (mode selection)
└─ Game Screen
   ├─ LeftSidebar
   │  ├─ Crew member cards
   │  └─ Ability buttons
   ├─ GameBoard2D
   │  ├─ Grid cells (walls, floors, doors)
   │  ├─ Cameras with vision cones
   │  ├─ Crew agents (clickable)
   │  ├─ Guards with vision radius
   │  ├─ Waypoint markers
   │  ├─ Path lines (CBS result)
   │  └─ Bayesian heatmap overlay
   ├─ Controls
   │  ├─ Plan button
   │  ├─ Execute button
   │  └─ Speed controls
   └─ RightSidebar
      ├─ CBSTreePanel (algorithm viz)
      ├─ BayesianPanel (heatmap)
      ├─ SensorLog (events)
      └─ NarrationPanel (story text)
```

---

## User Interaction Flow

### **Planning Phase:**

1. **Select Agent**
   - User clicks crew member on board
   - `setSelectedAgent(agentId)` called
   - Agent highlights, cursor changes

2. **Set Waypoint**
   - User clicks destination cell
   - `setWaypoint(agentId, [x, y])` called
   - Marker appears on board
   - Repeat for other agents

3. **Request Plan**
   - User clicks "Plan Paths" button
   - `sendWS({action: "plan", waypoints})` sent
   - `setPlanning(true)` shows loading state

4. **Receive CBS Events** (real-time)
   - Backend streams CBS tree exploration
   - Each `cbs_event` message → `addCBSEvent()`
   - Tree visualization updates live
   - Shows: root node, conflicts found, branches created

5. **Plan Complete**
   - `plan_complete` message received
   - `setPaths(result.paths)` stores paths
   - Paths drawn as colored lines on board
   - Algorithm info shown: "A* computed paths, CBS resolved 3 conflicts"

### **Execution Phase:**

1. **Start Execution**
   - User clicks "Execute Turn" button
   - `sendWS({action: "execute"})` sent
   - `setExecutionMode("playing")` starts animation

2. **Receive Steps** (animated)
   - Backend sends multiple `step` messages
   - Each step: agents move 1 cell along path
   - `setCrew()` updates positions → CSS transitions animate movement
   - Sensor events shown as icons
   - Detections trigger alert messages

3. **Turn Complete**
   - `turn_result` message received
   - Bayesian heatmap updated (shows Warden's belief)
   - Warden action narrated: "Moved guard_2 toward high-suspicion tile"
   - Score, alert level, objectives updated
   - Paths cleared → back to planning phase

### **Ability Usage:**

1. User clicks ability button (e.g., "Knock Out")
2. Cursor changes to target mode
3. User clicks target (guard/camera/door)
4. `sendWS({action: "ability", agent_id, ability, target})` sent
5. `ability_result` received → updates state
6. Cooldown timer starts, uses decremented

---

## Data Normalization

**File:** `frontend/src/api/normalize.ts`

**Purpose:** Backend sends `{x, y}` but frontend uses `pos: [x, y]`

**Functions:**
- `normalizeAgent(crew)` - Converts `{x, y}` → `pos: [x, y]`
- `normalizeGuard(guard)` - Same for guards

**Why:** Consistent data structure across frontend components

---

## Visualization Components

### **GameBoard2D**
**Renders:**
- Grid cells with colors (wall=black, floor=gray, door=brown)
- Cameras with rotating vision cones
- Crew agents as colored circles with role icons
- Guards as red circles with vision radius
- Waypoint markers as flags
- CBS paths as bezier curves
- Bayesian heatmap as red overlay (opacity = probability)

**Click Handlers:**
- Cell click → Set waypoint if agent selected
- Agent click → Select agent
- Guard click → Target for ability

### **CBSTreePanel**
**Renders:** Tree diagram of CBS search
- Root node at top
- Branches for each conflict resolution
- Node colors: green=solution, yellow=exploring, red=failed
- Shows: cost, constrained agent, conflict location

### **BayesianPanel**
**Renders:** Heatmap legend + top probability cells
- Color scale: blue (low) → red (high)
- Lists top 5 cells with probabilities
- Updates every turn after Bayesian update

---

## Animation System

**Execution Modes:**
- `idle` - Not executing
- `playing` - Auto-playing steps with delay
- `stepping` - Manual step-by-step
- `paused` - Paused mid-execution
- `done` - Execution finished

**Step Queue:**
- Backend sends steps faster than animation
- `stepQueue` buffers messages
- `popStepFromQueue()` processes one at a time
- Ensures smooth animation at controlled speed

**Speed Control:**
- `aiSpeed` slider: 0.5x to 3x
- Adjusts delay between steps
- Formula: `delay = 250ms / aiSpeed`

---

## Key Frontend-Backend Interactions

### **Game Creation:**
```
Frontend                          Backend
   |                                 |
   |-- POST /game/create ----------->|
   |                                 | Creates GameState
   |<-- {gameId, building, state} ---|
   |                                 |
   | setGameId(id)                   |
   | setBuilding(building)           |
   | connectWebSocket(id)            |
   |                                 |
   |-- WS connect ------------------>|
   |<-- {type: "connected"} ---------|
```

### **Planning:**
```
Frontend                          Backend
   |                                 |
   | User sets waypoints             |
   |-- {action: "plan"} ------------>|
   |                                 | Runs CBS algorithm
   |<-- {type: "cbs_event"} ---------|  (multiple)
   |<-- {type: "cbs_event"} ---------|
   |<-- {type: "plan_complete"} -----|
   |                                 |
   | Renders paths on board          |
```

### **Execution:**
```
Frontend                          Backend
   |                                 |
   |-- {action: "execute"} --------->|
   |                                 | Moves agents step-by-step
   |<-- {type: "step"} --------------|  (multiple)
   |<-- {type: "step"} --------------|
   |<-- {type: "turn_result"} -------|
   |                                 |
   | Animates movement               |
   | Updates Bayesian heatmap        |
   | Clears paths for next turn      |
```

---

## Error Handling

**Connection Loss:**
- `ws.onclose` → `setConnected(false)`
- UI shows "Disconnected" banner
- Retry button available

**Invalid Actions:**
- Backend sends error in message
- Frontend shows toast notification
- State remains unchanged

**Path Planning Failure:**
- `plan_complete` with `success: false`
- UI shows "No valid path found"
- Waypoints remain, user can adjust

---

## Performance Optimizations

1. **Zustand Selectors:** Components subscribe only to needed state slices
   ```typescript
   const crew = useGameStore(s => s.crew)  // Only re-renders when crew changes
   ```

2. **CSS Transitions:** Agent movement uses CSS `transition` instead of JS animation
   ```css
   .agent { transition: transform 0.25s ease-in-out; }
   ```

3. **Memoization:** Large components use `React.memo()` to prevent unnecessary re-renders

4. **WebSocket Batching:** Multiple CBS events processed in single render cycle

---

## Summary

**Frontend Flow:**
1. User creates game → REST API → Receives building + gameId
2. WebSocket connects → Receives initial state
3. User sets waypoints → Sends plan request → Receives CBS events + paths
4. User executes → Receives step-by-step updates → Animates movement
5. Turn completes → Bayesian update shown → Back to planning

**Key Technologies:**
- **React** - UI components
- **Zustand** - State management (simpler than Redux)
- **WebSocket** - Real-time bidirectional communication
- **CSS Transitions** - Smooth animations
- **TypeScript** - Type safety

**Data Flow:**
```
User Input → Zustand Store → WebSocket → Backend
Backend → WebSocket → Zustand Store → React Components → UI Update
```
