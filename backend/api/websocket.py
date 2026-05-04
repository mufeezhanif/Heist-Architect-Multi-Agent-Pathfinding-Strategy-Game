import asyncio
import json
import math

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from game.engine import (
    GOD_MODE,
    GameState,
    TurnResult,
    ai_mastermind_plan,
    execute_turn,
    get_game,
    plan_paths,
    use_ability,
)

ws_router = APIRouter()


def _safe_float(v: float) -> float:
    """Replace inf/nan with 0.0 for JSON serialization."""
    return 0.0 if (math.isinf(v) or math.isnan(v)) else v


def _build_step_narration(step_data: dict, prev_positions: dict | None = None) -> list[dict]:
    """Generate human-readable narration entries for a single movement step."""
    entries: list[dict] = []


    for agent_id, pos in step_data.get("crew_positions", {}).items():
        prev = (prev_positions or {}).get(agent_id)
        if prev and (prev[0] != pos[0] or prev[1] != pos[1]):
            role = agent_id.split("_")[0].capitalize() if "_" in agent_id else agent_id
            entries.append({"type": "move", "text": f"{role} moves to ({pos[0]}, {pos[1]})"})


    for ev in step_data.get("sensor_events", []):
        pos = ev.get("pos", ["?", "?"])
        x, y = (pos[0], pos[1]) if len(pos) >= 2 else ("?", "?")
        label = ev.get("event_type", "sensor").replace("_", " ").title()
        entries.append({"type": "sensor", "text": f"{label} at ({x}, {y})"})


    for det in step_data.get("detections", []):
        entries.append({
            "type": "warden",
            "text": f"Guard spotted {det.get('agent_id', 'agent')} at ({det.get('x', '?')}, {det.get('y', '?')})",
        })


    if alert_msg := step_data.get("alert_message", ""):
        entries.append({"type": "alert", "text": alert_msg})

    return entries


def _build_turn_narration(result: TurnResult) -> list[dict]:
    """Generate narration for the end-of-turn summary."""
    entries: list[dict] = []

    for obj in result.objectives_completed:
        entries.append({"type": "objective", "text": f"Objective completed: {obj}"})

    if action_type := (result.warden_action or {}).get("type", ""):
        entries.append({"type": "warden", "text": f"Warden orders: {action_type.replace('_', ' ')}"})

    for log_entry in result.event_log[-5:]:
        entries.append({"type": "info", "text": log_entry})

    return entries


async def _stream_cbs_events(websocket: WebSocket, tree_log: list[dict], delay: float = 0.08):
    """Stream CBS tree events one by one with a small delay for animation."""
    for event in tree_log:
        await websocket.send_json({"type": "cbs_event", **event})
        await asyncio.sleep(delay)


async def _stream_steps(websocket: WebSocket, result: TurnResult, step_delay: float = 0.25):
    """Stream each movement step of a turn for smooth frontend animation."""
    prev_pos: dict | None = None
    for step in result.steps:
        step_data = {
            "type": "step",
            "step": step.step,
            "step_total": len(result.steps),
            "crew_positions": step.crew_positions,
            "guard_positions": step.guard_positions,
            "sensor_events": step.sensor_events,
            "detections": step.detections,
            "alert_level": step.alert_level,
            "alert_message": step.alert_message,
            "game_status": step.game_status,
        }
        step_data["narration"] = _build_step_narration(step_data, prev_pos)
        prev_pos = dict(step.crew_positions)
        await websocket.send_json(step_data)
        await asyncio.sleep(step_delay)


async def _send_turn_result(websocket: WebSocket, game: GameState, result: TurnResult):
    """Send the final turn summary with all algorithm info."""
    turn_data = {
        "type": "turn_result",
        "turn": result.turn,
        "crew": [c.to_dict() for c in game.crew],
        "guards": [g.to_dict() for g in game.guards],
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
        "algorithms_used": {
            "bayesian": "Warden updated belief grid based on sensor data",
            "warden": (result.warden_action or {}).get("reason", "Warden held current posture"),
        },
        "narration": _build_turn_narration(result),
    }
    await websocket.send_json(turn_data)


@ws_router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str):
    await websocket.accept()

    game = get_game(game_id)
    if not game:
        await websocket.send_json({"error": "Game not found"})
        await websocket.close()
        return

    await websocket.send_json({
        "type": "connected",
        "game_id": game_id,
        "state": game.to_dict(perspective="spectator"),
        "god_mode": GOD_MODE,
    })

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")


            if action == "plan":
                waypoints = {k: (v[0], v[1]) for k, v in data.get("waypoints", {}).items()}
                result = plan_paths(game, waypoints)

                await _stream_cbs_events(websocket, result.tree_log)


                csp_info: list[dict] | str = "No dependency constraints active"
                if game.dependencies:
                    from algorithms.csp import validate_dependencies
                    satisfied = validate_dependencies(
                        game.dependencies, result.paths if result.success else {}
                    )
                    csp_info = [
                        {
                            "prereq": dep.prereq_agent,
                            "dependent": dep.dependent_agent,
                            "description": dep.description,
                            "satisfied": satisfied,
                        }
                        for dep in game.dependencies
                    ]

                await websocket.send_json({
                    "type": "plan_complete",
                    "success": result.success,
                    "paths": result.paths,
                    "total_cost": _safe_float(result.total_cost),
                    "makespan": _safe_float(result.makespan),
                    "conflicts_resolved": result.conflicts_resolved,
                    "algorithms_used": {
                        "astar": f"A* computed shortest paths for {len(waypoints)} agents",
                        "cbs": f"CBS resolved {result.conflicts_resolved} conflicts between agents",
                        "csp": csp_info,
                    },
                })


            elif action == "execute":
                result = execute_turn(game)
                await _stream_steps(websocket, result)
                await _send_turn_result(websocket, game, result)


            elif action == "ability":
                ability_result = use_ability(
                    game,
                    agent_id=data.get("agent_id", ""),
                    ability=data.get("ability", ""),
                    target=data.get("target"),
                )
                await websocket.send_json({
                    "type": "ability_result",
                    **ability_result,
                    "crew": [c.to_dict() for c in game.crew],
                    "guards": [g.to_dict() for g in game.guards],
                    "event_log": game.event_log[-10:],
                    "objectives_completed": list(game.objectives_completed),
                })


            elif action == "ai_plan":
                result = ai_mastermind_plan(game)
                await _stream_cbs_events(websocket, result.tree_log, delay=0.1)
                await websocket.send_json({
                    "type": "plan_complete",
                    "success": result.success,
                    "paths": result.paths,
                })


            elif action == "ai_step":
                plan_result = ai_mastermind_plan(game)
                await _stream_cbs_events(websocket, plan_result.tree_log, delay=0.05)

                if plan_result.success:
                    turn_result = execute_turn(game)
                    await _stream_steps(websocket, turn_result, step_delay=0.2)
                    await _send_turn_result(websocket, game, turn_result)


            elif action == "state":
                perspective = data.get("perspective", "spectator")
                await websocket.send_json({
                    "type": "state",
                    "state": game.to_dict(perspective=perspective),
                })

    except WebSocketDisconnect:
        pass
