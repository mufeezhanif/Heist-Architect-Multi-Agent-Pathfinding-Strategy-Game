"""FastAPI + WebSocket server for Heist Architect.

REST endpoints:
  POST /api/new_game      { mode }            -> initial snapshot
  GET  /api/snapshot                          -> current snapshot
  POST /api/plan          { goals: {tid: [r,c]} }  -> CBS result + snapshot
  POST /api/auto_plan                          -> AI Mastermind plans
  POST /api/step                               -> advance one turn (auto warden)
  POST /api/move_guard    { guard_id, pos }    -> human warden move
  POST /api/astar_preview { start, goal }      -> single A* visualization

WebSocket /ws streams turn updates when an "ai_vs_ai" game is auto-running.
"""
from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .game.grid import load_default_map
from .game.state import GameState, Phase
from .ai.astar import astar


app = FastAPI(title="Heist Architect")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# singleton game (single-session demo; fine for course project / LinkedIn)
# ---------------------------------------------------------------------------
class GameContainer:
    def __init__(self) -> None:
        self.state: Optional[GameState] = None
        self.ws_clients: set[WebSocket] = set()
        self.autorun_task: Optional[asyncio.Task] = None

    def require(self) -> GameState:
        if self.state is None:
            raise HTTPException(400, "No active game. POST /api/new_game first.")
        return self.state


CTX = GameContainer()


# ---------------------------------------------------------------------------
# request models
# ---------------------------------------------------------------------------
class NewGameReq(BaseModel):
    mode: str = "ai_vs_ai"   # ai_vs_ai | human_mastermind | human_warden | hotseat


class PlanReq(BaseModel):
    goals: dict[int, list[int]]


class MoveGuardReq(BaseModel):
    guard_id: int
    pos: list[int]


class AStarReq(BaseModel):
    start: list[int]
    goal: list[int]


# ---------------------------------------------------------------------------
# REST routes
# ---------------------------------------------------------------------------
@app.post("/api/new_game")
async def new_game(req: NewGameReq):
    if CTX.autorun_task and not CTX.autorun_task.done():
        CTX.autorun_task.cancel()
    gmap = load_default_map()
    CTX.state = GameState.new(gmap, mode=req.mode)
    CTX.state.phase = Phase.PLANNING
    return CTX.state.snapshot()


@app.get("/api/snapshot")
async def snapshot():
    return CTX.require().snapshot()


@app.post("/api/plan")
async def plan(req: PlanReq):
    st = CTX.require()
    goals = {int(k): tuple(v) for k, v in req.goals.items()}
    res = st.plan_thief_paths(goals)
    if res is None:
        raise HTTPException(400, "CBS failed to find a solution")
    st.phase = Phase.EXECUTION
    snap = st.snapshot()
    snap["cbs"] = {
        "conflicts": res.conflicts,
        "expanded_nodes": res.expanded_nodes,
        "paths": {k: [list(p) for p in v] for k, v in res.paths.items()},
    }
    await broadcast({"type": "plan", "payload": snap})
    return snap


@app.post("/api/auto_plan")
async def auto_plan():
    st = CTX.require()
    res = st.auto_plan_thieves()
    if res is None:
        raise HTTPException(400, "No thieves to plan for")
    st.phase = Phase.EXECUTION
    snap = st.snapshot()
    snap["cbs"] = {
        "conflicts": res.conflicts,
        "expanded_nodes": res.expanded_nodes,
        "paths": {k: [list(p) for p in v] for k, v in res.paths.items()},
    }
    await broadcast({"type": "plan", "payload": snap})
    return snap


@app.post("/api/step")
async def step():
    st = CTX.require()
    if st.phase == Phase.FINISHED:
        return st.snapshot()
    # If thieves have run out of plan (e.g. reached vault), replan to exit
    needs_replan = any(
        (not t.escaped and not t.caught and
         (not t.path or t.path_index + 1 >= len(t.path)))
        for t in st.thieves.values()
    )
    if needs_replan and st.mode in ("ai_vs_ai", "human_warden"):
        st.auto_plan_thieves()
    log = st.advance_turn()
    snap = st.snapshot()
    snap["turn_log"] = log
    await broadcast({"type": "step", "payload": snap})
    return snap


@app.post("/api/move_guard")
async def move_guard(req: MoveGuardReq):
    st = CTX.require()
    ok = st.move_guard(req.guard_id, tuple(req.pos))
    if not ok:
        raise HTTPException(400, "Illegal guard move")
    # After a human guard moves, resolve the rest of the turn
    # (thieves and Bayes already stepped as part of advance_turn earlier — so we
    # just do a capture check and end check here for human-warden mode)
    caps = st.check_captures()
    st.check_end()
    snap = st.snapshot()
    snap["captures"] = caps
    await broadcast({"type": "guard_move", "payload": snap})
    return snap


@app.post("/api/astar_preview")
async def astar_preview(req: AStarReq):
    st = CTX.require()
    res = astar(st.gmap, tuple(req.start), tuple(req.goal))
    if res is None:
        raise HTTPException(400, "No path")
    return {
        "path": [list(p) for p in res.path],
        "expanded": [list(p) for p in res.expanded],
        "cost": res.cost,
    }


@app.post("/api/autorun")
async def autorun(delay_ms: int = 400):
    """Kick off an AI-vs-AI full-game auto-step loop over WebSocket."""
    st = CTX.require()
    if st.mode != "ai_vs_ai":
        raise HTTPException(400, "autorun only available in ai_vs_ai mode")
    if CTX.autorun_task and not CTX.autorun_task.done():
        return {"status": "already_running"}

    async def _loop():
        try:
            # initial auto plan
            if st.phase != Phase.EXECUTION:
                st.auto_plan_thieves()
                st.phase = Phase.EXECUTION
                await broadcast({"type": "plan", "payload": st.snapshot()})
            while st.phase != Phase.FINISHED:
                # replan if necessary
                needs = any(
                    (not t.escaped and not t.caught and
                     (not t.path or t.path_index + 1 >= len(t.path)))
                    for t in st.thieves.values()
                )
                if needs:
                    st.auto_plan_thieves()
                    await broadcast({"type": "plan", "payload": st.snapshot()})
                log = st.advance_turn()
                snap = st.snapshot()
                snap["turn_log"] = log
                await broadcast({"type": "step", "payload": snap})
                await asyncio.sleep(delay_ms / 1000.0)
        except asyncio.CancelledError:
            pass

    CTX.autorun_task = asyncio.create_task(_loop())
    return {"status": "started"}


@app.post("/api/stop_autorun")
async def stop_autorun():
    if CTX.autorun_task and not CTX.autorun_task.done():
        CTX.autorun_task.cancel()
    return {"status": "stopped"}


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
async def broadcast(message: dict) -> None:
    dead: list[WebSocket] = []
    data = json.dumps(message)
    for ws in CTX.ws_clients:
        try:
            await ws.send_text(data)
        except Exception:
            dead.append(ws)
    for d in dead:
        CTX.ws_clients.discard(d)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    CTX.ws_clients.add(ws)
    try:
        if CTX.state is not None:
            await ws.send_text(json.dumps({"type": "snapshot",
                                            "payload": CTX.state.snapshot()}))
        while True:
            # we don't require incoming messages, but keep alive
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        CTX.ws_clients.discard(ws)


@app.get("/")
async def root():
    return {"service": "heist-architect", "status": "ok"}
