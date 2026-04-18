"""
Heist Architect — WebSocket for streaming CBS steps + game events
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from game.engine import get_game, plan_paths, execute_turn, ai_mastermind_plan
import json
import asyncio

ws_router = APIRouter()


@ws_router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str):
    """
    WebSocket connection for real-time game updates.

    Client sends:
      {"action": "plan", "waypoints": {"hacker": [10, 3], ...}}
      {"action": "execute"}
      {"action": "ai_plan"}
      {"action": "ai_step"}  — one full AI vs AI turn

    Server streams:
      CBS tree log events (one per step for animation)
      Turn results
      Bayesian heatmap updates
    """
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

                # Stream CBS tree log events one by one for animation
                for event in result.tree_log:
                    await websocket.send_json({
                        "type": "cbs_event",
                        **event,
                    })
                    await asyncio.sleep(0.3)  # Animation delay

                await websocket.send_json({
                    "type": "plan_complete",
                    "success": result.success,
                    "paths": result.paths,
                    "total_cost": result.total_cost,
                    "makespan": result.makespan,
                    "conflicts_resolved": result.conflicts_resolved,
                })

            elif action == "execute":
                result = execute_turn(game)
                await websocket.send_json({
                    "type": "turn_result",
                    "turn": result.turn,
                    "crew_positions": result.crew_positions,
                    "guard_positions": result.guard_positions,
                    "sensor_events": result.sensor_events,
                    "detections": result.detections,
                    "objectives_completed": result.objectives_completed,
                    "bayesian_heatmap": result.bayesian_heatmap,
                    "warden_action": result.warden_action,
                    "minimax_log": result.minimax_log,
                    "game_status": result.game_status,
                    "score": result.score,
                })

            elif action == "ai_plan":
                result = ai_mastermind_plan(game)
                for event in result.tree_log:
                    await websocket.send_json({
                        "type": "cbs_event",
                        **event,
                    })
                    await asyncio.sleep(0.2)

                await websocket.send_json({
                    "type": "plan_complete",
                    "success": result.success,
                    "paths": result.paths,
                })

            elif action == "ai_step":
                # Full AI vs AI step: AI plans + execute
                plan_result = ai_mastermind_plan(game)
                for event in plan_result.tree_log:
                    await websocket.send_json({
                        "type": "cbs_event", **event,
                    })
                    await asyncio.sleep(0.15)

                if plan_result.success:
                    turn_result = execute_turn(game)
                    await websocket.send_json({
                        "type": "turn_result",
                        "turn": turn_result.turn,
                        "crew_positions": turn_result.crew_positions,
                        "guard_positions": turn_result.guard_positions,
                        "sensor_events": turn_result.sensor_events,
                        "detections": turn_result.detections,
                        "objectives_completed": turn_result.objectives_completed,
                        "bayesian_heatmap": turn_result.bayesian_heatmap,
                        "warden_action": turn_result.warden_action,
                        "minimax_log": turn_result.minimax_log,
                        "game_status": turn_result.game_status,
                        "score": turn_result.score,
                    })

            elif action == "state":
                perspective = data.get("perspective", "spectator")
                await websocket.send_json({
                    "type": "state",
                    "state": game.to_dict(perspective=perspective),
                })

    except WebSocketDisconnect:
        pass
