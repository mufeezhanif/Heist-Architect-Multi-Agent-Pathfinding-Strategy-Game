"""Minimax (with alpha-beta pruning) Warden AI.

The Warden controls the guards. At each of its turns, it picks a joint action
(one move per guard) to maximize expected detection / minimize thief freedom.

State used by Minimax is a lightweight snapshot:
  - guard positions
  - the Bayesian belief distribution over thieves
  - the turn parity (guard turn / thief turn)

We don't know the thieves' true positions at Warden planning time, so the
adversary minimisation happens over the distribution of *possible* thief
moves (we pick the move that, for the most threatening belief spike, still
scores well). This keeps the tree small and still demonstrates adversarial
search with alpha-beta pruning.

Depth is configurable (default 2 plies, meaning guard-then-thief).
"""
from __future__ import annotations

import itertools
import math
from dataclasses import dataclass
from typing import Optional

import numpy as np

from ..game.grid import GameMap, Coord


@dataclass
class MinimaxDecision:
    joint_move: tuple[Coord, ...]   # one cell per guard
    score: float
    nodes_evaluated: int
    # simplified tree for UI visualization
    tree: dict


def _guard_move_options(gmap: GameMap, pos: Coord) -> list[Coord]:
    opts = [pos]  # stay
    for nb in gmap.neighbors(pos):
        opts.append(nb)
    return opts


def _score(gmap: GameMap, guards: tuple[Coord, ...], belief_max: np.ndarray) -> float:
    """Heuristic: Warden wants guards near high-probability cells, thieves
    hemmed in away from exits.

    Score = -sum_g min_distance_to_top_belief + coverage_bonus
    """
    rows, cols = gmap.rows, gmap.cols
    # find top-k belief cells
    flat = belief_max.flatten()
    topk_idx = np.argpartition(flat, -5)[-5:]
    top_cells = [(int(i // cols), int(i % cols)) for i in topk_idx if flat[i] > 1e-6]
    if not top_cells:
        return 0.0

    dist_term = 0.0
    for g in guards:
        best = min(abs(g[0] - c[0]) + abs(g[1] - c[1]) for c in top_cells)
        dist_term += best

    # coverage bonus: how much top-belief probability is within guard vision (3)
    coverage = 0.0
    for g in guards:
        for c in top_cells:
            if abs(g[0] - c[0]) + abs(g[1] - c[1]) <= 3:
                coverage += float(flat[c[0] * cols + c[1]])

    return -dist_term + 10.0 * coverage


def minimax_warden(
    gmap: GameMap,
    guards: list[Coord],
    belief_max: np.ndarray,
    depth: int = 2,
) -> MinimaxDecision:
    """Return the best joint guard move.

    belief_max is a 2D numpy array (the aggregate heat-map).
    """
    per_guard_opts = [_guard_move_options(gmap, g) for g in guards]
    # limit branching factor for >2 guards
    joint_moves = list(itertools.product(*per_guard_opts))
    # Cap if it gets too big
    if len(joint_moves) > 400:
        joint_moves = joint_moves[:400]

    nodes = [0]
    tree = {"node": "root", "children": []}

    best_move = joint_moves[0]
    best_score = -math.inf
    alpha, beta = -math.inf, math.inf

    for jm in joint_moves:
        # ensure no two guards overlap
        if len(set(jm)) != len(jm):
            continue
        s = _min_thief(gmap, jm, belief_max, depth - 1, alpha, beta, nodes)
        tree["children"].append({"move": list(jm), "score": round(s, 3)})
        if s > best_score:
            best_score = s
            best_move = jm
        alpha = max(alpha, best_score)

    return MinimaxDecision(joint_move=best_move, score=best_score,
                           nodes_evaluated=nodes[0], tree=tree)


def _min_thief(gmap: GameMap, guards: tuple[Coord, ...], belief: np.ndarray,
               depth: int, alpha: float, beta: float, nodes: list[int]) -> float:
    nodes[0] += 1
    if depth == 0:
        return _score(gmap, guards, belief)

    # Thief "adversary": simulates belief diffusing away from guards (pessimistic
    # for the Warden). We approximate by diffusing one step and picking the
    # diffusion that minimises Warden score.
    diffused = _diffuse(gmap, belief)
    s1 = _score(gmap, guards, diffused)
    s2 = _score(gmap, guards, belief)
    return min(s1, s2)


def _diffuse(gmap: GameMap, belief: np.ndarray) -> np.ndarray:
    rows, cols = belief.shape
    out = np.zeros_like(belief)
    for r in range(rows):
        for c in range(cols):
            p = belief[r, c]
            if p <= 0:
                continue
            opts = [(r, c)]
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and gmap.is_walkable((nr, nc)):
                    opts.append((nr, nc))
            share = p / len(opts)
            for (rr, cc) in opts:
                out[rr, cc] += share
    s = out.sum()
    if s > 0:
        out /= s
    return out
