"""
MODULE: bayesian.py
ALGORITHM: Bayesian Probability Tracker
COURSE TOPIC: Bayesian Networks / Probabilistic Reasoning
COMPLEXITY: O(W * H) per update, where W×H is the grid size
PURPOSE IN GAME: The Warden's tracking system — maintains a probability
                 distribution over the grid estimating where thieves are,
                 updated every turn using sensor observations and Bayes' theorem.

SECTIONS:
    1. Data Structures  — BeliefGrid, Observation
    2. Bayes' Theorem   — Prior → Likelihood → Posterior update
    3. Movement Model   — Predict where thieves move next (transition)
    4. Sensor Model     — P(observation | thief_at_cell) for each sensor type
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from game.building import Building


# ────────────────────────────────────────────────────────────────
# SECTION 1: Data Structures
# ────────────────────────────────────────────────────────────────

class ObservationType(Enum):
    DOOR_TRIGGER = "door_trigger"
    MOTION_TRIGGER = "motion_trigger"
    CAMERA_SPOTTED = "camera_spotted"
    SOUND_HEARD = "sound_heard"
    DOOR_SILENT = "door_silent"
    MOTION_SILENT = "motion_silent"
    CAMERA_CLEAR = "camera_clear"


@dataclass
class Observation:
    """A sensor observation from one turn."""
    obs_type: ObservationType
    sensor_x: int
    sensor_y: int
    radius: int = 2            # Sensor effective radius
    exact_pos: tuple[int, int] | None = None  # Only cameras give exact pos


@dataclass
class BeliefGrid:
    """
    Probability distribution P(thief_at_cell) over the entire grid.
    Each cell holds a probability. The grid sums to ~1.0 (per tracked agent).
    """
    width: int
    height: int
    grid: np.ndarray           # shape (height, width), dtype float64
    walkable_mask: np.ndarray  # shape (height, width), dtype bool

    @classmethod
    def uniform(cls, building: Building) -> BeliefGrid:
        """Initialize with uniform probability over all walkable cells."""
        w, h = building.width, building.height
        walkable = np.zeros((h, w), dtype=bool)
        for y in range(h):
            for x in range(w):
                walkable[y, x] = building.is_walkable(x, y)

        grid = np.where(walkable, 1.0, 0.0)
        total = grid.sum()
        if total > 0:
            grid /= total

        return cls(width=w, height=h, grid=grid, walkable_mask=walkable)


# ────────────────────────────────────────────────────────────────
# SECTION 2: Bayes' Theorem — Core Update
# ────────────────────────────────────────────────────────────────

def bayesian_update(
    belief: BeliefGrid,
    observations: list[Observation],
) -> BeliefGrid:
    """
    Apply Bayes' theorem for each observation.

    Bayes' theorem (viva):
      P(thief_at_cell | observation) =
          P(observation | thief_at_cell) × P(thief_at_cell)
          ─────────────────────────────────────────────────
                        P(observation)

    Where:
      P(thief_at_cell) = PRIOR (current belief)
      P(observation | thief_at_cell) = LIKELIHOOD (sensor model)
      P(observation) = EVIDENCE (normalizing constant = sum over all cells)
      Result = POSTERIOR (updated belief)

    We apply observations sequentially — each posterior becomes
    the next prior. This is valid because observations within a
    single turn are conditionally independent given the thief's position.
    """
    posterior = belief.grid.copy()

    for obs in observations:
        likelihood = _compute_likelihood(belief, obs)

        # Bayes: posterior ∝ likelihood × prior
        posterior = likelihood * posterior

        # Normalize (this is dividing by P(observation))
        total = posterior.sum()
        if total > 0:
            posterior /= total
        else:
            # Fallback: reset to uniform if all probability collapsed
            posterior = np.where(belief.walkable_mask, 1.0, 0.0)
            total = posterior.sum()
            if total > 0:
                posterior /= total

    return BeliefGrid(
        width=belief.width,
        height=belief.height,
        grid=posterior,
        walkable_mask=belief.walkable_mask,
    )


# ────────────────────────────────────────────────────────────────
# SECTION 3: Movement Model — Prediction Step
# ────────────────────────────────────────────────────────────────

def predict_movement(
    belief: BeliefGrid,
    building: Building,
    stay_prob: float = 0.3,
) -> BeliefGrid:
    """
    Predict where thieves will be NEXT turn using a transition model.

    For each cell, probability spreads to neighbors:
      P(cell_next) = stay_prob × P(cell_current)
                   + move_prob × Σ P(neighbor_current) / num_neighbors

    This is like the PREDICTION step in a Hidden Markov Model (HMM):
      P(X_t+1) = Σ P(X_t+1 | X_t) × P(X_t)

    stay_prob controls how much the thief is expected to stay vs move.
    Higher = believe thief stays put. Lower = believe thief is moving.
    """
    predicted = np.zeros_like(belief.grid)
    move_prob = 1.0 - stay_prob

    for y in range(belief.height):
        for x in range(belief.width):
            if not belief.walkable_mask[y, x]:
                continue

            neighbors = building.neighbors(x, y)
            n_neighbors = len(neighbors)

            # Probability of staying
            predicted[y, x] += stay_prob * belief.grid[y, x]

            # Spread to neighbors equally
            if n_neighbors > 0:
                spread = (move_prob * belief.grid[y, x]) / n_neighbors
                for nx, ny in neighbors:
                    predicted[ny, nx] += spread

    # Normalize
    total = predicted.sum()
    if total > 0:
        predicted /= total

    return BeliefGrid(
        width=belief.width,
        height=belief.height,
        grid=predicted,
        walkable_mask=belief.walkable_mask,
    )


# ────────────────────────────────────────────────────────────────
# SECTION 4: Sensor Model — Likelihoods
# ────────────────────────────────────────────────────────────────

def _compute_likelihood(
    belief: BeliefGrid, obs: Observation
) -> np.ndarray:
    """
    Compute P(observation | thief_at_cell) for every cell.

    Each sensor type has a different likelihood model:
      - Door trigger:   high probability near the door, zero far away
      - Motion trigger: moderate probability within radius
      - Camera spotted: near-certain at exact position
      - Silent sensor:  INVERSE — high probability far from sensor

    The key insight (viva): triggered sensors CONCENTRATE probability
    near the sensor. Silent sensors SPREAD probability AWAY from sensor.
    """
    likelihood = np.ones((belief.height, belief.width))
    sx, sy = obs.sensor_x, obs.sensor_y

    if obs.obs_type == ObservationType.DOOR_TRIGGER:
        # Thief is very likely near this door
        for y in range(belief.height):
            for x in range(belief.width):
                dist = abs(x - sx) + abs(y - sy)
                if dist == 0:
                    likelihood[y, x] = 0.95
                elif dist <= obs.radius:
                    likelihood[y, x] = 0.4
                else:
                    likelihood[y, x] = 0.05

    elif obs.obs_type == ObservationType.MOTION_TRIGGER:
        for y in range(belief.height):
            for x in range(belief.width):
                dist = abs(x - sx) + abs(y - sy)
                if dist <= obs.radius:
                    likelihood[y, x] = 0.7
                else:
                    likelihood[y, x] = 0.1

    elif obs.obs_type == ObservationType.CAMERA_SPOTTED:
        # Camera gives exact position
        if obs.exact_pos:
            ex, ey = obs.exact_pos
            for y in range(belief.height):
                for x in range(belief.width):
                    if (x, y) == (ex, ey):
                        likelihood[y, x] = 0.99
                    else:
                        likelihood[y, x] = 0.01

    elif obs.obs_type == ObservationType.SOUND_HEARD:
        for y in range(belief.height):
            for x in range(belief.width):
                dist = abs(x - sx) + abs(y - sy)
                if dist <= obs.radius + 1:
                    likelihood[y, x] = 0.6
                else:
                    likelihood[y, x] = 0.15

    elif obs.obs_type == ObservationType.DOOR_SILENT:
        # Door did NOT trigger → thief probably NOT near door
        for y in range(belief.height):
            for x in range(belief.width):
                dist = abs(x - sx) + abs(y - sy)
                if dist == 0:
                    likelihood[y, x] = 0.05
                elif dist <= obs.radius:
                    likelihood[y, x] = 0.3
                else:
                    likelihood[y, x] = 0.8

    elif obs.obs_type == ObservationType.MOTION_SILENT:
        for y in range(belief.height):
            for x in range(belief.width):
                dist = abs(x - sx) + abs(y - sy)
                if dist <= obs.radius:
                    likelihood[y, x] = 0.15
                else:
                    likelihood[y, x] = 0.7

    elif obs.obs_type == ObservationType.CAMERA_CLEAR:
        # Camera saw nothing in its cone
        for y in range(belief.height):
            for x in range(belief.width):
                dist = abs(x - sx) + abs(y - sy)
                if dist <= obs.radius:
                    likelihood[y, x] = 0.05
                else:
                    likelihood[y, x] = 0.8

    return likelihood


def get_top_cells(belief: BeliefGrid, n: int = 5) -> list[dict]:
    """Return top-N highest probability cells for the Warden UI."""
    flat = []
    for y in range(belief.height):
        for x in range(belief.width):
            if belief.walkable_mask[y, x]:
                flat.append({"x": x, "y": y, "prob": float(belief.grid[y, x])})
    flat.sort(key=lambda c: c["prob"], reverse=True)
    return flat[:n]


def belief_to_dict(belief: BeliefGrid) -> dict:
    """Serialize belief grid for frontend heatmap rendering."""
    cells = []
    for y in range(belief.height):
        for x in range(belief.width):
            if belief.walkable_mask[y, x] and belief.grid[y, x] > 0.001:
                cells.append({
                    "x": x, "y": y,
                    "prob": round(float(belief.grid[y, x]), 4),
                })
    return {
        "width": belief.width,
        "height": belief.height,
        "cells": cells,
        "top_cells": get_top_cells(belief),
    }
