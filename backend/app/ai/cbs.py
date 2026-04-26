"""Conflict-Based Search (CBS) for multi-agent pathfinding.

High level: maintains a constraint tree. Each node contains a set of
constraints and a solution (one path per agent). We detect the first conflict
in the solution, branch on it by adding a constraint to each of the two
involved agents, and continue best-first on total cost.

Low level: calls A* (see astar.py) with the accumulated constraints for the
agent being replanned.

Return value also includes the list of conflicts encountered so the UI can
visualize CBS doing its job.
"""
from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Optional

from ..game.grid import GameMap, Coord
from .astar import astar, Constraint


@dataclass
class CBSNode:
    constraints: list[Constraint]
    solution: dict[int, list[Coord]]
    cost: int
    # history of conflict objects for visualization
    conflicts_seen: list[dict] = field(default_factory=list)


@dataclass
class CBSResult:
    paths: dict[int, list[Coord]]
    conflicts: list[dict]
    expanded_nodes: int


def _pad(path: list[Coord], length: int) -> list[Coord]:
    if len(path) >= length:
        return path
    return path + [path[-1]] * (length - len(path))


def _first_conflict(paths: dict[int, list[Coord]]) -> Optional[dict]:
    """Return the earliest vertex or edge conflict between any pair of agents."""
    agents = list(paths.keys())
    max_len = max(len(p) for p in paths.values())
    padded = {a: _pad(paths[a], max_len) for a in agents}

    for t in range(max_len):
        # vertex conflict
        occupied: dict[Coord, int] = {}
        for a in agents:
            cell = padded[a][t]
            if cell in occupied:
                other = occupied[cell]
                return {
                    "type": "vertex",
                    "a1": other, "a2": a,
                    "cell": cell, "t": t,
                }
            occupied[cell] = a

        # edge (swap) conflict: a1 moves x->y while a2 moves y->x
        if t + 1 < max_len:
            for i in range(len(agents)):
                for j in range(i + 1, len(agents)):
                    a1, a2 = agents[i], agents[j]
                    if padded[a1][t] == padded[a2][t + 1] and padded[a2][t] == padded[a1][t + 1] \
                            and padded[a1][t] != padded[a1][t + 1]:
                        return {
                            "type": "edge",
                            "a1": a1, "a2": a2,
                            "cell_a": padded[a1][t], "cell_b": padded[a1][t + 1],
                            "t": t,
                        }
    return None


def cbs(
    gmap: GameMap,
    starts: dict[int, Coord],
    goals: dict[int, Coord],
    max_nodes: int = 500,
) -> Optional[CBSResult]:
    """Plan paths for all agents avoiding inter-agent conflicts."""
    # Root node: plan each agent independently
    root_solution: dict[int, list[Coord]] = {}
    root_cost = 0
    for a, s in starts.items():
        res = astar(gmap, s, goals[a], agent_id=a)
        if res is None:
            return None
        root_solution[a] = res.path
        root_cost += res.cost

    root = CBSNode(constraints=[], solution=root_solution, cost=root_cost)
    heap: list[tuple[int, int, CBSNode]] = []
    counter = 0
    heapq.heappush(heap, (root.cost, counter, root))

    all_conflicts: list[dict] = []
    expanded = 0

    while heap and expanded < max_nodes:
        _, _, node = heapq.heappop(heap)
        expanded += 1

        conflict = _first_conflict(node.solution)
        if conflict is None:
            return CBSResult(paths=node.solution, conflicts=all_conflicts,
                             expanded_nodes=expanded)

        all_conflicts.append(conflict)

        # Branch into 2 children, each adds one constraint
        if conflict["type"] == "vertex":
            a1, a2, cell, t = conflict["a1"], conflict["a2"], conflict["cell"], conflict["t"]
            branches = [
                ("vertex", a1, cell, t),
                ("vertex", a2, cell, t),
            ]
        else:
            a1, a2 = conflict["a1"], conflict["a2"]
            ca, cb, t = conflict["cell_a"], conflict["cell_b"], conflict["t"]
            branches = [
                ("edge", a1, ca, cb, t),
                ("edge", a2, cb, ca, t),
            ]

        for new_c in branches:
            target_agent = new_c[1]
            new_constraints = node.constraints + [new_c]
            res = astar(gmap, starts[target_agent], goals[target_agent],
                        agent_id=target_agent, constraints=new_constraints)
            if res is None:
                continue
            new_solution = dict(node.solution)
            new_solution[target_agent] = res.path
            new_cost = sum(len(p) - 1 for p in new_solution.values())
            child = CBSNode(constraints=new_constraints, solution=new_solution,
                            cost=new_cost)
            counter += 1
            heapq.heappush(heap, (child.cost, counter, child))

    return None
