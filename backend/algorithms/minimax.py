"""
MODULE: minimax.py
ALGORITHM: Minimax with Alpha-Beta Pruning
COURSE TOPIC: Adversarial Search / Game Trees
COMPLEXITY: O(b^d) without pruning, O(b^(d/2)) with perfect alpha-beta
PURPOSE IN GAME: Warden AI decision-maker — evaluates guard repositioning,
                 camera rotation, and sensor deployment options to maximize
                 detection probability against the Mastermind's crew.

SECTIONS:
    1. Data Structures  — WardenAction, WardenState, EvalResult
    2. Action Generation — enumerate legal Warden moves
    3. Evaluation Function — score a game state from Warden's perspective
    4. Core Algorithm   — Minimax with alpha-beta pruning
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from game.building import Building
    from algorithms.bayesian import BeliefGrid


# ────────────────────────────────────────────────────────────────
# SECTION 1: Data Structures
# ────────────────────────────────────────────────────────────────

class ActionType(Enum):
    MOVE_GUARD = "move_guard"
    ROTATE_CAMERA = "rotate_camera"
    DEPLOY_SENSOR = "deploy_sensor"
    LOCKDOWN = "lockdown"
    DO_NOTHING = "do_nothing"


@dataclass
class WardenAction:
    """A single action the Warden can take."""
    action_type: ActionType
    target_id: str = ""        # guard_id or camera_id
    target_pos: tuple[int, int] = (0, 0)
    direction: int = 0         # for camera rotation (0-3)
    description: str = ""


@dataclass
class WardenState:
    """
    Snapshot of the game from the Warden's perspective.
    Used by minimax to simulate future states.
    """
    guard_positions: dict[str, tuple[int, int]]
    camera_directions: dict[str, int]
    belief_grid: list[list[float]]  # Probability at each cell
    alert_level: int
    sensors_remaining: int
    turn: int
    guard_vision: dict[str, list[tuple[int, int]]]  # cells each guard sees

    def copy(self) -> WardenState:
        return WardenState(
            guard_positions=dict(self.guard_positions),
            camera_directions=dict(self.camera_directions),
            belief_grid=[row[:] for row in self.belief_grid],
            alert_level=self.alert_level,
            sensors_remaining=self.sensors_remaining,
            turn=self.turn,
            guard_vision={k: list(v) for k, v in self.guard_vision.items()},
        )


@dataclass
class EvalResult:
    """Result of minimax evaluation."""
    best_action: WardenAction | None
    score: float
    depth_searched: int
    nodes_evaluated: int
    tree_log: list[dict] = field(default_factory=list)


# ────────────────────────────────────────────────────────────────
# SECTION 2: Action Generation
# ────────────────────────────────────────────────────────────────

def generate_actions(
    state: WardenState,
    building: Building,
) -> list[WardenAction]:
    """
    Enumerate all legal Warden actions for the current state.
    Limits branching factor to keep minimax tractable.
    """
    actions: list[WardenAction] = []

    # Move each guard to high-probability cells (top 3 targets per guard)
    high_prob = _get_high_prob_cells(state.belief_grid, n=4)

    for guard_id, (gx, gy) in state.guard_positions.items():
        for tx, ty in high_prob:
            if (tx, ty) != (gx, gy):
                actions.append(WardenAction(
                    action_type=ActionType.MOVE_GUARD,
                    target_id=guard_id,
                    target_pos=(tx, ty),
                    description=f"Move {guard_id} to ({tx},{ty})",
                ))

        # Also: move to adjacent cells for fine positioning
        for nx, ny in building.neighbors(gx, gy):
            actions.append(WardenAction(
                action_type=ActionType.MOVE_GUARD,
                target_id=guard_id,
                target_pos=(nx, ny),
                description=f"Move {guard_id} to ({nx},{ny})",
            ))

    # Rotate each camera (4 directions)
    for cam_id, cur_dir in state.camera_directions.items():
        for d in range(4):
            if d != cur_dir:
                actions.append(WardenAction(
                    action_type=ActionType.ROTATE_CAMERA,
                    target_id=cam_id,
                    direction=d,
                    description=f"Rotate {cam_id} to dir {d}",
                ))

    # Deploy sensor at high-prob location
    if state.sensors_remaining > 0:
        for tx, ty in high_prob[:2]:
            actions.append(WardenAction(
                action_type=ActionType.DEPLOY_SENSOR,
                target_pos=(tx, ty),
                description=f"Deploy sensor at ({tx},{ty})",
            ))

    # Do nothing
    actions.append(WardenAction(
        action_type=ActionType.DO_NOTHING,
        description="Wait and observe",
    ))

    return actions


def _get_high_prob_cells(
    grid: list[list[float]], n: int = 4
) -> list[tuple[int, int]]:
    """Return the top-N highest probability cells."""
    cells = []
    for y, row in enumerate(grid):
        for x, prob in enumerate(row):
            if prob > 0.01:
                cells.append((prob, x, y))
    cells.sort(reverse=True)
    return [(x, y) for _, x, y in cells[:n]]


# ────────────────────────────────────────────────────────────────
# SECTION 3: Evaluation Function
# ────────────────────────────────────────────────────────────────

def evaluate(state: WardenState, building: Building) -> float:
    """
    Score a state from the WARDEN's perspective (higher = better for Warden).

    Components (viva):
      1. Detection potential: sum of P(thief) in cells guards can see
      2. Coverage: fraction of high-prob cells under surveillance
      3. Information value: how concentrated the belief is (entropy)
      4. Alert level bonus: higher alert = more actions available

    This is what minimax optimizes — the Warden MAXIMIZES this,
    the simulated Mastermind response MINIMIZES it.
    """
    score = 0.0

    # 1. Detection potential — probability mass under guard vision
    for guard_id, visible_cells in state.guard_vision.items():
        for (vx, vy) in visible_cells:
            if 0 <= vy < len(state.belief_grid) and 0 <= vx < len(state.belief_grid[0]):
                score += state.belief_grid[vy][vx] * 10.0

    # 2. Coverage — are high-prob cells being watched?
    high_prob = _get_high_prob_cells(state.belief_grid, n=5)
    all_visible = set()
    for cells in state.guard_vision.values():
        all_visible.update(cells)

    covered = sum(1 for c in high_prob if c in all_visible)
    score += covered * 5.0

    # 3. Information — higher belief concentration = better tracking
    max_prob = 0.0
    for row in state.belief_grid:
        for p in row:
            max_prob = max(max_prob, p)
    score += max_prob * 8.0  # Reward confident tracking

    # 4. Alert level bonus
    score += state.alert_level * 1.0

    return score


# ────────────────────────────────────────────────────────────────
# SECTION 4: Core Algorithm — Minimax with Alpha-Beta
# ────────────────────────────────────────────────────────────────

def minimax_search(
    state: WardenState,
    building: Building,
    max_depth: int = 2,
) -> EvalResult:
    """
    Minimax with alpha-beta pruning for Warden decision-making.

    The Warden is the MAXIMIZING player.
    We simulate a MINIMIZING "Mastermind response" — the thieves
    moving to reduce detection probability.

    Alpha-beta pruning (viva):
      alpha = best score the maximizer can guarantee so far
      beta  = best score the minimizer can guarantee so far
      If alpha >= beta → prune (this branch can't improve the result)

    This reduces the effective branching factor from b^d to ~b^(d/2).
    """
    tree_log: list[dict] = []
    nodes = [0]  # mutable counter

    def _minimax(
        s: WardenState,
        depth: int,
        alpha: float,
        beta: float,
        is_maximizing: bool,
        parent_action: str = "root",
    ) -> float:
        nodes[0] += 1

        # Terminal or depth limit
        if depth == 0:
            score = evaluate(s, building)
            tree_log.append({
                "type": "minimax_leaf",
                "action": parent_action,
                "score": round(score, 2),
                "depth": max_depth - depth,
            })
            return score

        actions = generate_actions(s, building)

        if is_maximizing:
            # WARDEN maximizes
            max_eval = float("-inf")
            for action in actions:
                child = _apply_action(s, action, building)
                val = _minimax(child, depth - 1, alpha, beta, False,
                               action.description)

                tree_log.append({
                    "type": "minimax_node",
                    "action": action.description,
                    "score": round(val, 2),
                    "depth": max_depth - depth,
                    "player": "warden",
                    "pruned": False,
                })

                max_eval = max(max_eval, val)
                alpha = max(alpha, val)
                if beta <= alpha:
                    tree_log.append({
                        "type": "minimax_prune",
                        "action": action.description,
                        "alpha": round(alpha, 2),
                        "beta": round(beta, 2),
                    })
                    break  # Beta cutoff
            return max_eval

        else:
            # Simulated MASTERMIND minimizes
            min_eval = float("inf")
            # Mastermind "response": probability spreads (thieves move)
            # We simulate a few worst-case scenarios for the Warden
            child = _simulate_thief_move(s)
            val = _minimax(child, depth - 1, alpha, beta, True,
                           "thief_moves")
            min_eval = min(min_eval, val)
            return min_eval

    # Run minimax for each top-level action
    actions = generate_actions(state, building)
    best_action = None
    best_score = float("-inf")

    for action in actions:
        child = _apply_action(state, action, building)
        score = _minimax(child, max_depth - 1, float("-inf"), float("inf"),
                         False, action.description)

        tree_log.append({
            "type": "minimax_root_action",
            "action": action.description,
            "action_type": action.action_type.value,
            "score": round(score, 2),
        })

        if score > best_score:
            best_score = score
            best_action = action

    return EvalResult(
        best_action=best_action,
        score=best_score,
        depth_searched=max_depth,
        nodes_evaluated=nodes[0],
        tree_log=tree_log,
    )


def _apply_action(
    state: WardenState, action: WardenAction, building: Building
) -> WardenState:
    """Apply a Warden action to produce a new state."""
    new = state.copy()

    if action.action_type == ActionType.MOVE_GUARD:
        new.guard_positions[action.target_id] = action.target_pos
        # Update guard vision
        gx, gy = action.target_pos
        vision = []
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if abs(dx) + abs(dy) <= 2:
                    vx, vy = gx + dx, gy + dy
                    if building.is_walkable(vx, vy):
                        vision.append((vx, vy))
        new.guard_vision[action.target_id] = vision

    elif action.action_type == ActionType.ROTATE_CAMERA:
        new.camera_directions[action.target_id] = action.direction

    elif action.action_type == ActionType.DEPLOY_SENSOR:
        new.sensors_remaining -= 1

    elif action.action_type == ActionType.LOCKDOWN:
        new.alert_level -= 3

    return new


def _simulate_thief_move(state: WardenState) -> WardenState:
    """
    Simulate thieves moving — probability spreads away from guards.
    This is the minimizer's "move" in our minimax formulation.
    """
    new = state.copy()
    h = len(new.belief_grid)
    w = len(new.belief_grid[0]) if h > 0 else 0

    # Spread probability away from guard positions
    guard_cells = set(new.guard_positions.values())
    for y in range(h):
        for x in range(w):
            if (x, y) in guard_cells:
                new.belief_grid[y][x] *= 0.3  # Thieves avoid guards

    # Renormalize
    total = sum(p for row in new.belief_grid for p in row)
    if total > 0:
        for y in range(h):
            for x in range(w):
                new.belief_grid[y][x] /= total

    new.turn += 1
    return new
