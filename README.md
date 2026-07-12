# HEIST ARCHITECT — Multi-Agent Pathfinding Strategy Game

## One-Line Pitch

> A turn-based strategy game where you plan and execute a multi-agent heist using Conflict-Based Search (CBS) to route your crew through a guarded building — while your opponent (human or AI) controls security forces trying to intercept you using Bayesian tracking and adversarial search.

---

## High-Level Description (Share With Team)

**Heist Architect** is a two-player asymmetric turn-based strategy game (Player vs Player or Player vs AI) built around the NP-hard **Multi-Agent Pathfinding (MAPF)** problem solved using **Conflict-Based Search (CBS)**. One player is the **Mastermind** who must simultaneously route 3-4 thieves through a building to complete objectives (hack server, steal diamond, disable alarms) and escape — all paths are computed by CBS to guarantee no two crew members collide or block each other in corridors, with temporal dependency constraints (Thief can't enter vault until Hacker disables the alarm). The other player is the **Warden** who controls guard patrol routes and cameras, uses a **Bayesian probability heatmap** to track likely thief positions based on sensor data (door triggers, motion detectors, sound events), and uses **Adversarial Search (Minimax)** to optimally reposition guards to intercept predicted thief routes. The Mastermind's core gameplay IS multi-agent pathfinding — every turn they set waypoints for all crew members simultaneously, CBS computes conflict-free coordinated paths (visualized in real-time showing the constraint tree, path conflicts, and re-planning), and then all agents execute movement simultaneously. The Warden sees CBS happening on the thieves' side as a probability cloud, not exact paths, and must use Bayesian inference to narrow down where the crew actually is. The game deeply integrates CBS, A*, CSP, Bayesian Networks, and Adversarial Search as core mechanics — not background utilities — making every AI technique directly visible and interactive to both players.

---

## Game Overview

### What Is This Game?

A **2-player asymmetric strategy game** where:

- **Player 1 (Mastermind):** Plans and executes a heist by routing multiple agents simultaneously through a building using **Multi-Agent Pathfinding (CBS)**
- **Player 2 (Warden):** Defends the building by controlling guards, cameras, and using **Bayesian tracking** to predict and intercept the thief crew

The game is played in **turns**. Each turn, both players make decisions simultaneously, then all agents (thieves + guards) move at the same time. The core mechanic for the Mastermind is **MAPF** — you don't move one thief at a time, you plan ALL their paths at once, and CBS resolves conflicts between them.

### Why Multi-Agent Pathfinding IS The Gameplay

In most games, pathfinding is invisible background work. In Heist Architect, **MAPF is the player's primary action**:

1. The Mastermind sets waypoints for 3-4 crew members **simultaneously**
2. CBS runs and finds **collision-free paths** for all agents
3. If paths conflict (two thieves need the same corridor at the same time), CBS generates **constraints** and replans — the player WATCHES this happen
4. The player can **accept** the CBS solution, or **manually adjust** waypoints and re-run CBS
5. Each CBS computation costs **planning time** (a resource) — inefficient plans waste time
6. Temporal dependencies add complexity: "Agent B can't move past door X until Agent A picks the lock"

The Mastermind is essentially a **human MAPF solver assisted by CBS**. Bad waypoint choices → more conflicts → more CBS re-planning → slower heist → Warden has more time to catch you.

---

## Detailed Gameplay

### Roles

#### Mastermind (Thief Team)

| Aspect | Detail |
|--------|--------|
| **Controls** | 3-4 crew members simultaneously |
| **Core action** | Set waypoints → CBS computes multi-agent paths → execute |
| **Objective** | Complete all mission objectives and reach extraction point |
| **Resource** | Planning Time (each CBS computation costs time; run out = mission fails) |
| **Visibility** | Can see building layout, own crew, last-known guard positions (fog of war on guards) |

**Crew Members (Agents in MAPF):**

| Agent | Role | Movement Cost | Special Ability |
|-------|------|---------------|-----------------|
| 🔴 Hacker | Disables cameras & alarms | 2 tiles/turn (slow) | Disable security device (adjacent) |
| 🔵 Thief | Opens locks, grabs loot | 3 tiles/turn (fast) | Pick lock (takes 1 turn at door) |
| 🟢 Muscle | Neutralizes guards | 2 tiles/turn | Knock out guard (adjacent, 1 use) |
| 🟡 Ghost (unlocked in hard mode) | Scout, no abilities | 4 tiles/turn (fastest) | Can peek around corners without triggering sensors |

**How The Mastermind Plans (MAPF in Action):**

```
STEP 1: Set waypoints
  Mastermind clicks on map to set waypoint sequence for EACH agent:
  🔴 Hacker:  Entry → Server Room → Alarm Panel → Corridor C
  🔵 Thief:   Entry → Corridor C → Vault → Extraction
  🟢 Muscle:  Entry → Guard Post → Corridor A → Extraction

STEP 2: CBS computes paths
  A* plans optimal path for each agent independently.
  CBS checks all pairs for CONFLICTS:

  ⚡ CONFLICT DETECTED:
  🔴 Hacker and 🔵 Thief both at Corridor C junction at t=5

  CBS branches:
  ├── Constraint: "🔴 ≠ Corridor-C at t=5" → re-plan 🔴 (wait 1 turn)
  └── Constraint: "🔵 ≠ Corridor-C at t=5" → re-plan 🔵 (detour via Corridor B)

  CBS picks lowest-cost branch:
  → 🔴 waits 1 turn at Server Room, enters Corridor C at t=6 ✅
  Total cost: +1 turn delay

  ⚡ CONFLICT DETECTED:
  🔵 Thief and 🟢 Muscle cross at Corridor A entrance at t=3

  CBS resolves:
  → 🟢 takes 1-turn detour via Storage Room ✅
  Total cost: +1 turn delay

  FINAL CBS SOLUTION:
  Total makespan: 12 turns
  Total conflicts resolved: 2
  Constraint tree depth: 3
  Planning time cost: 2 units

STEP 3: Mastermind reviews paths
  All paths shown as colored lines on the map.
  Conflict resolution points highlighted.
  Timeline shows all agents' schedules.

  Mastermind can:
  [✅ Accept Plan] → agents execute
  [✏️ Adjust Waypoints] → re-run CBS (costs more planning time)

STEP 4: Execute
  All agents move simultaneously along planned paths (3 turns of movement).
  Then next planning phase begins.
```

**Temporal Dependency Constraints (CSP Layer):**

These are NOT optional flavor — they are core MAPF constraints:

```
DEPENDENCIES (set by level design):
  DEP-1: 🔵 Thief CANNOT enter Vault until 🔴 Hacker disables alarm
         → CBS constraint: 🔵 blocked from Vault cells until 🔴 reaches Alarm Panel
  DEP-2: 🟢 Muscle CANNOT enter Guard Post until 🔴 Hacker disables camera
         → CBS constraint: 🟢 blocked from Guard Post until 🔴 reaches Camera Hub
  DEP-3: ALL agents must reach Extraction zone within 2 turns of each other
         → CBS constraint: makespan window on extraction waypoints

These dependencies create ADDITIONAL conflicts in CBS:
  🔵 wants to go to Vault at t=4, but 🔴 doesn't reach Alarm Panel until t=6
  → 🔵 must WAIT at a safe location for 2 turns
  → CBS must find a waiting spot that doesn't block 🟢's path
  This cascading constraint resolution is the core puzzle.
```

#### Warden (Security Team)

| Aspect | Detail |
|--------|--------|
| **Controls** | 2-3 guards + 3-4 cameras |
| **Core action** | Reposition guards, rotate cameras, interpret Bayesian heatmap |
| **Objective** | Detect (not kill) any thief — detection = thief in guard's vision for 1 full turn, or in camera view for 2 consecutive turns |
| **Resource** | Alert Level (starts at 0, sensor triggers increase it, unlocks more actions at higher levels) |
| **Visibility** | Full building layout. NO thief visibility — only the Bayesian heatmap |

**Warden's Bayesian Tracking System:**

The Warden CANNOT see the thieves directly. Instead they have:

```
SENSOR TYPES:
  🚪 Door Sensor    — triggers when ANY agent opens a door
  📡 Motion Sensor  — triggers when any agent moves within 2 tiles
  📷 Camera         — captures visual in cone (reveals exact position for that turn)
  🔊 Sound Sensor   — triggers when Muscle knocks out guard or Thief picks lock

BAYESIAN UPDATE CYCLE (every turn):
  1. PRIOR: Current probability distribution P(thief_positions) across all cells
  2. OBSERVATIONS: Collect all sensor events from this turn
  3. LIKELIHOOD: P(sensor_event | thief_at_cell) for each cell
  4. POSTERIOR: P(thief_at_cell | sensor_event) via Bayes' theorem
  5. PREDICTION: Use movement model to predict where thieves will be NEXT turn
     P(thief_at_cell_next) = Σ P(thief_at_neighbor) × P(move_to_cell | at_neighbor)

EXAMPLE:
  Turn 5: Door sensor B3 triggered.
  Prior: P(thief near B3) = 0.08 (low, they could be anywhere)
  Likelihood: P(door_B3_triggers | thief_at_B3) = 0.95
  Posterior: P(thief near B3 | door_triggered) = 0.72 ← SPIKE!

  Turn 6: Motion sensor near B3 is SILENT.
  Update: Thief probably moved AWAY from B3. Probability spreads outward.
  P(thief_at_B3) drops to 0.15
  P(thief_at_C3, C4, B4) rises to 0.20 each

  Warden sees this as a heatmap blob moving away from B3.
```

**Warden's Actions Per Turn:**

| Action | Effect | Strategic Use |
|--------|--------|---------------|
| Move Guard (1-2 tiles) | Guard walks via A* to target | Intercept high-probability zones |
| Rotate Camera (90°) | Camera cone shifts direction | Cover blind spots revealed by heatmap |
| Deploy Sensor | Place 1 motion sensor (limited supply: 3 per game) | Narrow down thief location in uncertain areas |
| Trigger Lockdown Zone | Lock all doors in 1 room for 2 turns (costs 3 Alert) | Force thieves to reroute (messes up their CBS plan) |
| Sound Alarm | All guards sprint to target zone via A* (costs 5 Alert) | Last resort — covers area fast but leaves other areas open |

**Warden's Adversarial Search (Minimax):**

In AI-controlled Warden mode, the AI uses minimax to decide:

```
WARDEN AI DECISION TREE (simplified):
  State: Bayesian heatmap shows 65% probability cluster near Corridor C

  Option A: Move Guard 1 to Corridor C entrance (block)
    → If thieves ARE there: detection likely (score +10)
    → If thieves AREN'T there: Guard 1 wasted, Vault undefended (score -5)

  Option B: Rotate Camera 2 to cover Corridor C
    → If thieves ARE there: camera confirms location (score +3, info gain)
    → If thieves AREN'T there: at least we ruled it out (score +1, info gain)

  Option C: Deploy sensor in Corridor B (gather more info first)
    → Regardless: narrows down probability distribution (score +2)

  Minimax evaluates 2-3 turns ahead:
    "If I move guard to C and thief detours to B, then I can rotate camera..."

  Best move: Option B (information gain with low risk)
```

---

### Turn Structure

```
┌─────────────────────────────────────────────────┐
│                  TURN FLOW                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  1. PLANNING PHASE (simultaneous, timed: 45 sec)│
│     ┌──────────────┐  ┌──────────────┐          │
│     │  MASTERMIND   │  │   WARDEN     │          │
│     │  Sets agent   │  │  Views       │          │
│     │  waypoints    │  │  Bayesian    │          │
│     │  for all crew │  │  heatmap     │          │
│     │  members      │  │  Repositions │          │
│     │              │  │  guards &    │          │
│     │  Runs CBS    │  │  cameras     │          │
│     │  Reviews     │  │              │          │
│     │  paths       │  │  Deploys     │          │
│     │  Accepts or  │  │  sensors     │          │
│     │  adjusts     │  │              │          │
│     └──────┬───────┘  └──────┬───────┘          │
│            │                  │                   │
│  2. EXECUTION PHASE (3 movement ticks, animated)│
│            ▼                  ▼                   │
│     All thieves    All guards move               │
│     move along     along paths                   │
│     CBS-planned    simultaneously                │
│     paths                                        │
│            │                  │                   │
│  3. RESOLUTION PHASE                             │
│     • Check detections (guard vision + cameras)  │
│     • Collect sensor events                      │
│     • Update Bayesian heatmap                    │
│     • Check objective completion                 │
│     • Check win/lose conditions                  │
│            │                                     │
│  4. REPEAT from step 1                           │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

### Win/Lose Conditions

| Condition | Result |
|-----------|--------|
| ALL objectives completed AND all crew at extraction | **Mastermind WINS** |
| ANY crew member detected by guard/camera | **Warden WINS** |
| Mastermind runs out of Planning Time | **Warden WINS** (mission failed, too slow) |
| Turn limit reached (20 turns) without completion | **Warden WINS** |
| All guards knocked out AND no sensors left | **Mastermind WINS** (building cleared) |

---

### Game Modes

| Mode | Player 1 | Player 2 | Description |
|------|----------|----------|-------------|
| **PvP (Local)** | Human Mastermind | Human Warden | Both play on same screen, split-view with fog of war |
| **PvAI (Heist)** | Human Mastermind | AI Warden | AI uses Bayesian tracking + Minimax to hunt you |
| **PvAI (Defense)** | AI Mastermind | Human Warden | AI uses CBS to plan heist, you defend with guards |
| **AI vs AI** | AI Mastermind | AI Warden | Watch CBS vs Bayesian+Minimax battle with full visualization |
| **Campaign** | Human Mastermind | AI Warden | 10 missions, increasing difficulty (more guards, smaller corridors, tighter dependencies) |
| **Sandbox** | Human | — | Build custom buildings, test CBS on your own layouts |

---

### Screens & UI Layout

#### Mastermind's Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  HEIST ARCHITECT — MASTERMIND      Mission: Diamond Exchange     │
│  Planning Time: ████████░░ 16/20   Turn: 4/20   Objectives: 1/3│
├─────────────────────────────────────┬────────────────────────────┤
│                                     │  CREW STATUS               │
│         BUILDING MAP                │                            │
│  ┌─────────────────────────┐       │  🔴 Hacker     ♥♥♥        │
│  │ LOBBY    │  CORRIDOR A  │       │  Position: Server Room     │
│  │          │  🔴→→→       │       │  Next: Alarm Panel         │
│  │     🚪   │         🚪   │       │  ETA: 3 turns              │
│  ├─────🚪───┼──────────────┤       │                            │
│  │ OFFICE   │  CORRIDOR B  │       │  🔵 Thief      ♥♥         │
│  │          │  🔵→→→→→     │       │  Position: Corridor B      │
│  │          │         🚪   │       │  Next: Vault (BLOCKED)     │
│  ├──────────┼──────────────┤       │  ⏳ Waiting for 🔴 to     │
│  │ GUARD    │    VAULT     │       │  disable alarm (DEP-1)     │
│  │ POST 🟢→│→→→  💎      │       │                            │
│  │          │              │       │  🟢 Muscle     ♥♥♥♥       │
│  └──────────┴──────────────┘       │  Position: Guard Post      │
│                                     │  Next: Extraction          │
│  GUARD INTEL (last known):         │  Ability: KO (1 remaining) │
│  👮₁ last seen: Lobby (t=2)       ├────────────────────────────┤
│  👮₂ last seen: Corridor A (t=1)  │  CBS SOLVER PANEL          │
│  📷₁ covering: Vault entrance     │                            │
│  📷₂ covering: Corridor B south   │  Status: 2 conflicts found │
│                                     │                            │
│  ─── AGENT PATHS (colored) ───    │  Constraint Tree:          │
│  🔴 ─ ─ ─ → (dashed = planned)   │       [Root]               │
│  🔵 ─ ─ ⏸ ─ → (⏸= waiting)     │      ╱     ╲              │
│  🟢 ─ ─ ─ ─ → (solid = moving)   │  [🔴≠CorB  [🔵≠CorB      │
│                                     │   t=4]      t=4]          │
├─────────────────────────────────────┤   ↓ cost:+1  ↓ cost:+3   │
│  DEPENDENCY CHAIN                  │  ✅ WINNER   rejected     │
│  🔴 Disable Alarm ──THEN──▶ 🔵   │                            │
│     Enter Vault                     │  Nodes expanded: 8        │
│  🔴 Disable Camera ──THEN──▶ 🟢  │  Total constraints: 4     │
│     Enter Guard Post                │  Makespan: 14 turns       │
│  ALL crew ──WITHIN 2 TURNS──▶     │  Sum of costs: 28         │
│     Reach Extraction                │                            │
├─────────────────────────────────────┤  [🔄 Re-run CBS]          │
│  HEIST TIMELINE                    │  [✅ Accept Plan]          │
│  t: 0  2  4  6  8 10 12 14       │  [✏️ Adjust Waypoints]     │
│  🔴 ██████████████████░░end       │                            │
│  🔵 ████⏸⏸⏸████████░░end       │  CBS COST: 2 planning time │
│  🟢 ████████████░░░░░░end         │  (re-running costs 1 more) │
│  👮₁ ██████████████████████(patrol)│                            │
│  👮₂ ██████████████████████(patrol)│                            │
└─────────────────────────────────────┴────────────────────────────┘
```

#### Warden's Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  HEIST ARCHITECT — WARDEN          Alert Level: ██░░░ 2/5       │
│  Guards: 2/2 active    Cameras: 3    Sensors: 1 remaining       │
├─────────────────────────────────────┬────────────────────────────┤
│                                     │  BAYESIAN HEATMAP          │
│         BUILDING MAP (full view)    │  (Where are the thieves?)  │
│  ┌─────────────────────────┐       │                            │
│  │ LOBBY    │  CORRIDOR A  │       │  ░░░░░▒▒▒▓▓▓░░           │
│  │   👮₁→  │              │       │  ░░░░▒▒▓▓██▓▓░░           │
│  │     🚪   │   📷→  🚪   │       │  ░░░▒▒▓██░░░░░░           │
│  ├─────🚪───┼──────────────┤       │  ░░░░▒▒▓▓░░░░░░           │
│  │ OFFICE   │  CORRIDOR B  │       │  ░░░░░▒▒▓▓██░░            │
│  │   📡     │              │       │    ↑         ↑             │
│  │          │  📷↓    🚪   │       │  cluster 1  cluster 2     │
│  ├──────────┼──────────────┤       │  P = 0.35   P = 0.42      │
│  │ GUARD    │    VAULT     │       │                            │
│  │ POST     │    💎  📷→  │       │  BEST ESTIMATE:            │
│  │  👮₂     │              │       │  ~2 thieves near Cor-B     │
│  └──────────┴──────────────┘       │  ~1 thief near Guard Post  │
│                                     ├────────────────────────────┤
│  👮 = guard (you control)          │  SENSOR LOG                │
│  📷 = camera (cone shown)          │  t=1: 📡Office — silent   │
│  📡 = motion sensor                │  t=2: 🚪DoorB3 — TRIGGER! │
│  🚪 trigger = door sensor event    │  t=3: 📷Cam2 — clear      │
│                                     │  t=4: 🚪DoorB5 — TRIGGER! │
│  Red glow = detection zone overlap │  t=4: 📡Office — TRIGGER! │
│  with high-probability cells       │       → Bayesian update... │
│                                     │       → P(Office) ↑ 0.31  │
├─────────────────────────────────────┤                            │
│  ACTIONS (pick one per turn):      │  MINIMAX SUGGESTION (AI):  │
│  [🚶Move Guard 1 to ___]          │  "Move Guard 1 to Cor-B    │
│  [🚶Move Guard 2 to ___]          │   entrance. Expected value │
│  [🔄Rotate Camera ___]            │   of detection: 0.34"      │
│  [📡Deploy Sensor at ___]         │                            │
│  [🔒Lockdown Zone ___] (cost: 3)  │  Alternative:              │
│  [🚨Sound Alarm at ___] (cost: 5) │  "Rotate Cam2 to cover     │
│                                     │   vault corridor. EV: 0.28"│
└─────────────────────────────────────┴────────────────────────────┘
```

#### AI vs AI Spectator Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  HEIST ARCHITECT — AI vs AI SPECTATOR     Speed: [▶▶ x4]       │
├───────────────────┬───────────────────┬──────────────────────────┤
│  MASTERMIND AI    │  BUILDING MAP     │  WARDEN AI               │
│                   │                   │                          │
│  CBS TREE:        │  [full map with   │  BAYESIAN HEATMAP:       │
│     [Root]        │   all agents,     │  [probability grid       │
│    ╱    ╲        │   paths, guards,  │   updating live]         │
│  [C1]  [C2]      │   cameras, and    │                          │
│    ↓     ↓       │   detection       │  MINIMAX TREE:           │
│  [✅]  [C3]      │   zones visible]  │     [State]              │
│          ↓       │                   │    ╱    ╲               │
│         [✅]      │  HEIST TIMELINE   │  [Move] [Rotate]        │
│                   │  (below map)      │    ↓      ↓             │
│  STATS:           │                   │  [eval]  [eval]         │
│  Conflicts: 4     │                   │                          │
│  Makespan: 16     │                   │  STATS:                  │
│  Replans: 3       │                   │  Confidence: 0.67        │
│  Planning: 12/20  │                   │  Sensor events: 8        │
│                   │                   │  Guard moves: 6          │
├───────────────────┴───────────────────┴──────────────────────────┤
│  [⏸ Pause] [◀ Step Back] [▶ Step Forward] [▶▶ Speed] [📊 Stats]│
│  [Toggle: CBS Tree | Bayesian Heatmap | Both | Minimax Tree]    │
└──────────────────────────────────────────────────────────────────┘
```

---

### How MAPF / CBS Is Central To Every Moment

| Game Moment | How MAPF/CBS Is Directly Involved |
|-------------|-----------------------------------|
| **Mastermind plans waypoints** | CBS computes conflict-free paths for ALL crew members simultaneously. Player sees the constraint tree grow. |
| **Two thieves need same corridor** | CBS detects the conflict, creates constraint branches, replans one agent's path. Player watches the conflict → resolution animation. |
| **Dependency: Hacker must disable alarm before Thief enters vault** | CBS adds a temporal constraint blocking Thief from vault cells until Hacker reaches alarm panel. Thief's path includes a WAIT action at a safe spot. |
| **Warden locks down a zone** | Next turn, Mastermind's CBS must replan ALL paths that went through that zone — new constraints, new tree, possibly infeasible (forces alternate routes). |
| **Guard patrol route blocks a corridor** | Mastermind's CBS treats guard patrol as moving obstacles — dynamic constraints in space-time. Guards occupy cells at known times if their patrols are predictable. |
| **All crew must extract within 2 turns of each other** | CBS makespan constraint — the latest-arriving agent can't be more than 2 turns behind the earliest. This forces tight coordination. |
| **Mastermind adjusts 1 waypoint** | Full CBS re-run — even a small change can cascade new conflicts. Player sees how one adjustment ripples through the constraint tree. |
| **Warden deploys sensor in a corridor** | Mastermind must now AVOID that corridor (or accept detection risk). CBS replans paths to go around — possibly creating new internal conflicts. |

---

### CBS Visualization — What The Player Sees

When CBS runs, a side panel animates the process step by step:

```
CBS ANIMATION (plays over ~3 seconds):

Frame 1: "Planning individual paths..."
  🔴 A* path drawn (red dashed line) — 0.5s
  🔵 A* path drawn (blue dashed line) — 0.5s
  🟢 A* path drawn (green dashed line) — 0.5s

Frame 2: "Checking for conflicts..."
  All paths overlaid on map.
  ⚡ FLASH at conflict point (two colors collide at same cell)
  Sound effect: warning beep

Frame 3: "Resolving conflict..."
  Constraint tree appears in side panel.
  Root node splits into two branches.
  Left branch: "🔴 can't be at (5,3) at t=4" — 🔴's path redraws
  Right branch: "🔵 can't be at (5,3) at t=4" — 🔵's path redraws
  Cost numbers appear on each branch.
  Lower-cost branch glows green. Higher-cost branch fades gray.

Frame 4: "Solution found!"
  Winning paths solidify on the map.
  Timeline at bottom populates.
  Stats appear: makespan, cost, conflicts resolved.
  ✅ Accept button activates.
```

---

### AI Techniques — Mapping to Course Topics

| Course Topic | Role in Game | How It's Visible to Player |
|-------------|-------------|---------------------------|
| **A* Search** | Each agent's individual path planning (CBS low-level solver) | Colored path lines on the map, node expansion shown as spreading glow |
| **BFS/DFS** | CBS constraint tree traversal (high-level solver). Also: guard area patrol uses BFS for coverage | Constraint tree visualization in side panel |
| **Multi-Agent Pathfinding (CBS)** | Core Mastermind mechanic — planning all crew paths simultaneously | Conflict detection, constraint tree, replanning animation, makespan stats |
| **CSP (Constraints)** | Temporal dependencies between agents. Zone lockdown constraints. Extraction window constraint | Dependency chain diagram. Blocked paths shown with lock icons. "WAITING" status on agents |
| **Adversarial Search (Minimax)** | Warden AI decision-making: optimal guard repositioning, camera rotation, alarm deployment | Minimax suggestion panel showing evaluated options with scores. Decision tree in AI vs AI mode |
| **Bayesian Network** | Warden's thief tracking system — probability heatmap updated with sensor observations | Live color-gradient heatmap on Warden's screen. Probability percentages. Sensor log with Bayesian updates |
| **HMM (Hidden Markov Model)** | Warden's movement prediction model — estimating thief trajectory from noisy sensor data | Directional probability arrows on heatmap showing predicted movement. "Predicted path" ghost lines |

---

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        REACT FRONTEND                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │  Canvas/  │  │  CBS     │  │ Bayesian │  │  Game UI   │ │
│  │  PixiJS   │  │  Tree    │  │ Heatmap  │  │  (React    │ │
│  │  Building │  │  Panel   │  │  Panel   │  │  components│ │
│  │  Map &    │  │  (D3.js  │  │  (Canvas │  │  panels,   │ │
│  │  Agents   │  │  tree)   │  │  overlay)│  │  controls) │ │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │
│        └──────────────┴─────────────┴──────────────┘        │
│                            │                                 │
│                    WebSocket Connection                      │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                     PYTHON BACKEND (FastAPI)                  │
│                            │                                 │
│  ┌─────────────────────────┴──────────────────────────────┐ │
│  │                    Game Engine                          │ │
│  │  • Turn management, fog of war, win/lose checking      │ │
│  └──┬──────────┬──────────────┬────────────┬──────────────┘ │
│     │          │              │            │                 │
│  ┌──▼───┐  ┌──▼──────┐  ┌───▼────┐  ┌────▼──────────┐     │
│  │ A*   │  │  CBS     │  │Bayesian│  │  Adversarial  │     │
│  │Solver│  │  Solver  │  │Tracker │  │  Search       │     │
│  │      │  │  (multi- │  │(heatmap│  │  (Minimax for │     │
│  │(per  │  │  agent   │  │update, │  │  guard AI     │     │
│  │agent)│  │  conflict│  │HMM     │  │  decisions)   │     │
│  │      │  │  resolve)│  │predict)│  │               │     │
│  └──────┘  └─────────┘  └────────┘  └───────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  CSP Engine (temporal dependencies, constraint check)  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/game/create` | POST | Create new game (mode, difficulty, building layout) |
| `/game/{id}/plan` | POST | Mastermind submits waypoints → returns CBS solution (paths, tree, stats) |
| `/game/{id}/warden-action` | POST | Warden submits guard/camera move → returns updated Bayesian heatmap |
| `/game/{id}/execute` | POST | Execute current turn → returns new game state, sensor events, detections |
| `/game/{id}/state` | GET | Get current game state (player-appropriate fog of war applied) |
| `/ws/game/{id}` | WebSocket | Real-time updates: CBS animation steps streamed, Bayesian updates streamed |

#### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend Framework | React 18+ with TypeScript |
| Map Rendering | HTML5 Canvas or PixiJS (2D WebGL) |
| Tree Visualization | D3.js (CBS constraint tree, Minimax tree) |
| Heatmap | Canvas overlay with color gradient rendering |
| Charts | Recharts or Chart.js (stats, timeline) |
| State Management | Zustand or Redux |
| Backend | Python 3.11+ with FastAPI |
| WebSocket | FastAPI WebSocket (for CBS streaming) |
| AI Algorithms | Pure Python (NumPy for matrix operations in Bayesian) |
| Build Tool | Vite (frontend) |

---

### Implementation Plan (5 Weeks)

#### Week 1: Core Grid + A* + Basic Movement
- Python: Grid graph representation, A* pathfinder for single agent
- React: Canvas-based building map with rooms and corridors
- Basic: Click to place agent, click destination, A* path drawn on map
- **Deliverable:** Single agent pathfinding on a building grid

#### Week 2: CBS Multi-Agent Pathfinding
- Python: CBS algorithm — conflict detection, constraint branching, re-planning
- Python: Temporal dependency constraints (agent X before agent Y)
- React: Multi-agent waypoint UI, CBS constraint tree panel (D3.js)
- **Deliverable:** 3 agents CBS-planned with conflict visualization

#### Week 3: Warden — Guards, Cameras, Bayesian Tracking
- Python: Guard patrol AI (A* between waypoints), camera vision cones
- Python: Bayesian tracking engine — prior, likelihood, posterior update cycle
- Python: Sensor system (door, motion, camera, sound)
- React: Bayesian heatmap overlay, sensor log panel, Warden UI
- **Deliverable:** Working Warden with Bayesian heatmap updating on sensor events

#### Week 4: Adversarial AI + Game Modes
- Python: Minimax for Warden AI (guard repositioning decisions)
- Python: AI Mastermind (automated waypoint selection + CBS)
- Game loop: turn system, fog of war, win/lose detection
- Game modes: PvAI Heist, PvAI Defense, AI vs AI spectator
- **Deliverable:** Full game loop playable in PvAI mode

#### Week 5: Polish, Campaign, UI
- Campaign levels (5-10 missions with increasing difficulty)
- CBS animation (streaming step-by-step visualization)
- Heist timeline bar, dependency chain diagram
- Sound effects, visual polish, responsive layout
- Testing and bug fixes
- **Deliverable:** Complete, polished game

---

### Level Examples

#### Level 1: Tutorial — "The Mailroom Job"

```
Building: 4 rooms, 2 corridors
Crew: 2 agents (Hacker + Thief)
Guards: 0
Cameras: 1
Dependencies: None
Objective: Reach the safe and extract

Purpose: Learn CBS basics — 2 agents, simple conflict to resolve
```

#### Level 5: Medium — "The Museum Heist"

```
Building: 10 rooms, 6 corridors, 2 floors (connected by stairs)
Crew: 3 agents (Hacker + Thief + Muscle)
Guards: 2 (patrolling)
Cameras: 3
Dependencies: 
  - Hacker disables alarm → Thief enters gallery
  - Muscle neutralizes guard → Hacker accesses server
Sensors: 4 door sensors, 2 motion sensors
Objective: Steal painting from gallery, download data from server, extract

Purpose: Full CBS with 3 agents, temporal deps, guard avoidance
```

#### Level 10: Expert — "The Vault"

```
Building: 16 rooms, 10 corridors, narrow chokepoints
Crew: 4 agents (Hacker + Thief + Muscle + Ghost)
Guards: 3 (adaptive patrols — react to alert level)
Cameras: 5
Laser grids: 2 corridors blocked until Hacker disables
Dependencies:
  - Hacker disables lasers → Thief enters vault wing
  - Muscle neutralizes 2 guards → safe passage for team
  - Ghost scouts ahead → reveals guard positions (reduces fog)
  - ALL agents extract within 2 turns of each other
Sensors: 6 door, 3 motion, 2 sound
Time limit: 15 turns
Planning time: 12 units (very tight)

Purpose: Maximum CBS complexity — 4 agents, tight corridors,
many conflicts, cascading dependencies, brutal time pressure
```

---

### Scoring System

```
HEIST SCORE CALCULATION:

Base Score:      1000 (mission complete)
Speed Bonus:     +50 per unused turn (finished early)
Efficiency:      +25 per CBS conflict avoided (good waypoint planning)
Stealth:         +100 if no sensors triggered
Clean Run:       +200 if Warden's best Bayesian confidence never exceeded 50%
Planning Skill:  +30 per planning time unit saved (fewer CBS re-runs)
Low Makespan:    +10 per turn below par (optimal CBS makespan for this level)

Penalties:
  CBS re-run:    -10 planning time per re-run
  Sensor trigger:-25 per event (gives Warden info)
  Guard alert:   -50 per alert event
  Close call:    -15 (guard within 2 tiles of any thief)

LEADERBOARD:
  Rank by total score across campaign levels.
  Separate leaderboards for: Mastermind score, Warden score, AI vs AI speed.
```

