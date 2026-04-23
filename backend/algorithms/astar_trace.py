"""
MODULE: astar_trace.py
ALGORITHM: A* Search with step-by-step trace emission
COURSE TOPIC: Informed Search — interactive visualization
PURPOSE: Mirror of astar.py but yields a snapshot after every expansion
         so the frontend can scrub through the search process frame-by-frame.

Heuristic options: manhattan, euclidean, chebyshev, zero (Dijkstra-equivalent)
"""
from __future__ import annotations

import heapq
import math
import time
from dataclasses import dataclass, field
from typing import Callable, Iterator, Protocol


# ── Grid protocol — duck-typed so both Building and SimpleGrid work ──
class GridLike(Protocol):
    width: int
    height: int
    def neighbors(self, x: int, y: int) -> list[tuple[int, int]]: ...
    def is_walkable(self, x: int, y: int) -> bool: ...


# ── Heuristics ──
def h_manhattan(x1: int, y1: int, x2: int, y2: int) -> float:
    return abs(x1 - x2) + abs(y1 - y2)

def h_euclidean(x1: int, y1: int, x2: int, y2: int) -> float:
    return math.hypot(x1 - x2, y1 - y2)

def h_chebyshev(x1: int, y1: int, x2: int, y2: int) -> float:
    return max(abs(x1 - x2), abs(y1 - y2))

def h_zero(x1: int, y1: int, x2: int, y2: int) -> float:
    """Zero heuristic → A* degenerates to uniform-cost (Dijkstra)."""
    return 0.0

HEURISTICS: dict[str, Callable[[int, int, int, int], float]] = {
    "manhattan": h_manhattan,
    "euclidean": h_euclidean,
    "chebyshev": h_chebyshev,
    "zero": h_zero,
}


@dataclass
class TracedResult:
    success: bool
    path: list[tuple[int, int]]
    cost: float
    nodes_expanded: int
    steps: list[dict] = field(default_factory=list)
    runtime_ms: float = 0.0


def astar_trace(
    grid: GridLike,
    start: tuple[int, int],
    goal: tuple[int, int],
    heuristic: str = "manhattan",
    max_expansions: int = 5000,
) -> TracedResult:
    """
    Run A* recording a snapshot after every node expansion.

    Snapshot format (per step):
        {
            "step": int,
            "current": [x, y],
            "g": float,
            "f": float,
            "frontier": [[x, y, f], ...]  # cells in open list
            "closed":  [[x, y], ...]      # fully expanded cells
        }
    """
    if heuristic not in HEURISTICS:
        heuristic = "manhattan"
    h_fn = HEURISTICS[heuristic]

    sx, sy = start
    gx, gy = goal

    if not grid.is_walkable(sx, sy) or not grid.is_walkable(gx, gy):
        return TracedResult(success=False, path=[], cost=float("inf"),
                            nodes_expanded=0, steps=[], runtime_ms=0.0)

    # Node = (f, counter, x, y, g, parent_idx)
    counter = 0
    start_h = h_fn(sx, sy, gx, gy)
    open_heap: list[tuple[float, int, int, int, float, int]] = []
    heapq.heappush(open_heap, (start_h, counter, sx, sy, 0.0, -1))

    # came_from[(x,y)] = (parent_x, parent_y, g)
    came_from: dict[tuple[int, int], tuple[int, int, float]] = {(sx, sy): (-1, -1, 0.0)}
    # best g seen per cell (for dedup; we allow re-add with better g)
    best_g: dict[tuple[int, int], float] = {(sx, sy): 0.0}
    closed: set[tuple[int, int]] = set()
    # Parallel dict of currently-open frontier cells → f (for snapshot)
    open_f: dict[tuple[int, int], float] = {(sx, sy): start_h}

    steps: list[dict] = []
    expanded = 0
    t0 = time.perf_counter()

    while open_heap:
        f, _, x, y, g, _ = heapq.heappop(open_heap)

        # Skip stale entries (we re-pushed a better g later)
        if (x, y) in closed:
            continue
        if best_g.get((x, y), float("inf")) < g:
            continue

        closed.add((x, y))
        open_f.pop((x, y), None)
        expanded += 1

        # Snapshot
        steps.append({
            "step": expanded,
            "current": [x, y],
            "g": round(g, 2),
            "f": round(f, 2),
            "frontier": [[cx, cy, round(cf, 2)] for (cx, cy), cf in open_f.items()],
            "closed": [list(c) for c in closed],
        })

        if (x, y) == (gx, gy):
            # Reconstruct
            path: list[tuple[int, int]] = []
            cur = (x, y)
            while cur != (-1, -1):
                path.append(cur)
                px, py, _ = came_from[cur]
                cur = (px, py)
            path.reverse()
            return TracedResult(
                success=True, path=path, cost=g, nodes_expanded=expanded,
                steps=steps, runtime_ms=(time.perf_counter() - t0) * 1000.0,
            )

        if expanded >= max_expansions:
            break

        for nx, ny in grid.neighbors(x, y):
            if (nx, ny) in closed:
                continue
            ng = g + 1.0
            if ng < best_g.get((nx, ny), float("inf")):
                best_g[(nx, ny)] = ng
                nh = h_fn(nx, ny, gx, gy)
                nf = ng + nh
                counter += 1
                heapq.heappush(open_heap, (nf, counter, nx, ny, ng, 0))
                came_from[(nx, ny)] = (x, y, ng)
                open_f[(nx, ny)] = nf

    return TracedResult(
        success=False, path=[], cost=float("inf"),
        nodes_expanded=expanded, steps=steps,
        runtime_ms=(time.perf_counter() - t0) * 1000.0,
    )


def compare_heuristics(
    grid: GridLike,
    start: tuple[int, int],
    goal: tuple[int, int],
    heuristics: list[str],
    max_expansions: int = 5000,
) -> dict[str, TracedResult]:
    """Run A* with each heuristic on the same instance for side-by-side view."""
    return {
        h: astar_trace(grid, start, goal, heuristic=h, max_expansions=max_expansions)
        for h in heuristics
    }
