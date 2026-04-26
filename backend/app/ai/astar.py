"""A* pathfinder with time-indexed constraint support (for CBS).

A *constraint* is either:
  - ("vertex", agent_id, cell, t): agent must NOT be at `cell` at time `t`
  - ("edge",   agent_id, cell_a, cell_b, t): agent must NOT traverse
     cell_a -> cell_b between time t and t+1

The planner returns a list of (row, col) where index == timestep.
"""
from __future__ import annotations

import heapq
from dataclasses import dataclass
from typing import Iterable

from ..game.grid import GameMap, Coord


Constraint = tuple  # tagged tuple as described above


@dataclass
class AStarResult:
    path: list[Coord]
    expanded: list[Coord]        # nodes popped (for visualization)
    cost: int


def manhattan(a: Coord, b: Coord) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def _blocked_vertex(constraints: Iterable[Constraint], agent: int, cell: Coord, t: int) -> bool:
    for c in constraints:
        if c[0] == "vertex" and c[1] == agent and c[2] == cell and c[3] == t:
            return True
    return False


def _blocked_edge(constraints: Iterable[Constraint], agent: int,
                  a: Coord, b: Coord, t: int) -> bool:
    for c in constraints:
        if c[0] == "edge" and c[1] == agent and c[2] == a and c[3] == b and c[4] == t:
            return True
    return False


def astar(
    gmap: GameMap,
    start: Coord,
    goal: Coord,
    agent_id: int = 0,
    constraints: list[Constraint] | None = None,
    max_time: int = 200,
    allow_wait: bool = True,
) -> AStarResult | None:
    """Space-time A*.

    State = (cell, t). Successors are the 4 neighbors plus an optional 'wait'.
    Goal test requires cell == goal AND no future vertex constraint forces the
    agent off the goal later (simple check: we pad 'rest at goal' entries after
    the path when assembling the CBS solution).
    """
    constraints = constraints or []

    # Pre-index constraints for speed
    vmax_t = 0
    for c in constraints:
        if c[0] == "vertex" and c[1] == agent_id:
            vmax_t = max(vmax_t, c[3])
        elif c[0] == "edge" and c[1] == agent_id:
            vmax_t = max(vmax_t, c[4] + 1)

    open_heap: list[tuple[int, int, Coord, int]] = []
    counter = 0
    h0 = manhattan(start, goal)
    heapq.heappush(open_heap, (h0, counter, start, 0))

    came_from: dict[tuple[Coord, int], tuple[Coord, int]] = {}
    g_score: dict[tuple[Coord, int], int] = {(start, 0): 0}
    expanded: list[Coord] = []

    while open_heap:
        _, _, cur, t = heapq.heappop(open_heap)
        expanded.append(cur)

        # Goal reached AND no later constraint on the goal cell for this agent
        if cur == goal and t >= vmax_t:
            # reconstruct
            path = [cur]
            node = (cur, t)
            while node in came_from:
                node = came_from[node]
                path.append(node[0])
            path.reverse()
            return AStarResult(path=path, expanded=expanded, cost=t)

        if t >= max_time:
            continue

        neighbors: list[Coord] = list(gmap.neighbors(cur))
        if allow_wait:
            neighbors.append(cur)  # wait in place

        for nxt in neighbors:
            nt = t + 1
            if _blocked_vertex(constraints, agent_id, nxt, nt):
                continue
            if nxt != cur and _blocked_edge(constraints, agent_id, cur, nxt, t):
                continue
            tentative = g_score[(cur, t)] + 1
            key = (nxt, nt)
            if tentative < g_score.get(key, 1 << 30):
                g_score[key] = tentative
                came_from[key] = (cur, t)
                f = tentative + manhattan(nxt, goal)
                counter += 1
                heapq.heappush(open_heap, (f, counter, nxt, nt))

    return None
