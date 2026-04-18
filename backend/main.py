"""
Heist Architect — Backend Entry Point
FastAPI application serving game logic and AI algorithms.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from api.websocket import ws_router

app = FastAPI(
    title="Heist Architect",
    description="Multi-Agent Pathfinding Strategy Game API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/game", tags=["game"])
app.include_router(ws_router, tags=["websocket"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
