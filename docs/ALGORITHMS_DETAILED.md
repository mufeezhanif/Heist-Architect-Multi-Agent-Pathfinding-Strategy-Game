# Algorithms Detailed Documentation

## Overview
This document explains each AI algorithm used in the game, how they work theoretically, and how they map to the heist scenario.

---

## 1. A* Search (Informed Search)

### **File:** `backend/algorithms/astar.py`

### **What It Does**
Finds the shortest path for a SINGLE agent from start to goal on the grid.

### **How It Works (Theory)**

**Core Concept:** Best-first search using heuristic to guide exploration

**Key Components:**

1. **State Space:** (x, y, t) - position + time
   - Same cell at different times = different states
   - Allows CBS to say "don't be at (5,8) at time 3"

2. **Cost Function:**
   ```
   f(n) = g(n) + h(n)
   where:
   g(n) = actual cost from start to n
   h(n) = estimated cost from n to goal (heuristic)
   ```

3. **Heuristic (Manhattan Distance):**
   ```python
   h(x1, y1, x2, y2) = |x1 - x2| + |y1 - y2|
   ```
   - **Admissible:** Never overestimates (you need at least this many moves)
   - **Consistent:** h(n) ≤ cost(n, n') + h(n') for any neighbor n'
   - **Why it matters:** Guarantees optimal path

4. **Open Set:** Priority queue ordered by f-value
5. **Closed Set:** Already explored states

### **Algorithm Steps (For Viva)**

```
1. Put start node in OPEN with f = 0 + h(start, goal)
2. While OPEN not empty:
   a. Pop node with lowest f-value
   b. If node is goal → reconstruct path, return
   c. Add node to CLOSED
   d. For each neighbor:
      - Calculate g_new = g_current + move_cost
      - Calculate f_new = g_new + h(neighbor, goal)
      - If neighbor not in CLOSED:
        * Create new node with parent pointer
        * Add to OPEN
3. If OPEN empty → no path exists
```

### **Space-Time Variant**

**Why:** CBS needs to constrain agents in time dimension

**Example:**
- Normal A*: "Don't go to cell (5, 8)"
- Space-Time A*: "Don't be at cell (5, 8) at time 3"

**Implementation:**
```python
@dataclass
class SpaceTimeNode:
    x, y, t: int  # position + time
    g, h: float   # costs
    parent: Node  # for path reconstruction
```

**Actions:**
- Move to 4 neighbors (N, E, S, W) → time increases by 1
- Wait in place → time increases by 1, position same

### **Constraints**

**Vertex Constraint:** `(x, y, t)` - can't be at this cell at this time
```python
if (nx, ny, nt) in constraint_set:
    continue  # skip this neighbor
```

**Edge Constraint:** `(x1, y1, x2, y2, t)` - can't move from (x1,y1) to (x2,y2) at time t
```python
if (current.x, current.y, nx, ny, nt) in edge_set:
    continue  # skip this move
```

### **Mapping to Heist**

| A* Concept | Heist Mapping |
|------------|---------------|
| Start | Crew member's current position |
| Goal | Waypoint set by player |
| Obstacles | Walls, locked doors |
| Move cost | 1.0 per cell |
| Wait cost | 1.0 per turn |
| Constraints | CBS-imposed restrictions to avoid collisions |

**Example:**
```
Hacker at (1, 1) wants to reach alarm at (5, 8)
A* explores: (1,1,0) → (2,1,1) → (3,1,2) → ...
Finds path: [(1,1), (2,1), (3,1), (4,1), (5,1), (5,2), ..., (5,8)]
Cost: 11 moves
```

### **Complexity**
- **Time:** O(b^d) where b=branching factor (~4 neighbors), d=depth
- **Space:** O(b^d) - stores all nodes in OPEN/CLOSED
- **Optimality:** Guaranteed if heuristic is admissible

---

## 2. CBS (Conflict-Based Search)

### **File:** `backend/algorithms/cbs.py`

### **What It Does**
Plans collision-free paths for MULTIPLE agents simultaneously.

### **How It Works (Theory)**

**Core Concept:** Two-level search
1. **Low-level:** A* finds path for single agent
2. **High-level:** Resolves conflicts between agents by adding constraints

**Key Insight:** Instead of planning in joint state space (exponential), plan individually and fix conflicts incrementally.

### **Data Structures**

**Conflict:**
```python
@dataclass
class Conflict:
    agent_1, agent_2: str  # which agents collide
    x, y: int              # where
    t: int                 # when
    conflict_type: str     # "vertex" or "edge"
```

**Constraint:**
```python
@dataclass
class Constraint:
    agent_id: str          # who is constrained
    x, y: int              # where they can't be
    t: int                 # when they can't be there
```

**CT Node (Constraint Tree Node):**
```python
@dataclass
class CTNode:
    constraints: list[Constraint]  # accumulated constraints
    paths: dict[str, Path]         # solution for each agent
    cost: float                    # sum of all path costs
```

### **Algorithm Steps (For Viva)**

```
1. ROOT NODE:
   - Run A* for each agent independently (no constraints)
   - Create root CT node with these paths
   - Add to OPEN

2. While OPEN not empty:
   a. Pop CT node with lowest cost
   
   b. DETECT CONFLICT:
      - Check all pairs of agents
      - Find first collision (same cell at same time)
   
   c. If NO CONFLICT:
      - SOLUTION FOUND! Return paths
   
   d. If CONFLICT found between agent_1 and agent_2 at (x,y,t):
      - BRANCH 1: Add constraint for agent_1
        * Create child node with constraint (agent_1, x, y, t)
        * Re-run A* for agent_1 with new constraint
        * If path found, add child to OPEN
      
      - BRANCH 2: Add constraint for agent_2
        * Create child node with constraint (agent_2, x, y, t)
        * Re-run A* for agent_2 with new constraint
        * If path found, add child to OPEN

3. If OPEN empty → no solution exists
```

### **Conflict Types**

**Vertex Conflict:**
- Two agents at same cell at same time
- Example: Hacker at (5,8,3), Thief at (5,8,3)

**Edge Conflict:**
- Two agents swap positions
- Example: Hacker moves (5,8)→(6,8) while Thief moves (6,8)→(5,8) at same time

### **Why It's Optimal**

CBS explores the constraint tree **best-first** by total cost:
- Always expands lowest-cost node
- First solution found has minimum total cost
- Proof: Any unexplored node has cost ≥ solution cost

### **Example Execution**

**Scenario:** 2 agents, both want to cross a narrow corridor

```
Initial paths (root node):
  Hacker: (1,1) → (2,1) → (3,1) → (4,1)
  Thief:  (4,1) → (3,1) → (2,1) → (1,1)

Conflict detected: Both at (3,1) at time 2

Branch 1: Constrain Hacker from (3,1,2)
  Hacker re-plans: (1,1) → (2,1) → (2,2) → (3,2) → (4,1)
  Cost increases: 4 → 5

Branch 2: Constrain Thief from (3,1,2)
  Thief re-plans: (4,1) → (4,2) → (3,2) → (2,1) → (1,1)
  Cost increases: 4 → 5

CBS picks Branch 1 (lower cost), checks for conflicts...
No more conflicts → Solution!
```

### **Tree Log for Visualization**

CBS generates events for frontend animation:

```python
tree_log = [
    {"type": "cbs_root", "node_id": 0, "cost": 8},
    {"type": "cbs_conflict", "agent1": "hacker", "agent2": "thief", 
     "cell": [3,1], "time": 2},
    {"type": "cbs_branch", "node_id": 1, "constrained_agent": "hacker"},
    {"type": "cbs_branch", "node_id": 2, "constrained_agent": "thief"},
    {"type": "cbs_solution", "node_id": 1, "total_cost": 9}
]
```

### **Mapping to Heist**

| CBS Concept | Heist Mapping |
|-------------|---------------|
| Agents | Hacker, Thief, Muscle |
| Conflicts | Crew members colliding |
| Constraints | "Hacker can't be at (5,8) at time 3" |
| Solution | Coordinated paths for entire crew |

**Why It Matters:**
- Player sets waypoints for all crew
- CBS ensures they don't bump into each other
- Finds optimal (shortest total distance) solution

### **Complexity**
- **Worst case:** Exponential (NP-hard problem)
- **Practice:** Very efficient for sparse conflicts
- **Limit:** 200 iterations to prevent infinite loops

---

## 3. CSP (Constraint Satisfaction)

### **File:** `backend/algorithms/csp.py`

### **What It Does**
Enforces temporal ordering: "Agent A must complete task X BEFORE agent B can do task Y"

### **How It Works (Theory)**

**Core Concept:** Constraint propagation

**CSP Components:**
1. **Variables:** Agent arrival times
2. **Domains:** Possible timesteps
3. **Constraints:** Temporal dependencies

### **Dependency Structure**

```python
@dataclass
class Dependency:
    prereq_agent: str              # who must act first
    prereq_target: tuple[int, int] # where they must go
    dependent_agent: str           # who is blocked
    blocked_cells: list[tuple]     # where they can't go yet
    description: str               # human-readable
```

**Example:**
```python
Dependency(
    prereq_agent="hacker",
    prereq_target=(5, 8),  # alarm location
    dependent_agent="thief",
    blocked_cells=[(12, 18), (13, 18)],  # vault cells
    description="Hacker disables alarm → Thief enters vault"
)
```

### **Algorithm Steps (For Viva)**

```
1. CONSTRAINT GENERATION:
   For each dependency:
     - If prereq arrival time known:
       * Block dependent from zone for t=0 to arrival_time
     - If unknown (first iteration):
       * Block dependent from zone for t=0 to max_time/2
   
   Generate CBS vertex constraints:
     For each blocked cell:
       For each blocked timestep:
         Constraint(dependent_agent, cell.x, cell.y, t)

2. PASS TO CBS:
   - CBS receives extra_constraints
   - A* respects these constraints when planning
   - Result: Dependent agent's path avoids blocked zone

3. VALIDATION:
   After CBS solves:
     For each dependency:
       - Find when prereq agent reaches target
       - Check dependent agent doesn't enter zone before that
       - If violated → dependency not satisfied

4. ITERATIVE REFINEMENT (optional):
   Round 1: Conservative blocking → CBS solves → extract arrival times
   Round 2: Use actual arrival times → tighter constraints → CBS re-solves
   Round 3: Validate all dependencies satisfied
```

### **Constraint Propagation**

**Temporal → Spatial:**
- Temporal constraint: "A before B"
- Propagates to: "B can't be at cells C1, C2, C3 until time T"

**Example:**
```
Dependency: Hacker must disable alarm before Thief enters vault

Propagation:
  1. Alarm at (5, 8)
  2. Vault cells: [(12, 18), (13, 18)]
  3. Generate constraints:
     - Constraint(thief, 12, 18, 0)
     - Constraint(thief, 12, 18, 1)
     - Constraint(thief, 12, 18, 2)
     - ... until hacker reaches (5, 8)
```

### **Integration with CBS**

```python
def plan_paths(game, waypoints):
    # 1. Generate CSP constraints
    constraints = generate_temporal_constraints(game.dependencies)
    
    # 2. Pass to CBS
    result = cbs_search(building, agents, extra_constraints=constraints)
    
    # 3. Validate
    satisfied = validate_dependencies(game.dependencies, result.paths)
    
    return result
```

### **Mapping to Heist**

| CSP Concept | Heist Mapping |
|-------------|---------------|
| Variables | Agent arrival times at objectives |
| Constraints | Mission requirements (alarm before vault) |
| Propagation | Blocking vault cells until alarm disabled |
| Validation | Checking if plan satisfies mission logic |

**Real Example:**
```
Mission: Steal diamond from vault
Constraint: Alarm must be disabled first

Without CSP:
  - Thief plans path directly to vault
  - Alarm triggers when entering
  - Mission fails

With CSP:
  - Vault cells blocked for Thief until Hacker reaches alarm
  - CBS forces Thief to wait or take alternate route
  - Hacker disables alarm first
  - Thief then enters vault safely
```

### **Complexity**
- **Constraint generation:** O(n × d) where n=agents, d=dependencies
- **Validation:** O(n × d × path_length)
- **Impact on CBS:** Adds constraints, may increase search time

---

## 4. Bayesian Probability Tracker

### **File:** `backend/algorithms/bayesian.py`

### **What It Does**
Maintains a probability distribution over the grid estimating where thieves are, updated using sensor observations.

### **How It Works (Theory)**

**Core Concept:** Bayes' Theorem for belief update

### **Bayes' Theorem**

```
P(thief at cell | observation) = 
    P(observation | thief at cell) × P(thief at cell)
    ───────────────────────────────────────────────────
                  P(observation)

Where:
  P(thief at cell)              = PRIOR (current belief)
  P(observation | thief at cell) = LIKELIHOOD (sensor model)
  P(observation)                = EVIDENCE (normalizing constant)
  Result                        = POSTERIOR (updated belief)
```

**In Plain English:**
- **Prior:** What we believed before seeing the sensor
- **Likelihood:** How likely is this sensor reading if thief is at this cell?
- **Posterior:** What we believe after seeing the sensor

### **Data Structure**

```python
@dataclass
class BeliefGrid:
    width, height: int
    grid: np.ndarray  # shape (height, width), dtype float64
    walkable_mask: np.ndarray  # which cells are valid
```

**Properties:**
- Each cell holds probability: 0.0 to 1.0
- Sum of all cells ≈ 1.0 (probability distribution)
- Only walkable cells have non-zero probability

### **Initialization**

```python
def uniform(building):
    # Equal probability for all walkable cells
    n_walkable = count_walkable_cells(building)
    for each walkable cell:
        grid[y, x] = 1.0 / n_walkable
```

### **Update Algorithm (For Viva)**

```
1. START with prior belief grid

2. For each observation:
   a. COMPUTE LIKELIHOOD:
      - For every cell in grid:
        * Calculate P(observation | thief at this cell)
        * Use sensor model (see below)
   
   b. APPLY BAYES:
      - posterior[cell] = likelihood[cell] × prior[cell]
   
   c. NORMALIZE:
      - total = sum(posterior)
      - posterior = posterior / total
      - (This computes P(observation) implicitly)
   
   d. UPDATE:
      - prior = posterior (for next observation)

3. RETURN updated belief grid
```

### **Sensor Models (Likelihood Functions)**

**Door Trigger:**
```python
if distance(cell, door) == 0:
    likelihood = 0.95  # very likely thief is AT door
elif distance(cell, door) <= 2:
    likelihood = 0.4   # somewhat likely nearby
else:
    likelihood = 0.05  # unlikely far away
```

**Motion Trigger:**
```python
if distance(cell, sensor) <= radius:
    likelihood = 0.7   # likely within radius
else:
    likelihood = 0.1   # unlikely outside
```

**Camera Spotted:**
```python
if cell == exact_position:
    likelihood = 0.99  # almost certain (camera gives exact pos)
else:
    likelihood = 0.01  # very unlikely elsewhere
```

**Door Silent (INVERSE):**
```python
if distance(cell, door) == 0:
    likelihood = 0.05  # unlikely AT door (it would have triggered)
elif distance(cell, door) <= 2:
    likelihood = 0.3   # somewhat unlikely nearby
else:
    likelihood = 0.8   # likely far away
```

**Key Insight:** Silent sensors SPREAD probability away from sensor location.

### **Movement Prediction**

**Purpose:** Predict where thief will be NEXT turn

**Transition Model:**
```python
P(cell_next) = stay_prob × P(cell_current)
             + move_prob × Σ P(neighbor_current) / num_neighbors

where:
  stay_prob = 0.3  # 30% chance thief stays put
  move_prob = 0.7  # 70% chance thief moves
```

**Algorithm:**
```
1. Create empty predicted grid

2. For each cell with probability > 0:
   a. STAY component:
      - predicted[cell] += 0.3 × belief[cell]
   
   b. MOVE component:
      - For each neighbor of cell:
        * predicted[neighbor] += (0.7 × belief[cell]) / num_neighbors

3. NORMALIZE predicted grid

4. RETURN predicted belief
```

**Why It Matters:** Accounts for thief movement between observations.

### **Example Execution**

**Initial State:**
```
Uniform belief: All 500 walkable cells have probability 0.002
```

**Turn 1: Door sensor triggers at (5, 8)**
```
Likelihood calculation:
  Cell (5, 8):   0.95
  Cell (5, 7):   0.4
  Cell (6, 8):   0.4
  Cell (10, 10): 0.05
  ...

Bayes update:
  posterior(5, 8) = 0.95 × 0.002 = 0.0019
  posterior(5, 7) = 0.4 × 0.002 = 0.0008
  ...

After normalization:
  Cell (5, 8):   0.15  (15% probability)
  Cell (5, 7):   0.06
  Cell (6, 8):   0.06
  Others:        ~0.001 each
```

**Turn 2: Motion sensor silent at (12, 13)**
```
Likelihood (inverse):
  Cells near (12, 13): 0.15 (unlikely)
  Cells far from (12, 13): 0.7 (likely)

Bayes update:
  Probability DECREASES near (12, 13)
  Probability INCREASES elsewhere
```

**Turn 3: Camera spots thief at (15, 18)**
```
Likelihood:
  Cell (15, 18): 0.99
  All others:    0.01

Bayes update:
  posterior(15, 18) ≈ 0.95 (95% certain)
  All others:       ≈ 0.0001
```

### **Mapping to Heist**

| Bayesian Concept | Heist Mapping |
|------------------|---------------|
| Belief grid | Warden's suspicion map |
| Prior | What Warden believed last turn |
| Observations | Sensor triggers/silences |
| Likelihood | Sensor reliability model |
| Posterior | Updated suspicion after sensors |
| Prediction | Where Warden thinks thieves will move |

**Warden's Perspective:**
- "I don't know where thieves are exactly"
- "But sensors give me clues"
- "I update my belief using Bayes' theorem"
- "I move guards toward highest probability cells"

### **Complexity**
- **Update:** O(W × H) per observation, where W×H = grid size
- **Prediction:** O(W × H × avg_neighbors) ≈ O(W × H)
- **Total per turn:** O(W × H × num_observations)
- **For 30×25 grid:** ~750 operations per observation (very fast)

---

## 5. Warden AI (Heuristic Response)

### **File:** `backend/game/engine.py` (function `_run_warden_ai`)

### **What It Does**
Warden responds to Bayesian belief by moving guards or rotating cameras toward high-suspicion areas.

### **How It Works**

**Not a formal algorithm, but a heuristic policy:**

### **Algorithm Steps (For Viva)**

```
1. FIND HOTSPOT:
   - Scan entire belief grid
   - Find cell with highest probability
   - target_cell = argmax(belief.grid)

2. MOVE GUARD (if possible):
   - Find guard closest to target_cell
   - Calculate best next step toward target:
     * For each neighbor of guard:
       - Calculate distance to target
       - Pick neighbor that reduces distance most
   - Move guard to that neighbor
   - Return action: {type: "move_guard", from, to, target}

3. ROTATE CAMERA (if no guard can improve):
   - Find camera closest to target_cell
   - Calculate desired direction:
     * If |dx| >= |dy|: face East or West
     * Else: face North or South
   - Rotate camera to face target
   - Return action: {type: "rotate_camera", from, to, target}

4. HOLD (if nothing can improve):
   - Return action: {type: "hold", target}
```

### **Example Execution**

**Scenario:** Bayesian belief shows 40% probability at (15, 18)

```
Belief grid (excerpt):
  (15, 18): 0.40  ← HOTSPOT
  (14, 18): 0.08
  (16, 18): 0.08
  (15, 17): 0.06
  ...

Guards:
  guard_1 at (18, 7)  - distance 14
  guard_2 at (13, 13) - distance 7  ← CLOSEST
  guard_3 at (15, 18) - distance 0  (already there!)
  guard_4 at (22, 16) - distance 9

Warden decision:
  - guard_3 already at hotspot → can't improve
  - guard_2 is next closest
  - guard_2 neighbors: (13, 12), (14, 13), (13, 14), (12, 13)
  - Best neighbor: (14, 13) - reduces distance to 6
  - Move guard_2: (13, 13) → (14, 13)

Action returned:
  {
    type: "move_guard",
    guard_id: "guard_2",
    from: [13, 13],
    to: [14, 13],
    target: [15, 18],
    target_prob: 0.40,
    reason: "Moved nearest guard toward highest-suspicion tile"
  }
```

### **Why It's Effective**

**Emergent Behavior:**
- Guards naturally converge on thief locations
- Cameras rotate to cover suspicious areas
- Creates dynamic, responsive opposition

**Explainable:**
- Player can see Warden's reasoning
- "Moved guard toward 40% probability cell"
- Feels intelligent without complex ML

### **Mapping to Heist**

| Warden AI Concept | Heist Mapping |
|-------------------|---------------|
| Hotspot | Most likely thief location |
| Guard movement | Tactical response |
| Camera rotation | Surveillance adjustment |
| Greedy policy | Simple but effective |

---

## Algorithm Integration Flow

### **Complete Turn Cycle:**

```
1. PLANNING PHASE:
   User sets waypoints
     ↓
   CSP generates temporal constraints
     ↓
   CBS plans collision-free paths
     ├─ A* finds path for each agent
     ├─ Detects conflicts
     ├─ Branches on conflicts
     └─ Returns optimal solution
     ↓
   Paths sent to frontend

2. EXECUTION PHASE:
   Agents move along paths
     ↓
   Sensors check for triggers
     ↓
   Bayesian update:
     ├─ Convert sensor events to observations
     ├─ Apply Bayes' theorem for each observation
     ├─ Predict movement
     └─ Return updated belief grid
     ↓
   Warden AI:
     ├─ Find highest probability cell
     ├─ Move guard toward it
     └─ Return action
     ↓
   Turn result sent to frontend
```

### **Algorithm Dependencies:**

```
CBS depends on A*
  └─ CBS calls A* for each agent
  └─ CBS adds constraints, A* respects them

CBS integrates with CSP
  └─ CSP generates constraints
  └─ CBS receives them as extra_constraints

Bayesian independent
  └─ Runs after execution
  └─ Doesn't affect pathfinding

Warden AI depends on Bayesian
  └─ Uses belief grid to make decisions
```

---

## Complexity Summary

| Algorithm | Time Complexity | Space Complexity | Optimality |
|-----------|----------------|------------------|------------|
| A* | O(b^d) | O(b^d) | Optimal (with admissible h) |
| CBS | Exponential worst-case | O(agents × constraints) | Optimal |
| CSP | O(n × d) | O(constraints) | N/A (constraint generation) |
| Bayesian | O(W × H × obs) | O(W × H) | N/A (belief update) |
| Warden AI | O(guards + cameras) | O(1) | Greedy (not optimal) |

**Where:**
- b = branching factor (~4 for grid)
- d = depth (path length)
- n = number of agents
- d = number of dependencies
- W × H = grid dimensions (30 × 25 = 750)
- obs = observations per turn (~10-20)

---

## Key Takeaways for Evaluation

### **A***
- "Finds shortest path for single agent using heuristic"
- "Manhattan distance is admissible and consistent"
- "Space-time variant allows CBS to constrain agents in time"

### **CBS**
- "Plans collision-free paths for multiple agents"
- "Two-level search: A* for individuals, conflict resolution for coordination"
- "Optimal solution guaranteed by best-first exploration"

### **CSP**
- "Enforces temporal ordering between agents"
- "Propagates temporal constraints to spatial domain"
- "Ensures mission logic (alarm before vault)"

### **Bayesian**
- "Maintains probability distribution over grid"
- "Updates belief using Bayes' theorem and sensor observations"
- "Predicts movement using transition model"

### **Warden AI**
- "Greedy heuristic policy based on Bayesian belief"
- "Moves guards toward highest probability cells"
- "Simple but effective and explainable"

---

## Example Viva Questions & Answers

**Q: Why use A* instead of Dijkstra?**
A: A* uses heuristic to guide search toward goal, exploring fewer nodes. Dijkstra explores uniformly in all directions. For grid pathfinding, A* is much faster.

**Q: How does CBS guarantee optimality?**
A: CBS explores constraint tree best-first by total cost. First solution found has minimum cost because all unexplored nodes have cost ≥ solution cost.

**Q: What if CSP constraints make problem unsolvable?**
A: CBS will fail to find paths. Frontend shows "No valid path found". Player must adjust waypoints or complete prerequisites first.

**Q: Why use Bayesian instead of just tracking exact positions?**
A: Warden doesn't have perfect information (fog of war). Sensors give probabilistic clues. Bayesian reasoning handles uncertainty mathematically.

**Q: Is Warden AI optimal?**
A: No, it's a greedy heuristic. Optimal would require game tree search (minimax), which is too expensive. Greedy is fast and good enough for gameplay.
