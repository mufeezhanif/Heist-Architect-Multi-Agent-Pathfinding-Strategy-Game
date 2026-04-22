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
