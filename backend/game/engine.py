"""
Heist Architect — Game Engine

Turn-based game loop, state management, win/lose conditions,
fog of war, and integration of all AI algorithms.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import uuid

from game.building import Building, CellType, ObjectiveType, create_medium_building
from game.agents import (
    CrewMember, Guard, CrewRole, create_default_crew, create_default_guards,
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
from algorithms.minimax import (
    WardenState, WardenAction, ActionType, minimax_search,
)


class GameStatus(Enum):
    PLANNING = "planning"
    EXECUTING = "executing"
    WON = "won"
    LOST = "lost"


class GameMode(Enum):
    PVA_MASTERMIND = "pva_mastermind"  # Human mastermind vs AI warden
    AI_VS_AI = "ai_vs_ai"             # Full AI spectator mode


@dataclass
class TurnResult:
    """Result of executing one turn."""
    turn: int
    crew_positions: dict[str, tuple[int, int]]
    guard_positions: dict[str, tuple[int, int]]
    sensor_events: list[dict]
    detections: list[dict]
    objectives_completed: list[str]
    bayesian_heatmap: dict
    warden_action: dict | None
    minimax_log: list[dict]
    game_status: str
    score: int


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
    max_turns: int = 20
    planning_time: int = 20
    planning_time_remaining: int = 20
    status: GameStatus = GameStatus.PLANNING
    mode: GameMode = GameMode.PVA_MASTERMIND
    objectives_completed: list[str] = field(default_factory=list)
    score: int = 1000
    detection_history: list[dict] = field(default_factory=list)

    # CBS result from last plan
    last_cbs_result: Optional[CBSResult] = None
    current_paths: dict[str, list[tuple[int, int]]] = field(default_factory=dict)
    path_step: int = 0

    def to_dict(self, perspective: str = "mastermind") -> dict:
        """Serialize state for API. Apply fog of war per perspective."""
        guard_data = []
        for g in self.guards:
            if perspective == "mastermind":
                # Fog of war: only show guards in crew line-of-sight
                visible = self._is_guard_visible(g)
                if visible:
                    guard_data.append(g.to_dict())
                else:
                    guard_data.append({
                        "id": g.guard_id, "x": -1, "y": -1,
                        "knocked_out": g.knocked_out,
                        "visible": False,
                    })
            else:
                guard_data.append(g.to_dict())

        return {
            "game_id": self.game_id,
            "building": self.building.to_dict(),
            "crew": [c.to_dict() for c in self.crew],
            "guards": guard_data,
            "turn": self.turn,
            "max_turns": self.max_turns,
            "planning_time_remaining": self.planning_time_remaining,
            "status": self.status.value,
            "mode": self.mode.value,
            "objectives_completed": self.objectives_completed,
            "objectives_total": self._count_objectives(),
            "score": self.score,
            "bayesian_heatmap": belief_to_dict(self.belief) if perspective == "warden" or perspective == "spectator" else None,
            "current_paths": {k: v for k, v in self.current_paths.items()} if self.current_paths else None,
        }

    def _is_guard_visible(self, guard: Guard) -> bool:
        """Check if any crew member can see this guard."""
        for crew in self.crew:
            dist = abs(crew.x - guard.x) + abs(crew.y - guard.y)
            if dist <= 3:  # Crew vision range
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
    """Create a new game with the medium building."""
    game_id = str(uuid.uuid4())[:8]
    building = create_medium_building()

    # Find entry cells
    entries = building.find_cells(CellType.ENTRY)
    entry_positions = [(c.x, c.y) for c in entries]

    crew = create_default_crew(entry_positions)
    guards = create_default_guards(building)
    sensors = create_default_sensors(building)
    belief = BeliefGrid.uniform(building)

    # Default dependencies
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
            description="Hacker disables alarm → Thief enters vault",
        ))

    game_mode = GameMode.AI_VS_AI if mode == "ai_vs_ai" else GameMode.PVA_MASTERMIND

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

    _games[game_id] = state
    return state


def get_game(game_id: str) -> Optional[GameState]:
    return _games.get(game_id)


# ────────────────────────────────────────────────────────────────
# Planning Phase — CBS
# ────────────────────────────────────────────────────────────────

def plan_paths(
    game: GameState,
    waypoints: dict[str, tuple[int, int]],
) -> CBSResult:
    """
    Mastermind submits waypoints for all crew.
    CBS computes conflict-free paths.
    """
    agents: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {}
    for crew in game.crew:
        if crew.agent_id in waypoints:
            start = (crew.x, crew.y)
            goal = waypoints[crew.agent_id]
            agents[crew.agent_id] = (start, goal)

    # Generate CSP temporal constraints
    extra = generate_temporal_constraints(game.dependencies)

    result = cbs_search(game.building, agents, extra_constraints=extra)

    if result.success:
        game.current_paths = result.paths
        game.path_step = 0
        game.last_cbs_result = result
        game.planning_time_remaining -= 2  # CBS costs planning time
        game.status = GameStatus.EXECUTING

    return result


# ────────────────────────────────────────────────────────────────
# Execution Phase — Move agents, check sensors, update Bayesian
# ────────────────────────────────────────────────────────────────

def execute_turn(game: GameState) -> TurnResult:
    """Execute one turn: move agents, check sensors, update AI, check win/lose."""
    game.turn += 1

    # 1. Move crew along CBS paths (3 steps per turn)
    steps_per_turn = 3
    for _ in range(steps_per_turn):
        game.path_step += 1
        for crew in game.crew:
            path = game.current_paths.get(crew.agent_id, [])
            if game.path_step < len(path):
                crew.x, crew.y = path[game.path_step]

    # 2. Move guards along patrol routes
    for guard in game.guards:
        guard.advance_patrol()

    # 3. Check sensors
    agent_positions = {c.agent_id: (c.x, c.y) for c in game.crew}
    sensor_events = game.sensors.check_all(
        agent_positions, game.turn, game.building
    )

    # 4. Convert sensor events to Bayesian observations
    observations = _events_to_observations(sensor_events)
    game.belief = bayesian_update(game.belief, observations)
    game.belief = predict_movement(game.belief, game.building)

    # 5. Check detections (guard vision + camera)
    detections = _check_detections(game)

    # 6. Warden AI (minimax)
    warden_action_dict = None
    minimax_log: list[dict] = []
    if game.mode in (GameMode.PVA_MASTERMIND, GameMode.AI_VS_AI):
        warden_result = _run_warden_ai(game)
        if warden_result:
            warden_action_dict = {
                "action": warden_result.best_action.description if warden_result.best_action else "none",
                "score": warden_result.score,
                "nodes": warden_result.nodes_evaluated,
            }
            minimax_log = warden_result.tree_log

    # 7. Check objectives
    newly_completed = _check_objectives(game)

    # 8. Check win/lose
    _check_endgame(game, detections)

    # 9. Update score
    game.score -= len(sensor_events) * 5
    if not detections:
        game.score += 10  # Stealth bonus

    # If still executing and paths exhausted, go back to planning
    if game.status == GameStatus.EXECUTING:
        all_done = all(
            game.path_step >= len(game.current_paths.get(c.agent_id, [])) - 1
            for c in game.crew
        )
        if all_done:
            game.status = GameStatus.PLANNING

    return TurnResult(
        turn=game.turn,
        crew_positions={c.agent_id: (c.x, c.y) for c in game.crew},
        guard_positions={g.guard_id: (g.x, g.y) for g in game.guards},
        sensor_events=[
            {"id": e.sensor_id, "type": e.event_type.value,
             "x": e.sensor_x, "y": e.sensor_y}
            for e in sensor_events
        ],
        detections=detections,
        objectives_completed=newly_completed,
        bayesian_heatmap=belief_to_dict(game.belief),
        warden_action=warden_action_dict,
        minimax_log=minimax_log,
        game_status=game.status.value,
        score=game.score,
    )


# ────────────────────────────────────────────────────────────────
# AI vs AI — Mastermind AI
# ────────────────────────────────────────────────────────────────

def ai_mastermind_plan(game: GameState) -> CBSResult:
    """
    AI Mastermind: automatically generate waypoints based on
    uncompleted objectives, then run CBS.
    """
    # Simple heuristic: assign each crew member to nearest objective
    uncompleted = []
    for row in game.building.grid:
        for cell in row:
            if cell.objective and cell.objective.value not in game.objectives_completed:
                uncompleted.append(cell)

    # If all objectives done, head to extraction
    if not uncompleted:
        extractions = game.building.find_cells(CellType.EXTRACTION)
        targets = [(c.x, c.y) for c in extractions]
    else:
        targets = [(c.x, c.y) for c in uncompleted]

    # Assign agents to targets by proximity
    waypoints: dict[str, tuple[int, int]] = {}
    available_targets = list(targets)

    for crew in game.crew:
        if not available_targets:
            # Head to extraction
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
    """Convert sensor events to Bayesian observations."""
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
                sensor_x=e.sensor_x,
                sensor_y=e.sensor_y,
                exact_pos=e.exact_pos,
            ))
    return obs


def _check_detections(game: GameState) -> list[dict]:
    """Check if any guard or camera detects a crew member."""
    detections = []
    for guard in game.guards:
        if guard.knocked_out:
            continue
        visible = guard.get_vision_cells(game.building)
        for crew in game.crew:
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
            if (crew.x, crew.y) in cam_cells:
                detections.append({
                    "type": "camera",
                    "camera_id": cam.camera_id,
                    "crew_id": crew.agent_id,
                    "x": crew.x, "y": crew.y,
                })

    return detections


def _check_objectives(game: GameState) -> list[str]:
    """Check if crew members are at objective cells."""
    newly = []
    for crew in game.crew:
        cell = game.building.cell_at(crew.x, crew.y)
        if cell and cell.objective:
            obj_name = cell.objective.value
            if obj_name not in game.objectives_completed:
                # Check if the right agent is at the right objective
                role_obj_match = {
                    "hacker": [ObjectiveType.HACK_SERVER, ObjectiveType.DISABLE_ALARM, ObjectiveType.DISABLE_CAMERA],
                    "thief": [ObjectiveType.STEAL_LOOT],
                    "muscle": [],
                }
                allowed = role_obj_match.get(crew.role.value, [])
                if cell.objective in allowed or crew.role == CrewRole.THIEF:
                    game.objectives_completed.append(obj_name)
                    newly.append(obj_name)
    return newly


def _check_endgame(game: GameState, detections: list[dict]):
    """Check win/lose conditions."""
    # Lose: any detection
    if detections:
        game.status = GameStatus.LOST
        return

    # Lose: out of time
    if game.turn >= game.max_turns:
        game.status = GameStatus.LOST
        return

    # Lose: out of planning time
    if game.planning_time_remaining <= 0:
        game.status = GameStatus.LOST
        return

    # Win: all objectives complete AND all crew at extraction
    total_obj = game._count_objectives()
    if len(game.objectives_completed) >= total_obj:
        extraction_cells = [
            (c.x, c.y) for c in game.building.find_cells(CellType.EXTRACTION)
        ]
        all_extracted = all(
            (c.x, c.y) in extraction_cells for c in game.crew
        )
        if all_extracted:
            game.status = GameStatus.WON
            game.score += 200  # Win bonus


def _run_warden_ai(game: GameState) -> Optional:
    """Run minimax for the Warden AI."""
    belief_list = game.belief.grid.tolist()

    guard_vision = {}
    for g in game.guards:
        guard_vision[g.guard_id] = g.get_vision_cells(game.building)

    warden_state = WardenState(
        guard_positions={g.guard_id: (g.x, g.y) for g in game.guards},
        camera_directions={c.camera_id: c.direction for c in game.building.cameras},
        belief_grid=belief_list,
        alert_level=min(game.turn, 5),
        sensors_remaining=3,
        turn=game.turn,
        guard_vision=guard_vision,
    )

    result = minimax_search(warden_state, game.building, max_depth=2)

    # Apply the best action
    if result.best_action:
        action = result.best_action
        if action.action_type == ActionType.MOVE_GUARD:
            for g in game.guards:
                if g.guard_id == action.target_id:
                    g.x, g.y = action.target_pos
                    break
        elif action.action_type == ActionType.ROTATE_CAMERA:
            for c in game.building.cameras:
                if c.camera_id == action.target_id:
                    c.direction = action.direction
                    break

    return result
