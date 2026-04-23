"""
Heist Architect — Backend Entry Point
FastAPI application serving game logic and AI algorithms.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from api.websocket import ws_router
from api.observatory import arena_router, theater_router, bench_router

app = FastAPI(
    title="AI Observatory",
    description="Interactive multi-agent pathfinding & adversarial AI visualization",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/game", tags=["game-legacy"])
app.include_router(arena_router, prefix="/arena", tags=["arena"])
app.include_router(theater_router, prefix="/theater", tags=["theater"])
app.include_router(bench_router, prefix="/bench", tags=["bench"])
app.include_router(ws_router, tags=["websocket"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
