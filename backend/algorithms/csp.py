"""
MODULE: csp.py
ALGORITHM: Constraint Satisfaction — Temporal Dependencies
COURSE TOPIC: Constraint Satisfaction Problems (CSP)
COMPLEXITY: O(n * d) for constraint propagation, n=agents, d=dependencies
PURPOSE IN GAME: Enforces temporal ordering between agents —
                 e.g., "Hacker must disable alarm BEFORE Thief enters vault".
                 Generates additional CBS constraints that block dependent agents
                 until their preconditions are met.

SECTIONS:
    1. Data Structures  — Dependency, TemporalConstraintSet
    2. Dependency Graph  — Build ordering from mission requirements
    3. Core Algorithm   — Generate CBS-compatible constraints from dependencies
    4. Validation       — Check if a CBS solution satisfies all temporal deps
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from algorithms.cbs import Constraint


# ────────────────────────────────────────────────────────────────
# SECTION 1: Data Structures
# ────────────────────────────────────────────────────────────────

@dataclass
class Dependency:
    """
    A temporal dependency: agent_a must reach target_a BEFORE
    agent_b can enter any cell in blocked_zone_b.

    Example: Hacker must reach alarm_panel before Thief can enter vault.
    """
    prereq_agent: str          # Agent that must act first
    prereq_target: tuple[int, int]   # Cell the prereq agent must reach
    dependent_agent: str       # Agent that is blocked
    blocked_cells: list[tuple[int, int]]  # Cells the dependent agent cannot enter
    description: str = ""


@dataclass
class ExtractionWindow:
    """
    All agents must reach extraction within `window` turns of each other.
    """
    agents: list[str]
    extraction_cells: list[tuple[int, int]]
    window: int = 2


# ────────────────────────────────────────────────────────────────
# SECTION 2: Dependency Graph
# ────────────────────────────────────────────────────────────────

def build_dependencies(
    deps_config: list[dict],
) -> list[Dependency]:
    """
    Build dependency list from a level configuration.

    Each dict: {
        "prereq_agent": "hacker",
        "prereq_target": [10, 3],
        "dependent_agent": "thief",
        "blocked_cells": [[12, 6], [12, 7], [13, 6], [13, 7]],
        "description": "Hacker disables alarm → Thief enters vault"
    }
    """
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


# ────────────────────────────────────────────────────────────────
# SECTION 3: Core Algorithm — Generate CBS Constraints
# ────────────────────────────────────────────────────────────────

def generate_temporal_constraints(
    dependencies: list[Dependency],
    prereq_arrival_times: dict[str, int] | None = None,
    max_time: int = 60,
) -> list[Constraint]:
    """
    Convert temporal dependencies into CBS vertex constraints.

    Logic (viva):
      For each dependency:
        - If we know when the prereq agent arrives at their target
          (from a previous CBS solution), block the dependent agent
          from the blocked zone for all timesteps BEFORE that arrival.
        - If we don't know yet (first CBS run), conservatively block
          the dependent agent from the zone for ALL timesteps.
          CBS will re-plan with updated constraints after the first solve.

    This is a form of CONSTRAINT PROPAGATION: we propagate temporal
    ordering constraints into the spatial domain (blocked cells over time).
    """
    constraints = []
    arrival = prereq_arrival_times or {}

    for dep in dependencies:
        # When does the prerequisite complete?
        arrive_t = arrival.get(dep.prereq_agent)

        if arrive_t is not None:
            # Block dependent agent from zone for t = 0 to arrive_t (inclusive)
            block_until = arrive_t + 1  # +1 because prereq needs 1 turn to act
        else:
            # Conservative: block for half the max time (heuristic estimate)
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
    """
    Iteratively solve CBS with CSP constraints.

    Round 1: Conservative blocking → CBS solves → get arrival times
    Round 2: Use actual arrival times → tighter constraints → CBS re-solves
    Round 3: Verify all dependencies satisfied

    Returns (cbs_result, satisfied: bool)
    """
    arrival_times: dict[str, int] = {}

    for round_num in range(max_rounds):
        constraints = generate_temporal_constraints(
            dependencies, arrival_times
        )
        result = cbs_solve_fn(building, agents, extra_constraints=constraints)

        if not result.success:
            return result, False

        # Extract arrival times from paths
        for dep in dependencies:
            agent = dep.prereq_agent
            if agent in result.paths:
                path = result.paths[agent]
                target = dep.prereq_target
                for t, pos in enumerate(path):
                    if pos == target:
                        arrival_times[agent] = t
                        break

        # Validate
        if validate_dependencies(dependencies, result.paths):
            return result, True

    return result, False


# ────────────────────────────────────────────────────────────────
# SECTION 4: Validation
# ────────────────────────────────────────────────────────────────

def validate_dependencies(
    dependencies: list[Dependency],
    paths: dict[str, list[tuple[int, int]]],
) -> bool:
    """
    Check that all temporal dependencies are satisfied in the solution.

    For each dependency:
      - Find when prereq agent reaches their target
      - Check that dependent agent doesn't enter blocked zone before that time
    """
    for dep in dependencies:
        prereq_path = paths.get(dep.prereq_agent, [])
        dep_path = paths.get(dep.dependent_agent, [])

        # Find arrival time of prereq agent
        arrival_t = None
        for t, pos in enumerate(prereq_path):
            if pos == dep.prereq_target:
                arrival_t = t
                break

        if arrival_t is None:
            return False  # Prereq never reaches target

        # Check dependent agent doesn't enter blocked zone before arrival
        for t, pos in enumerate(dep_path):
            if t <= arrival_t and pos in dep.blocked_cells:
                return False

    return True
