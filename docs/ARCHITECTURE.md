# Architecture

## System diagram

```mermaid
flowchart LR
    subgraph Browser
        UI[React App<br/>App.jsx]
        Phaser[Phaser 3 Scene<br/>MainScene.js]
        UI -->|state| Phaser
        Phaser -->|clicks| UI
    end

    subgraph Server[Python FastAPI / uvicorn]
        API[/REST + WebSocket<br/>main.py/]
        GS[GameState<br/>state.py]
        Map[GameMap<br/>grid.py]
        AStar[A* planner<br/>astar.py]
        CBS[CBS planner<br/>cbs.py]
        Bayes[BayesTracker<br/>bayes.py]
        MM[Minimax + α-β<br/>minimax.py]

        API --> GS
        GS --> Map
        GS --> CBS
        CBS --> AStar
        GS --> Bayes
        GS --> MM
        MM --> Bayes
    end

    UI <-->|/api REST| API
    UI <-.->|/ws JSON stream| API
```

## Turn data flow

```mermaid
sequenceDiagram
    participant U as Browser
    participant A as FastAPI
    participant G as GameState
    participant C as CBS
    participant B as Bayes
    participant M as Minimax

    U->>A: POST /api/new_game
    A->>G: GameState.new(map, mode)
    A-->>U: initial snapshot

    U->>A: POST /api/auto_plan
    A->>G: auto_plan_thieves()
    G->>C: cbs(starts, goals)
    C->>C: A* per agent + conflict tree
    C-->>G: conflict-free paths
    G-->>A: snapshot (+ cbs.conflicts)
    A-->>U: WS push "plan"

    loop every turn
        U->>A: POST /api/step
        A->>G: advance_turn()
        G->>G: step thieves 1 cell
        G->>B: predict()
        G->>B: update(sensor obs)
        G->>M: minimax_warden(belief)
        M-->>G: joint guard move
        G->>G: check captures + end
        G-->>A: snapshot + turn_log
        A-->>U: WS push "step"
    end
```

## Data model

| Concept       | Source                                               |
|---------------|------------------------------------------------------|
| Map           | `backend/app/game/grid.py` — `GameMap`, tiles, cams |
| Thief / Guard | `backend/app/game/state.py`                         |
| Path          | list of `(row, col)`; index = timestep              |
| Constraint    | tagged tuple: `("vertex", a, cell, t)` / `("edge", a, ca, cb, t)` |
| Belief        | dict[thief_id, np.ndarray(rows, cols)]              |

## Key design choices

1. **Distinct goals per agent.** CBS cannot settle two agents on the same
   terminal cell. We use a *vault zone* (vault + its neighbours) so three
   thieves get distinct approach cells; touching any zone cell grants loot.
2. **Space-time A* with wait.** Each state is `(cell, t)` with an allowed
   wait action; this lets CBS resolve head-on collisions without teleporting.
3. **Independent per-thief Bayes grids.** Keeping thieves' belief distributions
   independent loses mutual-exclusion information but keeps the model O(rows·cols)
   per thief instead of exponential.
4. **Minimax against a diffusion adversary.** Because the Warden doesn't know
   true thief positions, the opponent ply is modelled as one probability
   diffusion step and the Warden chooses the minimum of {current, diffused}
   scores — inexpensive but still adversarial.
