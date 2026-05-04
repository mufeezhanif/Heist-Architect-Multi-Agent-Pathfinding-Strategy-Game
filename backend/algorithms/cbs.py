from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, TYPE_CHECKING
import copy

if TYPE_CHECKING:
    from game.building import Building

from algorithms.astar import astar_search, SearchResult


@dataclass
class Conflict:
    agent_1: str
    agent_2: str
    x: int
    y: int
    t: int
    conflict_type: str = "vertex"

    x2: int = 0
    y2: int = 0


@dataclass
class Constraint:
    agent_id: str
    x: int
    y: int
    t: int
    constraint_type: str = "vertex"
    x2: int = 0
    y2: int = 0


@dataclass
class CTNode:
    constraints: list[Constraint] = field(default_factory=list)
    paths: dict[str, SearchResult] = field(default_factory=dict)
    cost: float = 0.0
    node_id: int = 0
    parent_id: int = -1

    def __lt__(self, other: CTNode) -> bool:
        return self.cost < other.cost


@dataclass
class CBSResult:
    paths: dict[str, list[tuple[int, int]]]
    total_cost: float
    makespan: int
    conflicts_resolved: int
    tree_log: list[dict]
    success: bool


def detect_first_conflict(paths: dict[str, SearchResult]) -> Optional[Conflict]:
    """Check all pairs of agents for the FIRST conflict."""
    agents = list(paths.keys())

    for i in range(len(agents)):
        for j in range(i + 1, len(agents)):
            a1, a2 = agents[i], agents[j]
            p1, p2 = paths[a1].path, paths[a2].path
            t1, t2 = paths[a1].timesteps, paths[a2].timesteps

            max_t = max(len(p1), len(p2))

            for t in range(max_t):

                pos1 = p1[t] if t < len(p1) else p1[-1]
                pos2 = p2[t] if t < len(p2) else p2[-1]


                if pos1 == pos2:
                    return Conflict(
                        agent_1=a1, agent_2=a2,
                        x=pos1[0], y=pos1[1], t=t,
                        conflict_type="vertex",
                    )


                if t > 0:
                    prev1 = p1[t - 1] if t - 1 < len(p1) else p1[-1]
                    prev2 = p2[t - 1] if t - 1 < len(p2) else p2[-1]
                    if pos1 == prev2 and pos2 == prev1:
                        return Conflict(
                            agent_1=a1, agent_2=a2,
                            x=prev1[0], y=prev1[1], t=t,
                            conflict_type="edge",
                            x2=pos1[0], y2=pos1[1],
                        )
    return None


def cbs_search(
    building: Building,
    agents: dict[str, tuple[tuple[int, int], tuple[int, int]]],
    extra_constraints: list[Constraint] | None = None,
    max_iterations: int = 200,
) -> CBSResult:
    """Conflict-Based Search."""
    tree_log: list[dict] = []
    node_counter = 0


    root = CTNode(
        constraints=list(extra_constraints or []),
        node_id=node_counter,
    )

    for agent_id, (start, goal) in agents.items():
        agent_constraints = _get_agent_constraints(root.constraints, agent_id)
        result = astar_search(
            building, start, goal,
            constraints=agent_constraints["vertex"],
            edge_constraints=agent_constraints["edge"],
        )
        if not result.success:
            return CBSResult(paths={}, total_cost=float("inf"),
                             makespan=0, conflicts_resolved=0,
                             tree_log=tree_log, success=False)
        root.paths[agent_id] = result

    root.cost = sum(r.cost for r in root.paths.values())

    tree_log.append({
        "type": "cbs_root",
        "node_id": 0,
        "cost": root.cost,
        "paths": {a: r.path for a, r in root.paths.items()},
    })


    import heapq
    open_list: list[CTNode] = [root]
    heapq.heapify(open_list)
    conflicts_resolved = 0

    for iteration in range(max_iterations):
        if not open_list:
            break


        current = heapq.heappop(open_list)


        conflict = detect_first_conflict(current.paths)


        if conflict is None:
            return _build_result(current, conflicts_resolved, tree_log)

        conflicts_resolved += 1

        tree_log.append({
            "type": "cbs_conflict",
            "node_id": current.node_id,
            "agent1": conflict.agent_1,
            "agent2": conflict.agent_2,
            "cell": [conflict.x, conflict.y],
            "time": conflict.t,
            "conflict_type": conflict.conflict_type,
        })


        for agent_id in [conflict.agent_1, conflict.agent_2]:
            node_counter += 1
            child = CTNode(
                constraints=list(current.constraints),
                paths=dict(current.paths),
                node_id=node_counter,
                parent_id=current.node_id,
            )


            new_constraint = Constraint(
                agent_id=agent_id,
                x=conflict.x, y=conflict.y, t=conflict.t,
                constraint_type=conflict.conflict_type,
                x2=conflict.x2, y2=conflict.y2,
            )
            child.constraints.append(new_constraint)


            start, goal = agents[agent_id]
            agent_c = _get_agent_constraints(child.constraints, agent_id)
            result = astar_search(
                building, start, goal,
                constraints=agent_c["vertex"],
                edge_constraints=agent_c["edge"],
            )

            if not result.success:
                tree_log.append({
                    "type": "cbs_branch_fail",
                    "node_id": node_counter,
                    "parent_id": current.node_id,
                    "constrained_agent": agent_id,
                })
                continue

            child.paths[agent_id] = result
            child.cost = sum(r.cost for r in child.paths.values())

            heapq.heappush(open_list, child)

            tree_log.append({
                "type": "cbs_branch",
                "node_id": node_counter,
                "parent_id": current.node_id,
                "constrained_agent": agent_id,
                "constraint": {
                    "agent": agent_id,
                    "cell": [conflict.x, conflict.y],
                    "time": conflict.t,
                },
                "cost": child.cost,
            })

    return CBSResult(paths={}, total_cost=float("inf"),
                     makespan=0, conflicts_resolved=conflicts_resolved,
                     tree_log=tree_log, success=False)


def _get_agent_constraints(
    constraints: list[Constraint], agent_id: str
) -> dict[str, list]:
    """Extract vertex and edge constraints for a specific agent."""
    vertex = []
    edge = []
    for c in constraints:
        if c.agent_id != agent_id:
            continue
        if c.constraint_type == "vertex":
            vertex.append((c.x, c.y, c.t))
        elif c.constraint_type == "edge":
            edge.append((c.x, c.y, c.x2, c.y2, c.t))
    return {"vertex": vertex, "edge": edge}


def _build_result(
    node: CTNode, conflicts_resolved: int, tree_log: list[dict]
) -> CBSResult:
    """Assemble the final CBS result from a solved CT node."""
    paths = {}
    max_t = 0
    total_cost = 0.0

    for agent_id, result in node.paths.items():
        paths[agent_id] = result.path
        total_cost += result.cost
        if result.timesteps:
            max_t = max(max_t, result.timesteps[-1])

    tree_log.append({
        "type": "cbs_solution",
        "node_id": node.node_id,
        "total_cost": total_cost,
        "makespan": max_t,
        "conflicts_resolved": conflicts_resolved,
        "paths": {a: p for a, p in paths.items()},
    })

    return CBSResult(
        paths=paths,
        total_cost=total_cost,
        makespan=max_t,
        conflicts_resolved=conflicts_resolved,
        tree_log=tree_log,
        success=True,
    )
