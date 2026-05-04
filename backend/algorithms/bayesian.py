from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from game.building import Building


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
    obs_type: ObservationType
    sensor_x: int
    sensor_y: int
    radius: int = 2
    exact_pos: tuple[int, int] | None = None


@dataclass
class BeliefGrid:
    width: int
    height: int
    grid: np.ndarray
    walkable_mask: np.ndarray

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


def bayesian_update(
    belief: BeliefGrid,
    observations: list[Observation],
) -> BeliefGrid:
    """Apply Bayes' theorem for each observation."""
    posterior = belief.grid.copy()

    for obs in observations:
        likelihood = _compute_likelihood(belief, obs)


        posterior = likelihood * posterior


        total = posterior.sum()
        if total > 0:
            posterior /= total
        else:

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


def predict_movement(
    belief: BeliefGrid,
    building: Building,
    stay_prob: float = 0.3,
) -> BeliefGrid:
    """Predict where thieves will be NEXT turn using a transition model."""
    predicted = np.zeros_like(belief.grid)
    move_prob = 1.0 - stay_prob

    for y in range(belief.height):
        for x in range(belief.width):
            if not belief.walkable_mask[y, x]:
                continue

            neighbors = building.neighbors(x, y)
            n_neighbors = len(neighbors)


            predicted[y, x] += stay_prob * belief.grid[y, x]


            if n_neighbors > 0:
                spread = (move_prob * belief.grid[y, x]) / n_neighbors
                for nx, ny in neighbors:
                    predicted[ny, nx] += spread


    total = predicted.sum()
    if total > 0:
        predicted /= total

    return BeliefGrid(
        width=belief.width,
        height=belief.height,
        grid=predicted,
        walkable_mask=belief.walkable_mask,
    )


def _compute_likelihood(
    belief: BeliefGrid, obs: Observation
) -> np.ndarray:
    """Compute P(observation | thief_at_cell) for every cell."""
    likelihood = np.ones((belief.height, belief.width))
    sx, sy = obs.sensor_x, obs.sensor_y

    if obs.obs_type == ObservationType.DOOR_TRIGGER:

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
    """Serialize belief grid as flat {x,y: prob} for frontend heatmap."""
    result = {}
    for y in range(belief.height):
        for x in range(belief.width):
            if belief.walkable_mask[y, x] and belief.grid[y, x] > 0.001:
                result[f"{x},{y}"] = round(float(belief.grid[y, x]), 4)
    return result
