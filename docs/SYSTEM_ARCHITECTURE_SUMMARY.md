# System Architecture Summary

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Zustand Store (State Management)               │ │
│  │  • Game state • Crew • Guards • Paths • Visualizations     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    API Client Layer                         │ │
│  │         REST (setup) + WebSocket (real-time)               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
                    HTTP / WebSocket
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    API Routes Layer                         │ │
│  │    /game/create  /game/plan  /game/execute  /ws/game       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Game Engine                              │ │
│  │  • GameState • Turn execution • Abilities • Alert system   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  AI Algorithms Layer                        │ │
│  │    A* → CBS → CSP → Bayesian → Warden AI                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Game Entities                             │ │
│  │    Building • Crew • Guards • Sensors                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Map

```
USER ACTIONS                FRONTEND                BACKEND                 ALGORITHMS
    │                          │                       │                        │
    │ Click waypoint           │                       │                        │
    ├─────────────────────────>│                       │                        │
    │                          │ setWaypoint()         │                        │
    │                          │ Update store          │                        │
    │                          │                       │                        │
    │ Click "Plan"             │                       │                        │
    ├─────────────────────────>│                       │                        │
    │                          │ sendWS({plan})        │                        │
    │                          ├──────────────────────>│                        │
    │                          │                       │ plan_paths()           │
    │                          │                       ├───────────────────────>│
    │                          │                       │                        │ CSP: Generate constraints
    │                          │                       │                        │ CBS: Plan paths
    │                          │                       │                        │   ├─ A* for agent 1
    │                          │                       │                        │   ├─ A* for agent 2
    │                          │                       │                        │   ├─ Detect conflict
    │                          │                       │                        │   ├─ Branch & resolve
    │                          │                       │                        │   └─ Return paths
    │                          │                       │<───────────────────────┤
    │                          │<──────────────────────┤ Stream CBS events      │
    │                          │ addCBSEvent()         │                        │
    │                          │ Visualize tree        │                        │
    │                          │<──────────────────────┤ plan_complete          │
    │                          │ setPaths()            │                        │
    │                          │ Render paths          │                        │
    │                          │                       │                        │
    │ Click "Execute"          │                       │                        │
    ├─────────────────────────>│                       │                        │
    │                          │ sendWS({execute})     │                        │
    │                          ├──────────────────────>│                        │
    │                          │                       │ execute_turn()         │
    │                          │                       │   ├─ Move agents       │
    │                          │                       │   ├─ Check sensors     │
    │                          │                       │   ├─ Check detections  │
    │                          │                       │   └─ Update alert      │
    │                          │<──────────────────────┤ Stream steps           │
    │                          │ Animate movement      │                        │
    │                          │                       │                        │
    │                          │                       │ Bayesian update        │
    │                          │                       ├───────────────────────>│
    │                          │                       │                        │ Apply Bayes' theorem
    │                          │                       │                        │ Predict movement
    │                          │                       │<───────────────────────┤
    │                          │                       │                        │
    │                          │                       │ Warden AI              │
    │                          │                       ├───────────────────────>│
    │                          │                       │                        │ Find hotspot
    │                          │                       │                        │ Move guard
    │                          │                       │<───────────────────────┤
    │                          │<──────────────────────┤ turn_result            │
    │                          │ Update state          │                        │
    │                          │ Show heatmap          │                        │
    │                          │ Clear paths           │                        │
```

---

## Algorithm Integration Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        PLANNING PHASE                             │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  User Waypoints │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │   CSP Module    │
                    │  Generate       │
                    │  Temporal       │
                    │  Constraints    │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │   CBS Module    │
                    │  High-level     │
                    │  Search         │
                    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
            ┌──────────────┐    ┌──────────────┐
            │  A* Module   │    │  A* Module   │
            │  Agent 1     │    │  Agent 2     │
            │  Path        │    │  Path        │
            └──────────────┘    └──────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ↓
                    ┌─────────────────┐
                    │  CBS Conflict   │
                    │  Detection      │
                    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
            ┌──────────────┐    ┌──────────────┐
            │  Branch 1    │    │  Branch 2    │
            │  Constrain   │    │  Constrain   │
            │  Agent 1     │    │  Agent 2     │
            └──────────────┘    └──────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ↓
                    ┌─────────────────┐
                    │  Solution       │
                    │  Collision-free │
                    │  Paths          │
                    └─────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       EXECUTION PHASE                             │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Move Agents    │
                    │  Along Paths    │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Sensor System  │
                    │  Check All      │
                    │  Sensors        │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Sensor Events  │
                    │  (Observations) │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Bayesian       │
                    │  Module         │
                    │  Update Belief  │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Belief Grid    │
                    │  (Probability   │
                    │   Distribution) │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Warden AI      │
                    │  Find Hotspot   │
                    │  Move Guard     │
                    └─────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Turn Complete  │
                    │  Return to      │
                    │  Planning       │
                    └─────────────────┘
```

---

## Data Structures Overview

### **Frontend (TypeScript)**

```typescript
// Game State (Zustand Store)
interface GameState {
  // Connection
  gameId: string
  connected: boolean
  
  // World
  building: Building  // Grid, cameras, objectives
  crew: Agent[]       // Player's team
  guards: Guard[]     // Enemy team
  
  // Planning
  waypoints: Record<string, [x, y]>  // Where to move
  paths: Record<string, [x, y][]>    // CBS result
  cbsEvents: CBSEvent[]              // Tree visualization
  
  // Execution
  turn: number
  alertLevel: 0 | 1 | 2 | 3
  bayesianHeatmap: Record<string, number>
  
  // Actions
  setWaypoint(agentId, pos)
  setPaths(paths)
  addCBSEvent(event)
  // ... 30+ more actions
}
```

### **Backend (Python)**

```python
# Game State
@dataclass
class GameState:
    game_id: str
    building: Building
    crew: list[CrewMember]
    guards: list[Guard]
    sensors: SensorSystem
    belief: BeliefGrid
    dependencies: list[Dependency]
    
    turn: int
    status: GameStatus  # PLANNING | EXECUTING | WON | LOST
    alert_level: AlertLevel  # GREEN | YELLOW | RED | LOCKDOWN
    current_paths: dict[str, list[tuple[int, int]]]
    event_log: list[str]

# Building
@dataclass
class Building:
    width, height: int
    grid: list[list[Cell]]
    cameras: list[Camera]

# Agents
@dataclass
class CrewMember:
    agent_id: str
    role: CrewRole  # HACKER | THIEF | MUSCLE
    x, y: int
    abilities: list[AbilityType]
    ability_uses: dict[str, int]
    ability_cooldowns: dict[str, int]

@dataclass
class Guard:
    guard_id: str
    x, y: int
    vision_range: int
    patrol_route: list[tuple[int, int]]
    patrol_type: PatrolType  # LINEAR | LOOP | RANDOM
    knocked_out: bool

# Algorithms
@dataclass
class BeliefGrid:
    width, height: int
    grid: np.ndarray  # Probability distribution
    walkable_mask: np.ndarray

@dataclass
class Dependency:
    prereq_agent: str
    prereq_target: tuple[int, int]
    dependent_agent: str
    blocked_cells: list[tuple[int, int]]
```

---

## Message Flow (WebSocket)

### **Frontend → Backend**

```json
// Planning
{
  "action": "plan",
  "waypoints": {
    "hacker": [5, 8],
    "thief": [12, 18],
    "muscle": [10, 10]
  }
}

// Execution
{
  "action": "execute"
}

// Ability
{
  "action": "ability",
  "agent_id": "muscle",
  "ability": "knock_out",
  "target": {"guard_id": "guard_2"}
}
```

### **Backend → Frontend**

```json
// CBS Event (streaming)
{
  "type": "cbs_event",
  "event_type": "cbs_branch",
  "node_id": 5,
  "parent_id": 2,
  "constrained_agent": "hacker",
  "cost": 15.0
}

// Plan Complete
{
  "type": "plan_complete",
  "success": true,
  "paths": {
    "hacker": [[1,1], [2,1], [3,1], ...],
    "thief": [[1,23], [2,23], [3,23], ...]
  },
  "total_cost": 45.0,
  "conflicts_resolved": 2
}

// Step (streaming)
{
  "type": "step",
  "step": 3,
  "crew_positions": {
    "hacker": [4, 1],
    "thief": [4, 23]
  },
  "guard_positions": {
    "guard_1": [18, 7],
    "guard_2": [13, 14]
  },
  "sensor_events": [
    {"sensor_id": "door_5", "event_type": "door_trigger", "pos": [4, 1]}
  ],
  "detections": []
}

// Turn Result
{
  "type": "turn_result",
  "turn": 5,
  "bayesian_heatmap": {
    "4,1": 0.15,
    "5,1": 0.08,
    "4,2": 0.06
  },
  "warden_action": {
    "type": "move_guard",
    "guard_id": "guard_2",
    "from": [13, 14],
    "to": [14, 14],
    "target": [4, 1],
    "target_prob": 0.15
  },
  "score": 850,
  "alert_level": 1,
  "game_status": "planning"
}
```

---

## File Structure

```
heist-architect/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Main component
│   │   ├── store/
│   │   │   └── gameStore.ts           # Zustand state
│   │   ├── api/
│   │   │   ├── client.ts              # REST + WebSocket
│   │   │   └── normalize.ts           # Data transformation
│   │   ├── components/
│   │   │   ├── GameBoard2D.tsx        # Main game view
│   │   │   ├── Controls.tsx           # Plan/Execute buttons
│   │   │   ├── LeftSidebar.tsx        # Crew info
│   │   │   └── RightSidebar.tsx       # Visualizations
│   │   └── visualizations/
│   │       ├── CBSTreePanel.tsx       # CBS tree viz
│   │       └── BayesianPanel.tsx      # Heatmap viz
│   └── package.json
│
├── backend/
│   ├── main.py                        # FastAPI app
│   ├── api/
│   │   ├── routes.py                  # REST endpoints
│   │   └── websocket.py               # WebSocket handler
│   ├── game/
│   │   ├── engine.py                  # Game loop
│   │   ├── building.py                # Grid + cameras
│   │   ├── agents.py                  # Crew + guards
│   │   └── sensors.py                 # Sensor system
│   ├── algorithms/
│   │   ├── astar.py                   # A* search
│   │   ├── cbs.py                     # CBS
│   │   ├── csp.py                     # CSP constraints
│   │   └── bayesian.py                # Bayesian tracker
│   └── requirements.txt
│
└── docs/
    ├── FRONTEND_FLOW.md               # Frontend documentation
    ├── BACKEND_FLOW.md                # Backend documentation
    ├── ALGORITHMS_DETAILED.md         # Algorithm deep dive
    ├── EVALUATION_GUIDE.md            # Study guide
    └── SYSTEM_ARCHITECTURE_SUMMARY.md # This file
```

---

## Technology Stack

### **Frontend**
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management (simpler than Redux)
- **Vite** - Build tool (faster than Webpack)
- **CSS3** - Styling + animations

### **Backend**
- **Python 3.10+** - Language
- **FastAPI** - Web framework
- **WebSocket** - Real-time communication
- **NumPy** - Numerical computations (Bayesian grid)
- **Uvicorn** - ASGI server

### **Algorithms**
- **A*** - Informed search (heapq for priority queue)
- **CBS** - Multi-agent pathfinding (custom implementation)
- **CSP** - Constraint satisfaction (custom implementation)
- **Bayesian** - Probabilistic reasoning (NumPy arrays)

---

## Performance Characteristics

| Component | Typical Time | Bottleneck |
|-----------|-------------|------------|
| Game creation | ~10ms | Building generation |
| A* single path | ~5ms | Grid size (30×25) |
| CBS planning (3 agents) | ~50ms | Conflict resolution |
| Turn execution | ~100ms | Step-by-step animation |
| Bayesian update | ~2ms | Grid operations (NumPy) |
| Warden AI | ~1ms | Simple greedy search |
| WebSocket latency | ~10ms | Network |

**Total planning cycle:** ~100ms (feels instant)
**Total execution cycle:** ~2-3 seconds (animated)

---

## Key Design Decisions

### **Why Zustand over Redux?**
- Simpler API (less boilerplate)
- Better TypeScript support
- Smaller bundle size
- Sufficient for this project's complexity

### **Why WebSocket over polling?**
- Real-time updates (no delay)
- Bidirectional communication
- Efficient (no repeated HTTP overhead)
- Enables streaming (CBS events, execution steps)

### **Why FastAPI over Flask?**
- Native async/await support
- Built-in WebSocket support
- Automatic API documentation
- Type hints with Pydantic

### **Why in-memory storage?**
- Fast access (no database queries)
- Simple implementation
- Suitable for short game sessions
- Easy to add persistence later if needed

### **Why NumPy for Bayesian?**
- Vectorized operations (fast)
- Natural representation (2D grid)
- Efficient memory usage
- Standard library for numerical computing

---

## Scalability Considerations

### **Current Limitations:**
- Games stored in memory (lost on restart)
- Single server (no load balancing)
- No authentication/authorization
- Limited to ~10 concurrent games

### **Potential Improvements:**
- Add Redis for game state persistence
- Add PostgreSQL for user accounts + game history
- Add load balancer for multiple backend instances
- Add rate limiting for API endpoints
- Add game replay system

---

## Testing Strategy

### **Frontend:**
- Manual testing in browser
- React DevTools for state inspection
- Network tab for WebSocket messages

### **Backend:**
- Manual testing with Postman/curl
- Python debugger for algorithm tracing
- Print statements for game flow

### **Algorithms:**
- Unit tests for A* (path correctness)
- Unit tests for CBS (conflict detection)
- Unit tests for Bayesian (probability sums to 1)
- Integration tests for full game flow

---

## Deployment

### **Development:**
```bash
# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173

# Backend
cd backend
pip install -r requirements.txt
python main.py  # http://localhost:8000
```

### **Production:**
- Frontend: Vercel (static hosting)
- Backend: Vercel serverless functions
- WebSocket: Vercel supports WebSocket in serverless

---

## Summary

**Architecture:** Client-server with real-time communication
**Frontend:** React + Zustand + WebSocket client
**Backend:** FastAPI + WebSocket server + AI algorithms
**Algorithms:** A* → CBS → CSP (planning), Bayesian → Warden AI (execution)
**Data Flow:** User input → Frontend → WebSocket → Backend → Algorithms → WebSocket → Frontend → UI update

**Key Strengths:**
- Clean separation of concerns
- Real-time visualization of algorithms
- Optimal pathfinding with CBS
- Intelligent opponent with Bayesian tracking
- Smooth animations with step-by-step execution

**Educational Value:**
- Demonstrates practical AI algorithm integration
- Shows real-world web architecture
- Combines theory (algorithms) with practice (game)
- Visualizes abstract concepts (CBS tree, Bayesian heatmap)
