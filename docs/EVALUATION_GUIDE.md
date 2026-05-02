# Evaluation Guide - Quick Reference

## Overview
This guide helps you navigate the three detailed documentation files created for your project evaluation.

---

## Documentation Files

### 1. **FRONTEND_FLOW.md** (12KB)
**What it covers:** Complete frontend architecture and data flow

**Key sections to study:**
- State Management (Zustand store) - How all game state is managed
- API Client (REST + WebSocket) - How frontend communicates with backend
- User Interaction Flow - Step-by-step user actions
- Component Hierarchy - How React components are organized
- Animation System - How smooth movement is achieved

**Best for explaining:**
- "How does the UI update when the backend sends data?"
- "What happens when a user clicks to move an agent?"
- "How are CBS tree events visualized in real-time?"

---

### 2. **BACKEND_FLOW.md** (18KB)
**What it covers:** Complete backend architecture and game logic

**Key sections to study:**
- REST API Routes - All endpoints and what they do
- WebSocket Handler - Real-time message types
- Game Engine - Core game loop and turn execution
- Game Entities - Building, agents, guards, sensors
- Alert System - How suspicion and alert levels work

**Best for explaining:**
- "How does the backend manage game state?"
- "What happens during turn execution?"
- "How do abilities work internally?"
- "How are guards and sensors implemented?"

---

### 3. **ALGORITHMS_DETAILED.md** (24KB)
**What it covers:** Deep dive into all AI algorithms

**Key sections to study:**
- A* Search - Pathfinding for single agent
- CBS - Multi-agent collision-free planning
- CSP - Temporal constraint enforcement
- Bayesian - Probability tracking for Warden
- Warden AI - Heuristic response system

**Best for explaining:**
- "How does A* find the shortest path?"
- "How does CBS resolve conflicts between agents?"
- "How does Bayesian tracking work?"
- "What is the complexity of each algorithm?"

---

## Quick Study Plan

### **30-Minute Overview:**
1. Read FRONTEND_FLOW.md "User Interaction Flow" section (5 min)
2. Read BACKEND_FLOW.md "Game Engine" section (10 min)
3. Read ALGORITHMS_DETAILED.md "Key Takeaways" section (5 min)
4. Review all "Example Execution" boxes (10 min)

### **1-Hour Deep Dive:**
1. Frontend: State Management + API Client (15 min)
2. Backend: REST Routes + WebSocket Handler (15 min)
3. Algorithms: A* + CBS detailed explanations (20 min)
4. Practice explaining one complete flow end-to-end (10 min)

### **2-Hour Complete Study:**
1. Read FRONTEND_FLOW.md completely (30 min)
2. Read BACKEND_FLOW.md completely (40 min)
3. Read ALGORITHMS_DETAILED.md completely (50 min)

---

## Key Concepts to Master

### **Frontend:**
- Zustand store is single source of truth
- WebSocket provides real-time bidirectional communication
- State updates trigger React re-renders
- CSS transitions handle smooth animations

### **Backend:**
- FastAPI handles REST + WebSocket
- Game state stored in memory dict
- Turn execution is step-by-step for animation
- All algorithms integrated in game engine

### **Algorithms:**
- A* uses heuristic for efficient pathfinding
- CBS branches on conflicts to find optimal solution
- CSP propagates temporal constraints to spatial domain
- Bayesian uses Bayes' theorem to update beliefs
- Warden AI uses greedy heuristic based on Bayesian belief

---

## Common Evaluation Questions

### **Architecture Questions:**

**Q: How do frontend and backend communicate?**
A: REST API for initial setup (create game, get state), WebSocket for real-time updates during gameplay (planning, execution, abilities).

**Q: Where is game state stored?**
A: Backend stores authoritative state in memory dict `_games[game_id]`. Frontend stores local copy in Zustand store, updated via WebSocket.

**Q: How is real-time animation achieved?**
A: Backend sends step-by-step updates via WebSocket. Frontend updates agent positions in store, CSS transitions animate the movement smoothly.

### **Algorithm Questions:**

**Q: Why use CBS instead of planning each agent separately?**
A: Separate planning causes collisions. CBS ensures collision-free paths while maintaining optimality.

**Q: How does Bayesian tracking help the Warden?**
A: Warden doesn't see thieves directly (fog of war). Bayesian tracking maintains probability distribution over grid using sensor observations, allowing intelligent guard movement.

**Q: What's the role of CSP in the game?**
A: Enforces mission logic like "hacker must disable alarm before thief enters vault" by generating constraints for CBS.

### **Implementation Questions:**

**Q: How are paths visualized on the frontend?**
A: CBS returns paths as arrays of coordinates. Frontend draws them as SVG bezier curves on the game board.

**Q: How does the alert system work?**
A: Detections add suspicion points. Suspicion thresholds trigger alert levels (GREEN→YELLOW→RED→LOCKDOWN). Higher alerts give guards more vision and aggressive behavior.

**Q: How are abilities implemented?**
A: Backend validates ability usage (cooldown, uses remaining, range). Executes effect (knock out guard, disable camera, etc.). Updates game state. Sends result to frontend.

---

## Data Flow Examples

### **Complete Planning Flow:**
```
User clicks waypoint
  → Frontend: setWaypoint() updates Zustand store
  → Frontend: User clicks "Plan"
  → Frontend: sendWS({action: "plan", waypoints})
  → Backend: Receives WebSocket message
  → Backend: Calls plan_paths(game, waypoints)
  → Backend: CSP generates temporal constraints
  → Backend: CBS runs (calls A* for each agent, resolves conflicts)
  → Backend: Streams CBS events via WebSocket
  → Frontend: Receives cbs_event messages, updates tree visualization
  → Backend: Sends plan_complete with paths
  → Frontend: Receives paths, calls setPaths()
  → Frontend: GameBoard2D re-renders with path lines
```

### **Complete Execution Flow:**
```
User clicks "Execute"
  → Frontend: sendWS({action: "execute"})
  → Backend: Calls execute_turn(game)
  → Backend: For each step:
      - Move crew along paths
      - Move guards on patrols
      - Check sensors
      - Check detections
      - Update alert
      - Send step message via WebSocket
  → Frontend: Receives step messages
  → Frontend: Updates crew/guard positions in store
  → Frontend: CSS transitions animate movement
  → Backend: After all steps:
      - Bayesian update with sensor observations
      - Warden AI responds
      - Check objectives
      - Check win/loss
      - Send turn_result via WebSocket
  → Frontend: Receives turn_result
  → Frontend: Updates score, alert, heatmap
  → Frontend: Clears paths, returns to planning
```

---

## Demonstration Tips

### **Show Frontend Flow:**
1. Open browser dev tools → Network tab → WS
2. Click waypoint → Show state update in React DevTools
3. Click "Plan" → Show WebSocket messages in Network tab
4. Point out CBS events streaming in real-time
5. Show paths appearing on board

### **Show Backend Flow:**
1. Add print statements in execute_turn()
2. Show step-by-step execution in terminal
3. Show Bayesian grid values
4. Show Warden AI decision-making

### **Show Algorithm Integration:**
1. Set waypoints that will conflict
2. Show CBS detecting conflict in tree visualization
3. Show CBS branching to resolve conflict
4. Explain how A* is called for each branch
5. Show final collision-free paths

---

## Complexity Cheat Sheet

| Component | Complexity | Why |
|-----------|-----------|-----|
| A* | O(b^d) | Explores branching factor b to depth d |
| CBS | Exponential worst-case | NP-hard problem, but efficient in practice |
| CSP | O(n × d) | n agents, d dependencies |
| Bayesian | O(W × H × obs) | Grid size × observations |
| Warden AI | O(guards) | Greedy heuristic |

---

## Final Checklist

Before evaluation, make sure you can explain:

- [ ] How Zustand store manages state
- [ ] How WebSocket enables real-time updates
- [ ] How REST API initializes the game
- [ ] How turn execution works step-by-step
- [ ] How A* finds shortest path with heuristic
- [ ] How CBS resolves conflicts between agents
- [ ] How CSP enforces temporal dependencies
- [ ] How Bayesian tracking updates beliefs
- [ ] How Warden AI responds to beliefs
- [ ] How all algorithms integrate in game engine
- [ ] How frontend visualizes algorithm execution
- [ ] How abilities are validated and executed
- [ ] How alert system escalates with detections
- [ ] How win/loss conditions are checked

---

## Good Luck!

Remember:
- **Understand the flow, not just the code**
- **Use examples to explain concepts**
- **Draw diagrams if needed**
- **Connect theory to implementation**
- **Show how algorithms solve game problems**

The documentation is detailed but concise. Each section has examples and explanations suitable for evaluation. Focus on understanding the "why" behind each design decision.
