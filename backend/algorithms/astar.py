"""
MODULE: astar.py
ALGORITHM: A* Search (Space-Time variant)
COURSE TOPIC: Informed Search
COMPLEXITY: O(b^d) time, O(b^d) space
PURPOSE IN GAME: Low-level solver inside CBS — finds optimal path
                 for a SINGLE agent on the building grid, respecting
                 space-time constraints injected by CBS.

SECTIONS:
    1. Data Structures  — SpaceTimeNode, SearchResult
    2. Heuristic        — Manhattan distance (admissible & consistent)
    3. Core Algorithm   — A* with open/closed sets in space-time
    4. Constraint Layer  — Vertex & edge constraints from CBS
"""
from __future__ import annotations
import heapq
from dataclasses import dataclass, field
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from game.building import Building


# ────────────────────────────────────────────────────────────────
# SECTION 1: Data Structures
# ────────────────────────────────────────────────────────────────

@dataclass
class SpaceTimeNode:
    """
    State = (x, y, t) — same cell at different times is a different node.
    This lets CBS say "agent must NOT be at (3,4) at time 5".
    """
    x: int
    y: int
    t: int
    g: float = 0.0
    h: float = 0.0
    parent: Optional[SpaceTimeNode] = None

    @property
    def f(self) -> float:
        """f(n) = g(n) + h(n) — total estimated cost through this node."""
        return self.g + self.h

    def __lt__(self, other: SpaceTimeNode) -> bool:
        return self.f < other.f

    def state(self) -> tuple[int, int, int]:
        return (self.x, self.y, self.t)

    def pos(self) -> tuple[int, int]:
        return (self.x, self.y)


@dataclass
class SearchResult:
    """Result of an A* search."""
    path: list[tuple[int, int]]
    cost: float
    nodes_expanded: int
    success: bool
    timesteps: list[int] = field(default_factory=list)


# ────────────────────────────────────────────────────────────────
# SECTION 2: Heuristic
# ────────────────────────────────────────────────────────────────

def manhattan_distance(x1: int, y1: int, x2: int, y2: int) -> float:
    """
    Manhattan distance — admissible on 4-connected grids.
    Never overestimates: you need at least |dx|+|dy| moves.
    Consistent: h(n) <= cost(n,n') + h(n') for any neighbor n'.
    """
    return abs(x1 - x2) + abs(y1 - y2)


# ────────────────────────────────────────────────────────────────
# SECTION 3: Core Algorithm — Space-Time A*
# ────────────────────────────────────────────────────────────────

def astar_search(
    building: Building,
    start: tuple[int, int],
    goal: tuple[int, int],
    constraints: list[tuple[int, int, int]] | None = None,
    edge_constraints: list[tuple[int, int, int, int, int]] | None = None,
    max_time: int = 60,
    move_cost: float = 1.0,
    wait_cost: float = 1.0,
) -> SearchResult:
    """
    Space-Time A*.

    Steps (viva):
      1. Put start in open set (priority queue by f-value)
      2. Pop lowest f = g + h node
      3. If it's the goal → reconstruct path
      4. Expand: 4 neighbors + WAIT action
      5. Skip any neighbor violating a CBS constraint
      6. Add to open if not already closed
      7. Repeat until goal found or open empty
    """
    constraint_set = set(constraints or [])
    edge_set = set(edge_constraints or [])

    sx, sy = start
    gx, gy = goal

    start_node = SpaceTimeNode(
        x=sx, y=sy, t=0, g=0.0,
        h=manhattan_distance(sx, sy, gx, gy),
    )

    open_list: list[SpaceTimeNode] = [start_node]
    heapq.heapify(open_list)
    closed: set[tuple[int, int, int]] = set()
    expanded = 0

    while open_list:
        current = heapq.heappop(open_list)
        if current.state() in closed:
            continue
        closed.add(current.state())
        expanded += 1

        if current.pos() == (gx, gy):
            return _reconstruct(current, expanded)

        if current.t >= max_time:
            continue

        nt = current.t + 1

        # Move to 4-connected neighbors
        for nx, ny in building.neighbors(current.x, current.y):
            if (nx, ny, nt) in constraint_set:
                continue
            if (current.x, current.y, nx, ny, nt) in edge_set:
                continue
            node = SpaceTimeNode(
                x=nx, y=ny, t=nt,
                g=current.g + move_cost,
                h=manhattan_distance(nx, ny, gx, gy),
                parent=current,
            )
            if node.state() not in closed:
                heapq.heappush(open_list, node)

        # Wait in place
        if (current.x, current.y, nt) not in constraint_set:
            wait = SpaceTimeNode(
                x=current.x, y=current.y, t=nt,
                g=current.g + wait_cost,
                h=manhattan_distance(current.x, current.y, gx, gy),
                parent=current,
            )
            if wait.state() not in closed:
                heapq.heappush(open_list, wait)

    return SearchResult(path=[], cost=float("inf"),
                        nodes_expanded=expanded, success=False)


# ────────────────────────────────────────────────────────────────
# SECTION 4: Constraint Support — path reconstruction
# ────────────────────────────────────────────────────────────────

def _reconstruct(node: SpaceTimeNode, expanded: int) -> SearchResult:
    """Walk parent pointers back to start to build the path."""
    path, timesteps = [], []
    cur: Optional[SpaceTimeNode] = node
    while cur is not None:
        path.append(cur.pos())
        timesteps.append(cur.t)
        cur = cur.parent
    path.reverse()
    timesteps.reverse()
    return SearchResult(path=path, cost=node.g,
                        nodes_expanded=expanded,
                        success=True, timesteps=timesteps)
"""
Heist Architect — A* Search Algorithm
======================================

PURPOSE:
    Finds the shortest path between two points on the building grid.
    Used as the LOW-LEVEL SOLVER inside CBS — each agent gets its own
    A* search that respects a set of space-time constraints.

SECTIONS:
    1. Data Structures  — Node, SearchResult
    2. Heuristic        — Manhattan distance (admissible & consistent)
    3. Core Algorithm   — A* with open/closed sets
    4. Constraint Layer  — Space-time constraints from CBS

COMPLEXITY:
    Time:  O(b^d) worst case, but heuristic prunes heavily
    Space: O(b^d) for the open set
    Where b = branching factor (~4 for grid), d = path length

VIVA NOTES:
    - A* = Dijkstra + heuristic guidance
    - Optimal when heuristic is admissible (never overestimates)
    - Manhattan distance is admissible on 4-connected grids
    - We use space-time A* here: state = (x, y, timestep)
      so an agent can WAIT at a cell if moving would violate a constraint
"""
import heapq
from dataclasses import dataclass, field
from typing import Optional

from game.building import Building


# ────────────────────────────────────────────────────────────────
# SECTION 1: Data Structures
# ────────────────────────────────────────────────────────────────

@dataclass
class SpaceTimeNode:
    """
    A node in the space-time A* search graph.

    (x, y, t) — position at a specific timestep.
    This is what makes it space-time A*: the same cell at different
    times is a DIFFERENT node. This lets us handle "don't be at (3,4)
    at time 5" constraints from CBS.
    """
    x: int
    y: int
    t: int                          # Timestep
    g: float = 0.0                  # Cost from start
    h: float = 0.0                  # Heuristic estimate to goal
    parent: Optional[SpaceTimeNode] = None

    @property
    def f(self) -> float:
        """f(n) = g(n) + h(n) — estimated total cost."""
        return self.g + self.h

    def __lt__(self, other: SpaceTimeNode) -> bool:
        return self.f < other.f

    def state(self) -> tuple[int, int, int]:
        return (self.x, self.y, self.t)

    def pos(self) -> tuple[int, int]:
        return (self.x, self.y)


@dataclass
class SearchResult:
    """Result of an A* search."""
    path: list[tuple[int, int]]         # Sequence of (x, y) positions
    cost: float                          # Total path cost
    nodes_expanded: int                  # For visualization / stats
    success: bool                        # Did we find a path?
    timesteps: list[int] = field(default_factory=list)  # t for each position


# ────────────────────────────────────────────────────────────────
# SECTION 2: Heuristic
# ────────────────────────────────────────────────────────────────

def manhattan_distance(x1: int, y1: int, x2: int, y2: int) -> float:
    """
    Manhattan distance heuristic.

    Admissible: never overestimates actual shortest path on a 4-connected
    grid (you must move at least |dx| + |dy| steps).

    Consistent: h(n) <= cost(n, n') + h(n') for all neighbors n'.
    This guarantees A* never re-expands a node.
    """
    return abs(x1 - x2) + abs(y1 - y2)


# ────────────────────────────────────────────────────────────────
# SECTION 3: Core Algorithm — Space-Time A*
# ────────────────────────────────────────────────────────────────

def astar_search(
    building: Building,
    start: tuple[int, int],
    goal: tuple[int, int],
    constraints: list[tuple[int, int, int]] | None = None,
    edge_constraints: list[tuple[int, int, int, int, int]] | None = None,
    max_time: int = 50,
    move_cost: float = 1.0,
    wait_cost: float = 1.0,
) -> SearchResult:
    """
    Space-Time A* search.

    Parameters
    ----------
    building : Building
        The grid world.
    start : (x, y)
        Starting position.
    goal : (x, y)
        Target position.
    constraints : list of (x, y, t)
        CBS vertex constraints: "agent must NOT be at (x,y) at time t".
    edge_constraints : list of (x1, y1, x2, y2, t)
        CBS edge constraints: "agent must NOT move from (x1,y1) to (x2,y2)
        between time t-1 and t".
    max_time : int
        Maximum timesteps before giving up.
    move_cost : float
        Cost to move one cell (varies by agent type).
    wait_cost : float
        Cost to wait in place for one timestep.

    Returns
    -------
    SearchResult with path, cost, nodes expanded.

    Algorithm Steps (for viva):
    1. Initialize open set (priority queue) with start node
    2. Pop lowest f(n) = g(n) + h(n) node from open set
    3. If it's the goal, reconstruct path and return
    4. Expand neighbors: 4 adjacent cells + WAIT action
    5. For each neighbor, check constraints — skip if violated
    6. If neighbor not in closed set (or found cheaper), add to open
    7. Repeat until goal found or open set empty
    """
    if constraints is None:
        constraints = []
    if edge_constraints is None:
        edge_constraints = []

    constraint_set = set(constraints)
    edge_constraint_set = set(edge_constraints)

    sx, sy = start
    gx, gy = goal

    start_node = SpaceTimeNode(
        x=sx, y=sy, t=0,
        g=0.0,
        h=manhattan_distance(sx, sy, gx, gy),
    )

    # Open set: priority queue ordered by f-value
    open_list: list[SpaceTimeNode] = [start_node]
    heapq.heapify(open_list)

    # Closed set: visited (x, y, t) states
    closed_set: set[tuple[int, int, int]] = set()

    nodes_expanded = 0

    while open_list:
        # Step 2: Pop node with lowest f-value
        current = heapq.heappop(open_list)

        # Skip if already visited
        if current.state() in closed_set:
            continue

        closed_set.add(current.state())
        nodes_expanded += 1

        # Step 3: Goal check — agent must be AT goal (any time)
        if current.pos() == (gx, gy):
            return _reconstruct(current, nodes_expanded)

        # Time limit reached
        if current.t >= max_time:
            continue

        # Step 4: Expand neighbors
        next_t = current.t + 1

        # 4a. Movement to adjacent cells
        for nx, ny in building.neighbors(current.x, current.y):
            # Step 5: Check CBS constraints
            if _is_constrained(nx, ny, next_t, constraint_set):
                continue
            if _is_edge_constrained(
                current.x, current.y, nx, ny, next_t, edge_constraint_set
            ):
                continue

            neighbor = SpaceTimeNode(
                x=nx, y=ny, t=next_t,
                g=current.g + move_cost,
                h=manhattan_distance(nx, ny, gx, gy),
                parent=current,
            )

            if neighbor.state() not in closed_set:
                heapq.heappush(open_list, neighbor)

        # 4b. WAIT action — stay in current cell
        if not _is_constrained(current.x, current.y, next_t, constraint_set):
            wait_node = SpaceTimeNode(
                x=current.x, y=current.y, t=next_t,
                g=current.g + wait_cost,
                h=manhattan_distance(current.x, current.y, gx, gy),
                parent=current,
            )
            if wait_node.state() not in closed_set:
                heapq.heappush(open_list, wait_node)

    # No path found
    return SearchResult(path=[], cost=float("inf"), nodes_expanded=nodes_expanded,
                        success=False)


# ────────────────────────────────────────────────────────────────
# SECTION 4: Constraint Support (CBS interface)
# ────────────────────────────────────────────────────────────────

def _is_constrained(
    x: int, y: int, t: int,
    constraint_set: set[tuple[int, int, int]],
) -> bool:
    """
    Check if a vertex constraint forbids this agent from being
    at (x, y) at time t.

    CBS generates these when two agents collide at the same cell.
    """
    return (x, y, t) in constraint_set


def _is_edge_constrained(
    x1: int, y1: int, x2: int, y2: int, t: int,
    edge_constraint_set: set[tuple[int, int, int, int, int]],
) -> bool:
    """
    Check if an edge constraint forbids moving from (x1,y1) to (x2,y2)
    at time t.

    CBS generates these when two agents swap positions
    (A goes 1→2 while B goes 2→1 at the same timestep).
    """
    return (x1, y1, x2, y2, t) in edge_constraint_set


def _reconstruct(node: SpaceTimeNode, nodes_expanded: int) -> SearchResult:
    """Walk back through parent pointers to build the path."""
    path = []
    timesteps = []
    current: Optional[SpaceTimeNode] = node
    while current is not None:
        path.append(current.pos())
        timesteps.append(current.t)
        current = current.parent
    path.reverse()
    timesteps.reverse()
    return SearchResult(
        path=path,
        cost=node.g,
        nodes_expanded=nodes_expanded,
        success=True,
        timesteps=timesteps,
    )
