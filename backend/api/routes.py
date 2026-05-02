"""
Heist Architect — REST API endpoints
"""
import math

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from game.engine import (
    GameStatus,
    ai_mastermind_plan,
    create_game,
    execute_turn,
    get_game,
    plan_paths,
)

router = APIRouter()


def _safe_float(v: float) -> float:
    """Replace inf/nan with 0.0 for JSON serialization."""
    return 0.0 if (math.isinf(v) or math.isnan(v)) else v


def _plan_response(result) -> dict:
    """Serialize a CBSResult into a JSON-safe dict."""
    return {
        "success": result.success,
        "paths": result.paths,
        "total_cost": _safe_float(result.total_cost),
        "makespan": _safe_float(result.makespan),
        "conflicts_resolved": result.conflicts_resolved,
        "tree_log": result.tree_log,
    }


# ── Request models ────────────────────────────────────────────────────────────

class CreateGameRequest(BaseModel):
    mode: str = "pva_mastermind"  # or "ai_vs_ai"


class PlanRequest(BaseModel):
    waypoints: dict[str, list[int]]  # agent_id → [x, y]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/create")
def create_game_endpoint(req: CreateGameRequest):
    game = create_game(req.mode)
    return {
        "game_id": game.game_id,
        "building": game.building.to_dict(),
        "state": game.to_dict(perspective="mastermind"),
    }


@router.get("/{game_id}/state")
def get_state(game_id: str, perspective: str = "mastermind"):
    game = get_game(game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    return game.to_dict(perspective=perspective)


@router.get("/{game_id}/building")
def get_building(game_id: str):
    game = get_game(game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    return game.building.to_dict()


@router.post("/{game_id}/plan")
def plan_endpoint(game_id: str, req: PlanRequest):
    game = get_game(game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    if game.status not in (GameStatus.PLANNING, GameStatus.EXECUTING):
        raise HTTPException(400, f"Game is in {game.status.value} phase")

    waypoints = {agent_id: (coords[0], coords[1]) for agent_id, coords in req.waypoints.items()}
    return _plan_response(plan_paths(game, waypoints))


@router.post("/{game_id}/execute")
def execute_endpoint(game_id: str):
    game = get_game(game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    if game.status not in (GameStatus.EXECUTING, GameStatus.PLANNING):
        raise HTTPException(400, f"Game is {game.status.value}")

    result = execute_turn(game)
    return {
        "turn": result.turn,
        "crew_positions": result.crew_positions,
        "guard_positions": result.guard_positions,
        "sensor_events": result.sensor_events,
        "detections": result.detections,
        "objectives_completed": result.objectives_completed,
        "bayesian_heatmap": result.bayesian_heatmap,
        "warden_action": result.warden_action,
        "game_status": result.game_status,
        "score": result.score,
        "alert_level": result.alert_level,
        "event_log": result.event_log,
    }


@router.post("/{game_id}/ai-plan")
def ai_plan_endpoint(game_id: str):
    """AI Mastermind automatically plans paths (used in AI vs AI mode)."""
    game = get_game(game_id)
    if not game:
        raise HTTPException(404, "Game not found")
    return _plan_response(ai_mastermind_plan(game))
