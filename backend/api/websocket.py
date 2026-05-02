"""
Heist Architect — WebSocket for streaming game steps + events
"""
import math
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from game.engine import get_game, plan_paths, execute_turn, ai_mastermind_plan, use_ability
from game.engine import GOD_MODE
import json
import asyncio

ws_router = APIRouter()


def _safe_float(v: float) -> float:
    if math.isinf(v) or math.isnan(v):
        return 0.0
    return v


def _build_narration(step_data: dict, prev_positions: dict | None = None) -> list[dict]:
    """Generate human-readable narration entries from a step result."""
    entries: list[dict] = []

    # Movement narration
    crew_pos = step_data.get("crew_positions", {})
    if prev_positions:
        for agent_id, pos in crew_pos.items():
            prev = prev_positions.get(agent_id)
            if prev and (prev[0] != pos[0] or prev[1] != pos[1]):
                role = agent_id.split("_")[0].capitalize() if "_" in agent_id else agent_id
                entries.append({
                    "type": "move",
                    "text": f"{role} moves to ({pos[0]}, {pos[1]})",
                })

    # Sensor events
    for ev in step_data.get("sensor_events", []):
        event_type = ev.get("event_type", "sensor")
        pos = ev.get("pos", ["?", "?"])
        x = pos[0] if isinstance(pos, list) and len(pos) > 0 else "?"
        y = pos[1] if isinstance(pos, list) and len(pos) > 1 else "?"
        entries.append({
            "type": "sensor",
            "text": f"{event_type.replace('_', ' ').title()} at ({x}, {y})",
        })

    # Detections
    for det in step_data.get("detections", []):
        entries.append({
            "type": "warden",
            "text": f"Guard spotted {det.get('agent_id', 'agent')} at ({det.get('x', '?')}, {det.get('y', '?')})",
        })

    # Alert changes
    alert_msg = step_data.get("alert_message", "")
    if alert_msg:
        entries.append({
            "type": "alert",
            "text": alert_msg,
        })

    return entries


def _build_turn_narration(result) -> list[dict]:
    """Generate narration for the final turn summary."""
    entries: list[dict] = []

    if result.objectives_completed:
        for obj in result.objectives_completed:
            entries.append({"type": "objective", "text": f"Objective completed: {obj}"})

    if result.warden_action:
        action_type = result.warden_action.get("type", "")
        if action_type:
            entries.append({"type": "warden", "text": f"Warden orders: {action_type.replace('_', ' ')}"})

    for log_entry in result.event_log[-5:]:
        entries.append({"type": "info", "text": log_entry})

    return entries


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
                waypoints_raw = data.get("waypoints", {})
                waypoints = {
                    k: (v[0], v[1]) for k, v in waypoints_raw.items()
                }
                result = plan_paths(game, waypoints)

                # Stream CBS tree events (CBS uses A* internally)
                for event in result.tree_log:
                    await websocket.send_json({
                        "type": "cbs_event",
                        **event,
                    })
                    await asyncio.sleep(0.08)

                # CSP dependency info
                csp_info = []
                if game.dependencies:
                    from algorithms.csp import validate_dependencies
                    dep_valid = validate_dependencies(game.dependencies, result.paths if result.success else {})
                    for dep in game.dependencies:
                        csp_info.append({
                            "prereq": dep.prereq_agent,
                            "dependent": dep.dependent_agent,
                            "description": dep.description,
                            "satisfied": dep_valid,
                        })

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
                        "csp": csp_info if csp_info else "No dependency constraints active",
                    },
                })

            elif action == "execute":
                result = execute_turn(game)
                prev_pos = None

                # Stream each step for smooth animation
                for step in result.steps:
                    step_data = {
                        "type": "step",
                        "step": step.step,
                        "crew_positions": step.crew_positions,
                        "guard_positions": step.guard_positions,
                        "sensor_events": step.sensor_events,
                        "detections": step.detections,
                        "alert_level": step.alert_level,
                        "alert_message": step.alert_message,
                        "game_status": step.game_status,
                    }
                    step_data["narration"] = _build_narration(step_data, prev_pos)
                    step_data["step_total"] = len(result.steps)
                    prev_pos = step.crew_positions
                    await websocket.send_json(step_data)
                    await asyncio.sleep(0.25)  # fast enough for smooth animation

                # Final turn summary with all algorithm info
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
                }
                turn_data["narration"] = _build_turn_narration(result)
                await websocket.send_json(turn_data)

            elif action == "ability":
                agent_id = data.get("agent_id", "")
                ability_name = data.get("ability", "")
                target = data.get("target")
                result = use_ability(game, agent_id, ability_name, target)
                await websocket.send_json({
                    "type": "ability_result",
                    **result,
                    "crew": [c.to_dict() for c in game.crew],
                    "guards": [g.to_dict() for g in game.guards],
                    "event_log": game.event_log[-10:],
                        "objectives_completed": list(game.objectives_completed),
                })

            elif action == "ai_plan":
                result = ai_mastermind_plan(game)
                for event in result.tree_log:
                    await websocket.send_json({
                        "type": "cbs_event",
                        **event,
                    })
                    await asyncio.sleep(0.1)

                await websocket.send_json({
                    "type": "plan_complete",
                    "success": result.success,
                    "paths": result.paths,
                })

            elif action == "ai_step":
                plan_result = ai_mastermind_plan(game)
                for event in plan_result.tree_log:
                    await websocket.send_json({
                        "type": "cbs_event", **event,
                    })
                    await asyncio.sleep(0.05)

                if plan_result.success:
                    turn_result = execute_turn(game)
                    prev_pos = None

                    for step in turn_result.steps:
                        step_data = {
                            "type": "step",
                            "step": step.step,
                            "crew_positions": step.crew_positions,
                            "guard_positions": step.guard_positions,
                            "sensor_events": step.sensor_events,
                            "detections": step.detections,
                            "alert_level": step.alert_level,
                            "alert_message": step.alert_message,
                            "game_status": step.game_status,
                        }
                        step_data["narration"] = _build_narration(step_data, prev_pos)
                        step_data["step_total"] = len(turn_result.steps)
                        prev_pos = step.crew_positions
                        await websocket.send_json(step_data)
                        await asyncio.sleep(0.2)

                    turn_data = {
                        "type": "turn_result",
                        "turn": turn_result.turn,
                        "crew": [c.to_dict() for c in game.crew],
                        "guards": [g.to_dict() for g in game.guards],
                        "crew_positions": turn_result.crew_positions,
                        "guard_positions": turn_result.guard_positions,
                        "sensor_events": turn_result.sensor_events,
                        "detections": turn_result.detections,
                        "objectives_completed": turn_result.objectives_completed,
                        "bayesian_heatmap": turn_result.bayesian_heatmap,
                        "warden_action": turn_result.warden_action,
                        "game_status": turn_result.game_status,
                        "score": turn_result.score,
                        "alert_level": turn_result.alert_level,
                        "event_log": turn_result.event_log,
                        "algorithms_used": {
                            "bayesian": "Warden updated belief grid",
                            "warden": (turn_result.warden_action or {}).get("reason", "Warden held current posture"),
                        },
                    }
                    turn_data["narration"] = _build_turn_narration(turn_result)
                    await websocket.send_json(turn_data)

            elif action == "state":
                perspective = data.get("perspective", "spectator")
                await websocket.send_json({
                    "type": "state",
                    "state": game.to_dict(perspective=perspective),
                })

    except WebSocketDisconnect:
        pass
