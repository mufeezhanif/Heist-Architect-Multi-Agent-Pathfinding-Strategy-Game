"""
API routes for the three AI Observatory modes:
  /arena   — interactive A* + CBS inspector
  /theater — AI-vs-AI spectator (uses existing game engine)
  /bench   — MAPF benchmark harness with CSV export
"""
from __future__ import annotations

import csv
import io
import math
import random
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from algorithms.astar_trace import astar_trace, compare_heuristics, HEURISTICS
from algorithms.cbs import cbs_search
from game.grid import SimpleGrid, SAMPLE_MAPS, load_sample, parse_movingai_map, make_empty


arena_router = APIRouter()
theater_router = APIRouter()
bench_router = APIRouter()


def _safe(v: float) -> float:
    if math.isinf(v) or math.isnan(v):
        return 0.0
    return v


def _normalize_sensor_event(e) -> dict:
    """Accept either a SensorEvent object or a dict and return a JSON-safe dict."""
    if isinstance(e, dict):
        et = e.get("event_type")
        return {
            "sensor_id": e.get("sensor_id"),
            "event_type": et.value if hasattr(et, "value") else str(et) if et is not None else None,
            "pos": e.get("pos") or (
                [e["sensor_x"], e["sensor_y"]] if "sensor_x" in e and "sensor_y" in e else None
            ),
        }
    # Object form (has attributes)
    et = getattr(e, "event_type", None)
    return {
        "sensor_id": getattr(e, "sensor_id", None),
        "event_type": et.value if hasattr(et, "value") else str(et) if et is not None else None,
        "pos": [getattr(e, "sensor_x", None), getattr(e, "sensor_y", None)]
               if hasattr(e, "sensor_x") else None,
    }


# ────────────────────────────────────────────────────────────────
# SHARED: grid handling
# ────────────────────────────────────────────────────────────────

class GridSpec(BaseModel):
    """Either a built-in sample name, or custom cells, or raw .map text."""
    sample: str | None = None
    width: int | None = None
    height: int | None = None
    cells: list[list[int]] | None = None
    map_text: str | None = None
    name: str | None = None


def _resolve_grid(spec: GridSpec) -> SimpleGrid:
    if spec.sample:
        return load_sample(spec.sample)
    if spec.map_text:
        return parse_movingai_map(spec.map_text, name=spec.name or "uploaded")
    if spec.cells is not None and spec.width and spec.height:
        return SimpleGrid(
            width=spec.width, height=spec.height,
            cells=[[bool(c) for c in row] for row in spec.cells],
            name=spec.name or "custom",
        )
    if spec.width and spec.height:
        return make_empty(spec.width, spec.height)
    raise HTTPException(400, "Provide a sample name, map_text, or cells")


# ════════════════════════════════════════════════════════════════
# ARENA — interactive A* + CBS inspector
# ════════════════════════════════════════════════════════════════

@arena_router.get("/samples")
def arena_samples():
    """List built-in sample maps with small previews."""
    out = []
    for name in SAMPLE_MAPS.keys():
        g = load_sample(name)
        out.append({
            "name": name,
            "width": g.width,
            "height": g.height,
            "walkable_cells": sum(sum(1 for c in row if c) for row in g.cells),
        })
    return {"samples": out, "heuristics": list(HEURISTICS.keys())}


@arena_router.post("/sample/{name}")
def arena_load_sample(name: str):
    try:
        g = load_sample(name)
    except KeyError:
        raise HTTPException(404, f"Unknown sample: {name}")
    return g.to_dict()


@arena_router.post("/grid")
def arena_grid(spec: GridSpec):
    g = _resolve_grid(spec)
    return g.to_dict()


class AStarRequest(BaseModel):
    grid: GridSpec
    start: list[int]  # [x, y]
    goal: list[int]   # [x, y]
    heuristic: str = "manhattan"
    compare: list[str] | None = None  # if given, race these heuristics
    max_expansions: int = 5000


@arena_router.post("/astar")
def arena_astar(req: AStarRequest):
    grid = _resolve_grid(req.grid)
    start = (req.start[0], req.start[1])
    goal = (req.goal[0], req.goal[1])

    if req.compare:
        # Race multiple heuristics on the same instance
        results = compare_heuristics(grid, start, goal, req.compare, req.max_expansions)
        return {
            "mode": "race",
            "grid": grid.to_dict(),
            "start": list(start),
            "goal": list(goal),
            "runs": {
                h: {
                    "success": r.success,
                    "path": [list(p) for p in r.path],
                    "cost": _safe(r.cost),
                    "nodes_expanded": r.nodes_expanded,
                    "runtime_ms": round(r.runtime_ms, 3),
                    "steps": r.steps,
                }
                for h, r in results.items()
            },
        }

    r = astar_trace(grid, start, goal, heuristic=req.heuristic,
                    max_expansions=req.max_expansions)
    return {
        "mode": "single",
        "grid": grid.to_dict(),
        "start": list(start),
        "goal": list(goal),
        "heuristic": req.heuristic,
        "success": r.success,
        "path": [list(p) for p in r.path],
        "cost": _safe(r.cost),
        "nodes_expanded": r.nodes_expanded,
        "runtime_ms": round(r.runtime_ms, 3),
        "steps": r.steps,
    }


class CBSRequest(BaseModel):
    grid: GridSpec
    agents: list[dict[str, Any]]  # [{id, start:[x,y], goal:[x,y]}]
    max_iterations: int = 100


@arena_router.post("/cbs")
def arena_cbs(req: CBSRequest):
    grid = _resolve_grid(req.grid)
    if not req.agents:
        raise HTTPException(400, "Provide at least one agent")

    agents_dict = {}
    for a in req.agents:
        aid = str(a["id"])
        s = a["start"]
        g = a["goal"]
        agents_dict[aid] = ((s[0], s[1]), (g[0], g[1]))

    t0 = time.perf_counter()
    result = cbs_search(grid, agents_dict, max_iterations=req.max_iterations)  # type: ignore[arg-type]
    runtime_ms = (time.perf_counter() - t0) * 1000.0

    return {
        "grid": grid.to_dict(),
        "agents": [
            {"id": aid, "start": list(agents_dict[aid][0]),
             "goal": list(agents_dict[aid][1])}
            for aid in agents_dict
        ],
        "success": result.success,
        "paths": {a: [list(p) for p in path] for a, path in result.paths.items()},
        "total_cost": _safe(result.total_cost),
        "makespan": result.makespan,
        "conflicts_resolved": result.conflicts_resolved,
        "tree_log": result.tree_log,
        "runtime_ms": round(runtime_ms, 3),
    }


# ════════════════════════════════════════════════════════════════
# THEATER — AI-vs-AI spectator using existing game engine
# ════════════════════════════════════════════════════════════════

from game.engine import (
    create_game, get_game, plan_paths, execute_turn,
    ai_mastermind_plan, GameStatus,
)


class TheaterStartRequest(BaseModel):
    pass


@theater_router.post("/start")
def theater_start(_: TheaterStartRequest = TheaterStartRequest()):
    """Create an AI-vs-AI game, let the mastermind AI plan, return full setup + plan."""
    game = create_game("ai_vs_ai")
    plan_result = ai_mastermind_plan(game)
    # Extract the auto-chosen waypoints from what the planner stored on crew
    waypoints = {a: list(p) for a, p in game.current_waypoints.items()} if hasattr(game, 'current_waypoints') else {}
    narration = _build_plan_narration(plan_result)

    return {
        "game_id": game.game_id,
        "building": game.building.to_dict(),
        "state": game.to_dict(perspective="spectator"),
        "plan": {
            "success": plan_result.success,
            "waypoints": waypoints,
            "paths": {a: [list(p) for p in path] for a, path in plan_result.paths.items()} if plan_result.success else {},
            "total_cost": _safe(plan_result.total_cost),
            "makespan": plan_result.makespan,
            "conflicts_resolved": plan_result.conflicts_resolved,
            "tree_log": plan_result.tree_log,
            "narration": narration,
        },
    }


def _build_plan_narration(result) -> list[dict]:
    """Convert CBS tree_log into human-readable narration events."""
    narration = []
    for event in result.tree_log:
        etype = event.get("type")
        if etype == "cbs_root":
            narration.append({
                "type": "plan",
                "text": f"Crew plans computed independently. Initial cost: {round(event.get('cost', 0), 1)}",
            })
        elif etype == "cbs_conflict":
            narration.append({
                "type": "conflict",
                "text": f"Conflict detected between {event.get('agent1')} and {event.get('agent2')} at cell {event.get('cell')} time {event.get('time')}",
            })
        elif etype == "cbs_branch":
            narration.append({
                "type": "resolve",
                "text": f"Re-planning {event.get('agent')} with new constraint",
            })
    return narration


@theater_router.post("/{game_id}/turn")
def theater_turn(game_id: str):
    """Advance one full turn in an AI-vs-AI game. Returns full turn trace."""
    game = get_game(game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    if game.status in (GameStatus.WON, GameStatus.LOST):
        return {
            "game_over": True,
            "status": game.status.value,
            "score": game.score,
        }

    # If no current plan, let AI plan one
    plan_result = None
    if not game.current_paths:
        plan_result = ai_mastermind_plan(game)

    turn_result = execute_turn(game)

    return {
        "game_over": game.status in (GameStatus.WON, GameStatus.LOST),
        "status": game.status.value,
        "turn": turn_result.turn,
        "score": turn_result.score,
        "alert_level": turn_result.alert_level,
        "crew_positions": {a: list(p) for a, p in turn_result.crew_positions.items()},
        "guard_positions": {g: list(p) for g, p in turn_result.guard_positions.items()},
        "sensor_events": [
            _normalize_sensor_event(e) for e in turn_result.sensor_events
        ],
        "detections": turn_result.detections,
        "objectives_completed": turn_result.objectives_completed,
        "bayesian_heatmap": turn_result.bayesian_heatmap,
        "warden_action": turn_result.warden_action,
        "minimax_log": turn_result.minimax_log,
        "event_log": turn_result.event_log[-10:],
        "ai_plan": {
            "narration": _build_plan_narration(plan_result),
            "tree_log": plan_result.tree_log,
            "paths": {a: [list(p) for p in path] for a, path in plan_result.paths.items()} if plan_result.success else {},
        } if plan_result else None,
    }


# ════════════════════════════════════════════════════════════════
# BENCH — MAPF benchmark harness with CSV export
# ════════════════════════════════════════════════════════════════

class BenchRequest(BaseModel):
    grid: GridSpec
    num_agents: int = 5
    num_trials: int = 10
    seed: int | None = 42
    max_iterations: int = 100


@bench_router.post("/run")
def bench_run(req: BenchRequest):
    """Run N random MAPF trials on a map, return per-trial stats."""
    grid = _resolve_grid(req.grid)
    rng = random.Random(req.seed or 42)

    # Check enough walkable cells
    walkable = sum(sum(1 for c in row if c) for row in grid.cells)
    needed = req.num_agents * 2
    if walkable < needed:
        raise HTTPException(400, f"Grid has only {walkable} walkable cells, need {needed}")

    results: list[dict] = []
    for trial in range(req.num_trials):
        # Generate distinct random start/goal pairs
        used: set[tuple[int, int]] = set()
        agents_dict: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {}
        for i in range(req.num_agents):
            while True:
                s = grid.random_walkable(rng)
                if s not in used:
                    used.add(s); break
            while True:
                g = grid.random_walkable(rng)
                if g not in used and g != s:
                    used.add(g); break
            agents_dict[f"a{i}"] = (s, g)

        t0 = time.perf_counter()
        try:
            r = cbs_search(grid, agents_dict, max_iterations=req.max_iterations)  # type: ignore[arg-type]
            runtime = (time.perf_counter() - t0) * 1000.0
            results.append({
                "trial": trial,
                "num_agents": req.num_agents,
                "success": r.success,
                "total_cost": _safe(r.total_cost),
                "makespan": r.makespan,
                "conflicts_resolved": r.conflicts_resolved,
                "runtime_ms": round(runtime, 3),
                "ct_nodes": sum(1 for e in r.tree_log if e.get("type") == "cbs_root"
                                or e.get("type") == "cbs_branch"),
            })
        except Exception as e:
            results.append({
                "trial": trial,
                "num_agents": req.num_agents,
                "success": False,
                "error": str(e),
                "runtime_ms": round((time.perf_counter() - t0) * 1000.0, 3),
            })

    # Aggregate
    successes = [r for r in results if r.get("success")]
    summary = {
        "total_trials": len(results),
        "successful": len(successes),
        "success_rate": round(len(successes) / max(1, len(results)), 3),
        "avg_runtime_ms": round(sum(r["runtime_ms"] for r in results) / max(1, len(results)), 3),
        "avg_cost": round(sum(r.get("total_cost", 0) for r in successes) / max(1, len(successes)), 2) if successes else 0,
        "avg_makespan": round(sum(r.get("makespan", 0) for r in successes) / max(1, len(successes)), 2) if successes else 0,
        "avg_conflicts": round(sum(r.get("conflicts_resolved", 0) for r in successes) / max(1, len(successes)), 2) if successes else 0,
    }
    return {
        "grid": {"name": grid.name, "width": grid.width, "height": grid.height},
        "config": {"num_agents": req.num_agents, "num_trials": req.num_trials, "seed": req.seed},
        "summary": summary,
        "results": results,
    }


class BenchExportRequest(BaseModel):
    results: list[dict]


@bench_router.post("/export")
def bench_export(req: BenchExportRequest):
    """Convert benchmark results to CSV and return as downloadable file."""
    if not req.results:
        raise HTTPException(400, "No results to export")
    buf = io.StringIO()
    keys = ["trial", "num_agents", "success", "total_cost", "makespan",
            "conflicts_resolved", "runtime_ms", "ct_nodes"]
    writer = csv.DictWriter(buf, fieldnames=keys, extrasaction="ignore")
    writer.writeheader()
    for r in req.results:
        writer.writerow(r)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mapf_benchmark.csv"},
    )
