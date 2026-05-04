from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from algorithms.cbs import Constraint


@dataclass
class Dependency:
    prereq_agent: str
    prereq_target: tuple[int, int]
    dependent_agent: str
    blocked_cells: list[tuple[int, int]]
    description: str = ""


@dataclass
class ExtractionWindow:
    agents: list[str]
    extraction_cells: list[tuple[int, int]]
    window: int = 2


def build_dependencies(
    deps_config: list[dict],
) -> list[Dependency]:
    """Build dependency list from a level configuration."""
    result = []
    for d in deps_config:
        result.append(Dependency(
            prereq_agent=d["prereq_agent"],
            prereq_target=tuple(d["prereq_target"]),
            dependent_agent=d["dependent_agent"],
            blocked_cells=[tuple(c) for c in d["blocked_cells"]],
            description=d.get("description", ""),
        ))
    return result


def generate_temporal_constraints(
    dependencies: list[Dependency],
    prereq_arrival_times: dict[str, int] | None = None,
    max_time: int = 60,
) -> list[Constraint]:
    """Convert temporal dependencies into CBS vertex constraints."""
    constraints = []
    arrival = prereq_arrival_times or {}

    for dep in dependencies:

        arrive_t = arrival.get(dep.prereq_agent)

        if arrive_t is not None:

            block_until = arrive_t + 1
        else:

            block_until = max_time // 2

        for cell in dep.blocked_cells:
            for t in range(block_until):
                constraints.append(Constraint(
                    agent_id=dep.dependent_agent,
                    x=cell[0], y=cell[1], t=t,
                    constraint_type="vertex",
                ))

    return constraints


def iterative_csp_cbs(
    dependencies: list[Dependency],
    cbs_solve_fn,
    building,
    agents: dict[str, tuple[tuple[int, int], tuple[int, int]]],
    max_rounds: int = 3,
) -> tuple:
    """Iteratively solve CBS with CSP constraints."""
    arrival_times: dict[str, int] = {}

    for round_num in range(max_rounds):
        constraints = generate_temporal_constraints(
            dependencies, arrival_times
        )
        result = cbs_solve_fn(building, agents, extra_constraints=constraints)

        if not result.success:
            return result, False


        for dep in dependencies:
            agent = dep.prereq_agent
            if agent in result.paths:
                path = result.paths[agent]
                target = dep.prereq_target
                for t, pos in enumerate(path):
                    if pos == target:
                        arrival_times[agent] = t
                        break


        if validate_dependencies(dependencies, result.paths):
            return result, True

    return result, False


def validate_dependencies(
    dependencies: list[Dependency],
    paths: dict[str, list[tuple[int, int]]],
) -> bool:
    """Check that all temporal dependencies are satisfied in the solution."""
    for dep in dependencies:
        prereq_path = paths.get(dep.prereq_agent, [])
        dep_path = paths.get(dep.dependent_agent, [])


        arrival_t = None
        for t, pos in enumerate(prereq_path):
            if pos == dep.prereq_target:
                arrival_t = t
                break

        if arrival_t is None:
            return False


        for t, pos in enumerate(dep_path):
            if t <= arrival_t and pos in dep.blocked_cells:
                return False

    return True
