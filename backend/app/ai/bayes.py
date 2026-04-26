"""Bayesian belief tracker for hidden thieves.

For each thief we maintain a probability distribution over grid cells
representing the Warden's belief about the thief's true position.

Each turn we perform:
  1. PREDICT  — propagate probability through a motion model (thief can move
     to any walkable neighbor or stay).
  2. UPDATE   — apply Bayes' rule using sensor observations:
        P(cell | obs) ∝ P(obs | cell) * P(cell)
     Sensors fire with `detect_prob` when the thief is inside coverage and
     with `false_pos` otherwise.

The tracker exposes an aggregate heat-map (sum over thieves, clipped to 1.0)
for visualization as the "Warden's view".
"""
from __future__ import annotations

import numpy as np

from ..game.grid import GameMap, Coord


class BayesTracker:
    def __init__(self, gmap: GameMap, thief_ids: list[int],
                 thief_spawns: dict[int, Coord]):
        self.gmap = gmap
        self.rows, self.cols = gmap.rows, gmap.cols
        self.thief_ids = list(thief_ids)

        # walkable mask
        self.walkable = np.zeros((self.rows, self.cols), dtype=bool)
        for r in range(self.rows):
            for c in range(self.cols):
                self.walkable[r, c] = gmap.is_walkable((r, c))

        # per-thief belief grid initialised at the spawn cell
        self.belief: dict[int, np.ndarray] = {}
        for t in self.thief_ids:
            b = np.zeros((self.rows, self.cols), dtype=float)
            sr, sc = thief_spawns[t]
            b[sr, sc] = 1.0
            self.belief[t] = b

        # precompute sensor coverage masks for speed
        self._camera_masks = []
        for cam in gmap.cameras:
            mask = np.zeros((self.rows, self.cols), dtype=bool)
            for (r, c) in cam.coverage:
                mask[r, c] = True
            self._camera_masks.append((mask, cam.detect_prob))

        self._sensor_masks = []
        for s in gmap.sensors:
            mask = np.zeros((self.rows, self.cols), dtype=bool)
            sr, sc = s.pos
            for r in range(self.rows):
                for c in range(self.cols):
                    if abs(r - sr) + abs(c - sc) <= s.radius and self.walkable[r, c]:
                        mask[r, c] = True
            self._sensor_masks.append((mask, s.detect_prob))

    # ------------------------------------------------------------------
    def predict(self) -> None:
        """Uniform transition: each step the thief moves to a walkable neighbor
        or stays with equal probability.
        """
        for t, b in self.belief.items():
            nb = np.zeros_like(b)
            for r in range(self.rows):
                for c in range(self.cols):
                    p = b[r, c]
                    if p <= 0 or not self.walkable[r, c]:
                        continue
                    opts = [(r, c)]
                    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < self.rows and 0 <= nc < self.cols and self.walkable[nr, nc]:
                            opts.append((nr, nc))
                    share = p / len(opts)
                    for (rr, cc) in opts:
                        nb[rr, cc] += share
            s = nb.sum()
            if s > 0:
                nb /= s
            self.belief[t] = nb

    # ------------------------------------------------------------------
    def update(self, observations: list[dict]) -> None:
        """Apply Bayes update given per-sensor observations.

        Each observation is a dict:
          {"kind": "camera"|"sensor", "index": i, "triggered": bool}
        The likelihood P(obs | cell) is computed per thief independently
        because we track them independently (simplification for tractability).
        """
        for obs in observations:
            idx = obs["index"]
            triggered = obs["triggered"]
            if obs["kind"] == "camera":
                mask, dp = self._camera_masks[idx]
            else:
                mask, dp = self._sensor_masks[idx]

            fp = 0.05  # false-positive rate for non-coverage cells
            like = np.where(mask,
                            dp if triggered else (1 - dp),
                            fp if triggered else (1 - fp))

            for t in self.thief_ids:
                b = self.belief[t] * like
                s = b.sum()
                if s > 0:
                    b /= s
                else:
                    # degenerate; reset to uniform over walkable
                    b = self.walkable.astype(float)
                    b /= b.sum()
                self.belief[t] = b

    # ------------------------------------------------------------------
    def observe_guard_vision(self, guard_positions: list[Coord],
                             true_positions: dict[int, Coord], vision_range: int = 3) -> None:
        """Guards also act as sensors. If a thief is within guard vision we
        collapse that thief's belief to a near-certain spike.
        """
        for t in self.thief_ids:
            tp = true_positions.get(t)
            if tp is None:
                continue
            for gp in guard_positions:
                # simple: Manhattan distance & same row/col unobstructed
                if abs(gp[0] - tp[0]) + abs(gp[1] - tp[1]) <= vision_range:
                    # check straight line-of-sight
                    if self._line_of_sight(gp, tp):
                        b = np.zeros_like(self.belief[t])
                        b[tp[0], tp[1]] = 1.0
                        self.belief[t] = b
                        break

    def _line_of_sight(self, a: Coord, b: Coord) -> bool:
        # Only check when aligned on a row or column (simple cone)
        if a[0] != b[0] and a[1] != b[1]:
            return False
        if a == b:
            return True
        r, c = a
        dr = 0 if b[0] == a[0] else (1 if b[0] > a[0] else -1)
        dc = 0 if b[1] == a[1] else (1 if b[1] > a[1] else -1)
        while (r, c) != b:
            r += dr
            c += dc
            if self.gmap.tiles[r][c] == "#":
                return False
        return True

    # ------------------------------------------------------------------
    def heatmap(self) -> list[list[float]]:
        agg = np.zeros((self.rows, self.cols), dtype=float)
        for b in self.belief.values():
            agg = np.maximum(agg, b)  # use max so an area isn't diluted
        return agg.tolist()

    def argmax(self, thief_id: int) -> Coord:
        b = self.belief[thief_id]
        idx = int(np.argmax(b))
        return (idx // self.cols, idx % self.cols)

    def entropy(self) -> float:
        """Total Shannon entropy across thieves — used by Minimax."""
        total = 0.0
        for b in self.belief.values():
            flat = b.flatten()
            flat = flat[flat > 1e-9]
            total += float(-(flat * np.log2(flat)).sum())
        return total
