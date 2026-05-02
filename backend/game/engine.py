"""
Heist Architect — Game Engine

Step-by-step game loop with alert system, abilities, fog of war,
and integration of all AI algorithms.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import uuid
import os

# ── Admin / Debug toggle ──────────────────────────────────────────────────────
# Set HEIST_GOD_MODE=1 (or true/yes) in the environment to disable all guard
# and camera detections so the heist crew can never be busted.
GOD_MODE: bool = os.environ.get("HEIST_GOD_MODE", "").lower() in ("1", "true", "yes")

from game.building import Building, CellType, ObjectiveType, create_medium_building
from game.agents import (
    CrewMember, Guard, CrewRole, AbilityType, PatrolType,
    create_default_crew, create_default_guards,
)
from game.sensors import SensorSystem, SensorEvent, create_default_sensors
from algorithms.cbs import cbs_search, CBSResult, Constraint
from algorithms.csp import (
    Dependency, generate_temporal_constraints, validate_dependencies,
)
from algorithms.bayesian import (
    BeliefGrid, Observation, ObservationType,
    bayesian_update, predict_movement, belief_to_dict,
)


class GameStatus(Enum):
    PLANNING = "planning"
    EXECUTING = "executing"
    WON = "won"
    LOST = "lost"


class AlertLevel(Enum):
    GREEN = 0    # Normal patrol
    YELLOW = 1   # Suspicious — guards widen vision
    RED = 2      # High alert — guards converge
    LOCKDOWN = 3 # Full lockdown — next detection = game over


class GameMode(Enum):
    PVA_MASTERMIND = "pva_mastermind"
    AI_VS_AI = "ai_vs_ai"


@dataclass
class StepResult:
    """Result of executing a single step within a turn."""
    step: int
    crew_positions: dict[str, tuple[int, int]]
    guard_positions: dict[str, tuple[int, int]]
    sensor_events: list[dict]
    detections: list[dict]
    alert_level: int
    alert_message: str
    game_status: str


@dataclass
class TurnResult:
    """Result of executing a full turn (multiple steps)."""
    turn: int
    steps: list[StepResult]
    crew_positions: dict[str, tuple[int, int]]
    guard_positions: dict[str, tuple[int, int]]
    sensor_events: list[dict]
    detections: list[dict]
    objectives_completed: list[str]
    bayesian_heatmap: dict
    warden_action: dict | None
    game_status: str
    score: int
    alert_level: int
    event_log: list[str]


@dataclass
class GameState:
    """Complete game state."""
    game_id: str
    building: Building
    crew: list[CrewMember]
    guards: list[Guard]
    sensors: SensorSystem
    belief: BeliefGrid
    dependencies: list[Dependency]

    turn: int = 0
    max_turns: int = 50
    status: GameStatus = GameStatus.PLANNING
    mode: GameMode = GameMode.PVA_MASTERMIND

    # Alert system
    alert_level: AlertLevel = AlertLevel.GREEN
    alert_decay_timer: int = 0
    suspicion: int = 0           # Cumulative suspicion points
    last_known_pos: tuple[int, int] | None = None

    objectives_completed: list[str] = field(default_factory=list)
    score: int = 1000
    detection_count: int = 0
    detection_history: list[dict] = field(default_factory=list)

    # CBS result from last plan
    last_cbs_result: Optional[CBSResult] = None
    current_paths: dict[str, list[tuple[int, int]]] = field(default_factory=dict)
    path_step: int = 0

    # Event log
    event_log: list[str] = field(default_factory=list)

    def to_dict(self, perspective: str = "mastermind") -> dict:
        guard_data = []
        for g in self.guards:
            gd = g.to_dict()
            gd["vision"] = g.get_vision_cells(self.building)
            if perspective == "mastermind":
                visible = self._is_guard_visible(g)
                if not visible:
                    gd = {
                        "id": g.guard_id, "x": -1, "y": -1,
                        "knocked_out": g.knocked_out,
                        "knocked_out_turns": g.knocked_out_turns,
                        "visible": False,
                        "vision": [],
                        "patrol_route": [],
                        "patrol_type": g.patrol_type.value,
                    }
            guard_data.append(gd)

        return {
            "game_id": self.game_id,
            "building": self.building.to_dict(),
            "crew": [c.to_dict() for c in self.crew],
            "guards": guard_data,
            "turn": self.turn,
            "max_turns": self.max_turns,
            "status": self.status.value,
            "mode": self.mode.value,
            "alert_level": self.alert_level.value,
            "objectives_completed": self.objectives_completed,
            "objectives_total": self._count_objectives(),
            "score": self.score,
            "event_log": self.event_log[-10:],
            "bayesian_heatmap": belief_to_dict(self.belief) if perspective in ("warden", "spectator") else {},
            "current_paths": {k: v for k, v in self.current_paths.items()} if self.current_paths else None,
        }

    def _is_guard_visible(self, guard: Guard) -> bool:
        for crew in self.crew:
            if not crew.alive:
                continue
            dist = abs(crew.x - guard.x) + abs(crew.y - guard.y)
            if dist <= 4:
                return True
        return False

    def _count_objectives(self) -> int:
        count = 0
        for row in self.building.grid:
            for cell in row:
                if cell.objective is not None:
                    count += 1
        return count


# ────────────────────────────────────────────────────────────────
# Game Factory
# ────────────────────────────────────────────────────────────────

_games: dict[str, GameState] = {}


def create_game(mode: str = "pva_mastermind") -> GameState:
    game_id = str(uuid.uuid4())[:8]
    building = create_medium_building()

    entries = building.find_cells(CellType.ENTRY)
    entry_positions = [(c.x, c.y) for c in entries]

    crew = create_default_crew(entry_positions)
    guards = create_default_guards(building)
    sensors = create_default_sensors(building)
    belief = BeliefGrid.uniform(building)

    alarm_cells = building.find_objectives(ObjectiveType.DISABLE_ALARM)
    vault_cells = building.find_objectives(ObjectiveType.STEAL_LOOT)

    dependencies = []
    if alarm_cells and vault_cells:
        vault_positions = [(c.x, c.y) for c in vault_cells]
        dependencies.append(Dependency(
            prereq_agent="hacker",
            prereq_target=(alarm_cells[0].x, alarm_cells[0].y),
            dependent_agent="thief",
            blocked_cells=vault_positions,
            description="Hacker disables alarm -> Thief enters vault",
        ))

    game_mode = GameMode.AI_VS_AI if mode in ("ai_vs_ai", "spectator") else GameMode.PVA_MASTERMIND

    state = GameState(
        game_id=game_id,
        building=building,
        crew=crew,
        guards=guards,
        sensors=sensors,
        belief=belief,
        dependencies=dependencies,
        mode=game_mode,
    )
    if mode in ("pva_mastermind", "pvai"):
        _apply_mastermind_easy_preset(state)
    state.event_log.append("Heist begins. Plan your moves carefully.")

    _games[game_id] = state
    return state


def get_game(game_id: str) -> Optional[GameState]:
    return _games.get(game_id)


def _apply_mastermind_easy_preset(game: GameState):
    """Reduce baseline pressure for human players in mastermind mode."""
    game.max_turns = 65

    # Lower guard pressure while preserving patrol behavior.
    game.guards = game.guards[:3]
    for guard in game.guards:
        guard.vision_range = 1
        guard.alert_bonus_range = 0

    # Soften camera coverage slightly.
    for cam in game.building.cameras:
        cam.cone_length = max(2, cam.cone_length - 1)

    # Reduce early sensor punishments: keep motion/camera, remove door spam.
    game.sensors.sensors = [s for s in game.sensors.sensors if s.sensor_type != "door"]

    game.event_log.append("Mastermind mode tuned to normal difficulty (easier guard pressure).")


# ────────────────────────────────────────────────────────────────
# Planning Phase
# ────────────────────────────────────────────────────────────────

def plan_paths(
    game: GameState,
    waypoints: dict[str, tuple[int, int]],
) -> CBSResult:
    agents: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {}
    for crew in game.crew:
        if crew.agent_id in waypoints and crew.alive:
            start = (crew.x, crew.y)
            goal = waypoints[crew.agent_id]
            agents[crew.agent_id] = (start, goal)

    extra = generate_temporal_constraints(game.dependencies)
    result = cbs_search(game.building, agents, extra_constraints=extra)

    if result.success:
        game.current_paths = result.paths
        game.path_step = 0
        game.last_cbs_result = result
        game.status = GameStatus.EXECUTING
        game.event_log.append(f"CBS planned paths (cost={result.total_cost}). Execute to move!")

        # Reset detection flags for fresh move
        for crew in game.crew:
            crew.detected = False

    return result


# ────────────────────────────────────────────────────────────────
# Execution Phase — Step-by-step with alert system
# ────────────────────────────────────────────────────────────────

def execute_step(game: GameState) -> StepResult:
    """Execute a single step: move all agents 1 cell, check everything."""
    game.path_step += 1

    # 1. Move crew 1 step
    for crew in game.crew:
        if not crew.alive:
            continue
        path = game.current_paths.get(crew.agent_id, [])
        if game.path_step < len(path):
            crew.x, crew.y = path[game.path_step]

    # 2. Move guards
    for guard in game.guards:
        guard.advance_patrol(game.building, game.alert_level.value)

    # 3. Check sensors
    agent_positions = {c.agent_id: (c.x, c.y) for c in game.crew if c.alive}
    sensor_events = game.sensors.check_all(agent_positions, game.turn, game.building)

    # 4. Check detections
    detections = _check_detections(game)

    # 5. Alert update
    alert_msg = _update_alert(game, detections, sensor_events)

    return StepResult(
        step=game.path_step,
        crew_positions={c.agent_id: (c.x, c.y) for c in game.crew},
        guard_positions={g.guard_id: (g.x, g.y) for g in game.guards},
        sensor_events=[
            {"sensor_id": e.sensor_id, "event_type": e.event_type.value,
             "pos": [e.sensor_x, e.sensor_y]}
            for e in sensor_events
        ],
        detections=detections,
        alert_level=game.alert_level.value,
        alert_message=alert_msg,
        game_status=game.status.value,
    )


def execute_turn(game: GameState) -> TurnResult:
    """Execute one full turn: move all agents along their entire planned path.
    
    Each step is animated on the frontend. Guards, sensors, and detections
    are checked at every step for realism. After all steps complete,
    Bayesian update + heuristic Warden response, then returns to PLANNING.
    """
    game.turn += 1

    # Tick cooldowns
    for crew in game.crew:
        crew.tick_cooldowns()
    game.building.tick_lockdowns()

    # Decay alert
    _decay_alert(game)

    # Determine max path length for this turn
    max_steps = 1
    for path in game.current_paths.values():
        max_steps = max(max_steps, len(path) - 1)  # steps = waypoints - 1

    # Execute ALL steps of the path so characters reach their destination
    all_steps: list[StepResult] = []
    all_sensor_events: list[dict] = []
    all_detections: list[dict] = []

    for _ in range(max_steps):
        if game.status == GameStatus.LOST:
            break
        step = execute_step(game)
        all_steps.append(step)
        all_sensor_events.extend(step.sensor_events)
        all_detections.extend(step.detections)

    # Bayesian update
    observations = _events_to_observations_from_dicts(all_sensor_events)
    game.belief = bayesian_update(game.belief, observations)
    game.belief = predict_movement(game.belief, game.building)

    # Warden AI
    warden_action_dict = None
    if game.mode in (GameMode.PVA_MASTERMIND, GameMode.AI_VS_AI):
        warden_action_dict = _run_warden_ai(game)

    # Check objectives
    newly_completed = _check_objectives(game)

    # Check endgame
    _check_endgame(game)

    # Scoring
    game.score -= len(all_sensor_events)
    if not all_detections:
        game.score += 3

    # Always return to planning after each turn (unless game over)
    if game.status == GameStatus.EXECUTING:
        game.status = GameStatus.PLANNING
        game.current_paths = {}
        game.path_step = 0

    return TurnResult(
        turn=game.turn,
        steps=all_steps,
        crew_positions={c.agent_id: (c.x, c.y) for c in game.crew},
        guard_positions={g.guard_id: (g.x, g.y) for g in game.guards},
        sensor_events=all_sensor_events,
        detections=all_detections,
            objectives_completed=list(game.objectives_completed),
        bayesian_heatmap=belief_to_dict(game.belief),
        warden_action=warden_action_dict,
        game_status=game.status.value,
        score=game.score,
        alert_level=game.alert_level.value,
        event_log=game.event_log[-10:],
    )


# ────────────────────────────────────────────────────────────────
# Abilities
# ────────────────────────────────────────────────────────────────

def use_ability(game: GameState, agent_id: str, ability: str, target: dict | None = None) -> dict:
    """Player uses an ability for a crew member."""
    crew = next((c for c in game.crew if c.agent_id == agent_id), None)
    if not crew or not crew.alive:
        return {"success": False, "message": "Agent not available"}

    try:
        ability_type = AbilityType(ability)
    except ValueError:
        return {"success": False, "message": "Unknown ability"}

    if not crew.can_use_ability(ability_type):
        cd = crew.ability_cooldowns.get(ability, 0)
        uses = crew.ability_uses.get(ability, 0)
        if uses <= 0:
            return {"success": False, "message": "No uses remaining"}
        if cd > 0:
            return {"success": False, "message": f"On cooldown ({cd} turns)"}
        return {"success": False, "message": "Cannot use ability"}

    result = {"success": False, "message": "No valid target in range"}

    if ability_type == AbilityType.KNOCK_OUT:
        for guard in game.guards:
            if guard.knocked_out:
                continue
            dist = abs(crew.x - guard.x) + abs(crew.y - guard.y)
            if dist <= 1:
                guard.knocked_out = True
                guard.knocked_out_turns = 6
                crew.use_ability(ability_type)
                game.event_log.append(f"MUSCLE knocked out {guard.guard_id}!")
                result = {"success": True, "message": f"Knocked out {guard.guard_id} for 6 turns",
                          "target": guard.guard_id}
                break

    elif ability_type == AbilityType.DISABLE_DEVICE:
        # Prefer disabling an active camera first.
        for cam in game.building.cameras:
            if not cam.active:
                continue
            dist = abs(crew.x - cam.x) + abs(crew.y - cam.y)
            if dist <= 4:
                cam.active = False
                crew.use_ability(ability_type)
                game.event_log.append(f"HACKER disabled {cam.camera_id}!")
                result = {"success": True, "message": f"Disabled {cam.camera_id}",
                          "target": cam.camera_id}
                break

        # If no camera was disabled, allow hacker to complete nearby security objectives.
        if not result.get("success"):
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    if abs(dx) + abs(dy) > 1:
                        continue
                    cell = game.building.cell_at(crew.x + dx, crew.y + dy)
                    if not cell or not cell.objective:
                        continue
                    if cell.objective not in (ObjectiveType.DISABLE_ALARM, ObjectiveType.DISABLE_CAMERA):
                        continue

                    obj_name = cell.objective.value
                    if obj_name not in game.objectives_completed:
                        game.objectives_completed.append(obj_name)
                        game.score += 50

                    # Mark security objective as handled on the map.
                    cell.objective = None
                    crew.use_ability(ability_type)
                    game.event_log.append(f"HACKER completed {obj_name} at ({cell.x},{cell.y})!")
                    result = {
                        "success": True,
                        "message": f"Completed {obj_name} at ({cell.x},{cell.y})",
                        "target": f"objective:{obj_name}",
                    }
                    break
                if result.get("success"):
                    break

    elif ability_type == AbilityType.PICK_LOCK:
        # Priority 1: thief on / adjacent to STEAL_LOOT objective → steal the loot
        for dx, dy in [(0, 0), (0, -1), (1, 0), (0, 1), (-1, 0)]:
            cell = game.building.cell_at(crew.x + dx, crew.y + dy)
            if cell and cell.objective == ObjectiveType.STEAL_LOOT:
                obj_name = cell.objective.value
                if obj_name not in game.objectives_completed:
                    game.objectives_completed.append(obj_name)
                    game.score += 50
                    game.event_log.append(f"THIEF stole the loot at ({cell.x},{cell.y})!")
                crew.use_ability(ability_type)
                result = {
                    "success": True,
                    "message": f"Stole the loot at ({cell.x},{cell.y})!",
                    "target": "objective:steal_loot",
                }
                break

        # Priority 2: pick a nearby locked door
        if not result.get("success"):
            for dx, dy in [(0, 0), (0, -1), (1, 0), (0, 1), (-1, 0)]:
                cell = game.building.cell_at(crew.x + dx, crew.y + dy)
                if cell and cell.is_locked:
                    cell.is_locked = False
                    cell.lockdown_turns = 0
                    crew.use_ability(ability_type)
                    game.event_log.append(f"THIEF picked lock at ({cell.x},{cell.y})!")
                    result = {"success": True, "message": f"Unlocked door at ({cell.x},{cell.y})"}
                    break
    elif ability_type == AbilityType.SPRINT:
        path = game.current_paths.get(crew.agent_id, [])
        moved = 0
        for _ in range(2):
            next_step = game.path_step + 1 + moved
            if next_step < len(path):
                crew.x, crew.y = path[next_step]
                moved += 1
        if moved > 0:
            crew.use_ability(ability_type)
            game.event_log.append(f"THIEF sprinted {moved} extra steps!")
            result = {"success": True, "message": f"Sprinted {moved} extra steps"}

    return result


# ────────────────────────────────────────────────────────────────
# Alert System
# ────────────────────────────────────────────────────────────────

def _update_alert(game: GameState, detections: list[dict], sensor_events: list) -> str:
    """Update alert level based on detections. Uses suspicion points for gradual escalation.
    
    Suspicion thresholds:
      0-2  → GREEN  (normal)
      3-5  → YELLOW (investigating)
      6-9  → RED    (converging)
      10+  → LOCKDOWN (one more = game over)
    
    Guard detection = +2 suspicion
    Camera detection = +1 suspicion
    Sensor trigger = +0.5 suspicion (via sensor_events count)
    """
    msg = ""
    if not detections and not sensor_events:
        return msg

    # Add suspicion from detections
    for d in detections:
        if d.get("type") == "guard":
            game.suspicion += 2
        else:
            game.suspicion += 1
        game.last_known_pos = (d["x"], d["y"])

    # Sensor triggers add minor suspicion
    triggered = [e for e in sensor_events if isinstance(e, dict) and "trigger" in e.get("event_type", "")]
    game.suspicion += len(triggered) // 2

    game.detection_count += len(detections)

    # Determine alert level from suspicion
    old_level = game.alert_level
    if game.suspicion >= 12:
        game.alert_level = AlertLevel.LOCKDOWN
    elif game.suspicion >= 7:
        game.alert_level = AlertLevel.RED
    elif game.suspicion >= 3:
        game.alert_level = AlertLevel.YELLOW
    else:
        game.alert_level = AlertLevel.GREEN

    # Set guard alert bonuses
    for g in game.guards:
        g.alert_bonus_range = game.alert_level.value

    # Generate alert message on level change
    if game.alert_level != old_level:
        game.alert_decay_timer = 4 + game.alert_level.value * 2
        if game.alert_level == AlertLevel.YELLOW:
            msg = "SUSPICIOUS ACTIVITY — Guards are investigating!"
        elif game.alert_level == AlertLevel.RED:
            msg = "HIGH ALERT — Guards converging on last known position!"
        elif game.alert_level == AlertLevel.LOCKDOWN:
            msg = "LOCKDOWN — Next detection means game over!"
        game.event_log.append(msg)

    # Only end game on LOCKDOWN + additional detection
    if game.alert_level == AlertLevel.LOCKDOWN and detections:
        if game.suspicion >= 15:
            game.status = GameStatus.LOST
            msg = "CAUGHT — The heist has failed!"
            game.event_log.append(msg)

    game.score -= 5 * len(detections)
    return msg


def _decay_alert(game: GameState):
    """Suspicion decays each turn the crew isn't detected, allowing recovery."""
    if game.alert_decay_timer > 0:
        game.alert_decay_timer -= 1
        return

    if game.suspicion > 0:
        game.suspicion = max(0, game.suspicion - 1)

        old_level = game.alert_level
        if game.suspicion < 3:
            game.alert_level = AlertLevel.GREEN
        elif game.suspicion < 7:
            game.alert_level = AlertLevel.YELLOW
        elif game.suspicion < 12:
            game.alert_level = AlertLevel.RED

        for g in game.guards:
            g.alert_bonus_range = game.alert_level.value

        if game.alert_level != old_level:
            if game.alert_level == AlertLevel.GREEN:
                game.event_log.append("Alert returned to GREEN — guards resuming patrol.")
            else:
                game.event_log.append(f"Alert dropped to {game.alert_level.name}.")


# ────────────────────────────────────────────────────────────────
# AI vs AI
# ────────────────────────────────────────────────────────────────

def ai_mastermind_plan(game: GameState) -> CBSResult:
    uncompleted = []
    for row in game.building.grid:
        for cell in row:
            if cell.objective and cell.objective.value not in game.objectives_completed:
                uncompleted.append(cell)

    if not uncompleted:
        extractions = game.building.find_cells(CellType.EXTRACTION)
        targets = [(c.x, c.y) for c in extractions]
    else:
        targets = [(c.x, c.y) for c in uncompleted]

    waypoints: dict[str, tuple[int, int]] = {}
    available_targets = list(targets)

    for crew in game.crew:
        if not crew.alive:
            continue
        if not available_targets:
            extr = game.building.find_cells(CellType.EXTRACTION)
            if extr:
                available_targets = [(c.x, c.y) for c in extr]
        if available_targets:
            best_target = min(
                available_targets,
                key=lambda t: abs(t[0] - crew.x) + abs(t[1] - crew.y),
            )
            waypoints[crew.agent_id] = best_target
            available_targets.remove(best_target)

    return plan_paths(game, waypoints)


# ────────────────────────────────────────────────────────────────
# Internal helpers
# ────────────────────────────────────────────────────────────────

def _events_to_observations(events: list[SensorEvent]) -> list[Observation]:
    type_map = {
        "door_trigger": ObservationType.DOOR_TRIGGER,
        "door_silent": ObservationType.DOOR_SILENT,
        "motion_trigger": ObservationType.MOTION_TRIGGER,
        "motion_silent": ObservationType.MOTION_SILENT,
        "camera_spotted": ObservationType.CAMERA_SPOTTED,
        "camera_clear": ObservationType.CAMERA_CLEAR,
        "sound_heard": ObservationType.SOUND_HEARD,
    }
    obs = []
    for e in events:
        ot = type_map.get(e.event_type.value)
        if ot:
            obs.append(Observation(
                obs_type=ot,
                sensor_x=e.sensor_x, sensor_y=e.sensor_y,
                exact_pos=e.exact_pos,
            ))
    return obs


def _events_to_observations_from_dicts(events: list[dict]) -> list[Observation]:
    type_map = {
        "door_trigger": ObservationType.DOOR_TRIGGER,
        "door_silent": ObservationType.DOOR_SILENT,
        "motion_trigger": ObservationType.MOTION_TRIGGER,
        "motion_silent": ObservationType.MOTION_SILENT,
        "camera_spotted": ObservationType.CAMERA_SPOTTED,
        "camera_clear": ObservationType.CAMERA_CLEAR,
        "sound_heard": ObservationType.SOUND_HEARD,
    }
    obs = []
    for e in events:
        ot = type_map.get(e.get("event_type", ""))
        if ot:
            pos = e.get("pos", [0, 0])
            obs.append(Observation(
                obs_type=ot,
                sensor_x=pos[0], sensor_y=pos[1],
                exact_pos=None,
            ))
    return obs


def _check_detections(game: GameState) -> list[dict]:
    # God-mode: admin has disabled guard/camera detection
    if GOD_MODE:
        return []
    detections = []
    for guard in game.guards:
        if guard.knocked_out:
            continue
        visible = guard.get_vision_cells(game.building)
        for crew in game.crew:
            if not crew.alive:
                continue
            if (crew.x, crew.y) in visible:
                detections.append({
                    "type": "guard",
                    "guard_id": guard.guard_id,
                    "crew_id": crew.agent_id,
                    "x": crew.x, "y": crew.y,
                })
                crew.detected = True

    for cam in game.building.cameras:
        if not cam.active:
            continue
        cam_cells = game.building.get_camera_vision(cam)
        for crew in game.crew:
            if not crew.alive:
                continue
            if (crew.x, crew.y) in cam_cells:
                detections.append({
                    "type": "camera",
                    "camera_id": cam.camera_id,
                    "crew_id": crew.agent_id,
                    "x": crew.x, "y": crew.y,
                })

    return detections


def _check_objectives(game: GameState) -> list[str]:
    newly = []
    for crew in game.crew:
        if not crew.alive:
            continue
        cell = game.building.cell_at(crew.x, crew.y)
        if cell and cell.objective:
            obj_name = cell.objective.value
            if obj_name not in game.objectives_completed:
                role_obj_match = {
                    "hacker": [ObjectiveType.HACK_SERVER, ObjectiveType.DISABLE_ALARM, ObjectiveType.DISABLE_CAMERA],
                    "thief": [ObjectiveType.STEAL_LOOT],
                    "muscle": [],
                }
                allowed = role_obj_match.get(crew.role.value, [])
                if cell.objective in allowed or crew.role == CrewRole.THIEF:
                    game.objectives_completed.append(obj_name)
                    newly.append(obj_name)
                    game.score += 50
                    game.event_log.append(f"Objective complete: {obj_name}!")
    return newly


def _check_endgame(game: GameState):
    if game.status == GameStatus.LOST:
        return

    if game.turn >= game.max_turns:
        game.status = GameStatus.LOST
        game.event_log.append("Time is up — the heist has failed!")
        return

    # Check if all crew dead/captured
    alive_crew = [c for c in game.crew if c.alive]
    if not alive_crew:
        game.status = GameStatus.LOST
        game.event_log.append("All crew members captured!")
        return

    total_obj = game._count_objectives()
    if total_obj > 0 and len(game.objectives_completed) >= total_obj:
        extraction_cells = [
            (c.x, c.y) for c in game.building.find_cells(CellType.EXTRACTION)
        ]
        all_extracted = all(
            (c.x, c.y) in extraction_cells for c in alive_crew
        )
        if all_extracted:
            game.status = GameStatus.WON
            game.score += 200
            if game.alert_level == AlertLevel.GREEN:
                game.score += 100
                game.event_log.append("Perfect stealth bonus!")
            game.event_log.append("HEIST COMPLETE — All objectives secured!")


def _run_warden_ai(game: GameState) -> Optional[dict]:
    """Simple, explainable Warden policy driven by Bayesian suspicion peaks."""
    if not game.guards:
        return None

    best_prob = -1.0
    target_cell: tuple[int, int] | None = None
    for y in range(game.belief.height):
        for x in range(game.belief.width):
            if not game.building.is_walkable(x, y):
                continue
            prob = float(game.belief.grid[y, x])
            if prob > best_prob:
                best_prob = prob
                target_cell = (x, y)

    if target_cell is None:
        return None

    tx, ty = target_cell
    active_guards = [g for g in game.guards if not g.knocked_out]

    if active_guards:
        primary = min(active_guards, key=lambda g: abs(g.x - tx) + abs(g.y - ty))
        current_dist = abs(primary.x - tx) + abs(primary.y - ty)

        best_step = (primary.x, primary.y)
        best_step_dist = current_dist
        for nx, ny in game.building.neighbors(primary.x, primary.y):
            dist = abs(nx - tx) + abs(ny - ty)
            if dist < best_step_dist:
                best_step = (nx, ny)
                best_step_dist = dist

        if best_step != (primary.x, primary.y):
            from_pos = (primary.x, primary.y)
            primary.x, primary.y = best_step
            return {
                "type": "move_guard",
                "guard_id": primary.guard_id,
                "from": [from_pos[0], from_pos[1]],
                "to": [best_step[0], best_step[1]],
                "target": [tx, ty],
                "target_prob": round(best_prob, 3),
                "reason": "Moved nearest guard toward highest-suspicion tile",
            }

    # If no guard can improve position, rotate a camera to face the hotspot.
    active_cameras = [c for c in game.building.cameras if c.active]
    if active_cameras:
        cam = min(active_cameras, key=lambda c: abs(c.x - tx) + abs(c.y - ty))
        dx = tx - cam.x
        dy = ty - cam.y
        if abs(dx) >= abs(dy):
            desired_dir = 1 if dx > 0 else 3
        else:
            desired_dir = 2 if dy > 0 else 0

        if cam.direction != desired_dir:
            old_dir = cam.direction
            cam.direction = desired_dir
            return {
                "type": "rotate_camera",
                "camera_id": cam.camera_id,
                "from": old_dir,
                "to": desired_dir,
                "target": [tx, ty],
                "target_prob": round(best_prob, 3),
                "reason": "Rotated nearest camera toward highest-suspicion tile",
            }

    return {
        "type": "hold",
        "target": [tx, ty],
        "target_prob": round(best_prob, 3),
        "reason": "No improving guard move available",
    }
