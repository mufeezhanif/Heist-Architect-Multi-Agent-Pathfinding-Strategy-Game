# Heist Architect — Project Report

*Artificial Intelligence · Section 6J*

**Group:** Muhammad Mufeez (23K-0800), Rank 1st (23K-3033), Hassan Mustafa (23K-0817)

---

## 1. Problem statement

Multi-Agent Pathfinding (MAPF) asks: given a shared environment and *k* agents
with individual start/goal cells, produce a set of paths that get every agent
to its goal without collisions. MAPF is NP-hard in the joint formulation but
admits effective search-based solvers like Conflict-Based Search (CBS).

We frame MAPF as a two-player game. The **Mastermind** plays MAPF; the
**Warden** plays adversarial search over sensor information. The game makes
four textbook AI techniques visible, interactive, and debuggable.

## 2. Implemented techniques

### 2.1 A* with time-indexed constraints

We use space-time A* on a 4-connected grid. The state is `(cell, t)` and the
action set is `{↑, ↓, ←, →, wait}`. Manhattan distance is the heuristic; it is
admissible and consistent on this action set, so A* is optimal.

CBS injects two kinds of constraints into A*:
- vertex: `("vertex", agent, cell, t)`
- edge (swap): `("edge", agent, a, b, t)`

The goal test requires the agent to reach the goal *and* remain there past any
future constraint on the goal cell, ensuring CBS solutions are feasible when
padded. See [`backend/app/ai/astar.py`](../backend/app/ai/astar.py).

### 2.2 Conflict-Based Search (CBS)

We implement the classic two-level CBS (Sharon et al., 2015). The high level
best-first-searches a constraint tree whose nodes carry (constraints,
solution). The first conflict (vertex or edge) is located and two children are
produced, each adding one resolving constraint. A* (above) replans the
affected agent's path under the accumulated constraints. We cap `max_nodes`
to 500 to keep responses snappy.

Conflicts encountered during search are surfaced to the UI as a timeline
([`App.jsx`](../frontend/src/App.jsx)), making the search observable rather
than hidden.

### 2.3 Bayesian belief tracking

Each thief owns an `R×C` belief grid. Each turn we perform a **predict**
step (uniform random walk over walkable neighbours ∪ stay) followed by an
**update** step that multiplies by the sensor likelihood and renormalises:

$$P_{t+1}(c\mid o) \;\propto\; P(o\mid c)\sum_{c' \in N(c)} \frac{P_t(c')}{|N(c')|+1}$$

Each camera contributes a binary observation with `detect_prob = 0.9` inside
its line-of-sight cone and `false_pos = 0.05` elsewhere. Motion sensors use
a Manhattan-radius coverage mask with `detect_prob = 0.6`. Guards acting as
"perfect" sensors collapse the belief to a Dirac spike when line-of-sight is
obtained. See [`backend/app/ai/bayes.py`](../backend/app/ai/bayes.py).

### 2.4 Minimax Warden AI (α-β)

The Warden runs a depth-2 minimax over joint guard moves (one ply) followed
by a belief-diffusion adversary ply. α-β pruning and a branching cap
(400 joint moves) keep it responsive on a 15×15 board with 2 guards.

Heuristic:

$$h(\text{guards}, B) \;=\; -\!\!\sum_{g} \min_{c \in \text{top-}k(B)} d_1(g, c) \;+\; 10 \!\!\sum_{g}\!\!\sum_{c \in V_3(g) \cap \text{top-}k(B)} B(c)$$

where $d_1$ is Manhattan distance and $V_3(g)$ the 3-cell Manhattan
neighbourhood. The resulting candidate list is rendered in the right panel
so reviewers can see why a move was chosen.

## 3. Game rules

- Map: 15×15, 4 cameras at chokepoints, 2 motion sensors beside the vault.
- Thieves: 3, spawn top-left / mid-left / bottom-left.
- Guards: 2, spawn bottom corridor.
- Objective (Mastermind): get any **2 of 3** thieves to an exit cell after
  touching the *vault zone* (the vault + its 4 neighbours) to pick up loot.
- Warden wins if at most one thief escapes, or after 120 turns.

## 4. Modes of play

1. **AI vs AI** — auto-demo loop streams turns over WebSocket.
2. **Human Mastermind** — click cells to set goals for each thief; `Commit`
   invokes CBS to produce conflict-free paths.
3. **Human Warden** — click adjacent cells to move the selected guard.
4. **Hotseat** — both roles played on the same keyboard.

## 5. Frontend design

React provides the HUD and control panel; Phaser 3 renders the board as a
stack of layers (tiles → heat-map → camera cones → A*/CBS overlays → agents
→ labels) so the UI reads like a diagram of the AI internals.

Vite proxies `/api` and `/ws` to FastAPI on port 8000 so the app runs on a
single origin at `http://localhost:5173`.

## 6. Results

- **A\*** expands ≤ 30 nodes for typical thief→vault queries.
- **CBS** resolves all initial 3-thief plans with ≤ 5 high-level nodes.
- **Bayes** entropy decreases steadily as sensors fire; when a camera catches
  a thief, the heat-map collapses to within two cells of the true position.
- **Minimax** at depth 2 evaluates < 600 nodes per turn; guard actions
  reliably converge toward vault-adjacent cells in the second half of a
  game.

## 7. Limitations & future work

- Independent per-thief Bayes grids ignore mutual-exclusion ("two thieves
  can't be in the same cell"); a joint particle filter would fix this.
- CBS currently stops at `max_nodes = 500`; adding *meta-agent* CBS (Sharon
  et al.) would help on denser maps.
- Minimax uses a coarse thief model. A learned policy or an information-
  theoretic opponent (maximise entropy reduction) would be a natural next
  step.

## 8. References

- Hart, Nilsson, Raphael (1968). *A formal basis for the heuristic
  determination of minimum cost paths.*
- Sharon, Stern, Felner, Sturtevant (2015). *Conflict-based search for
  optimal multi-agent pathfinding.*
- Thrun, Burgard, Fox (2005). *Probabilistic Robotics* — chapter on Bayes
  filters.
- Russell & Norvig (2020). *AI: A Modern Approach* — chapters on adversarial
  search and α-β pruning.
