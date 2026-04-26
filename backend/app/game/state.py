"""Authoritative game state / turn engine."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np

from .grid import GameMap, Coord, TILE_VAULT, TILE_EXIT
from ..ai.astar import astar
from ..ai.cbs import cbs, CBSResult
from ..ai.bayes import BayesTracker
from ..ai.minimax import minimax_warden


class Phase(str, Enum):
    PLANNING = "planning"      # Mastermind assigns goals / plans paths
    EXECUTION = "execution"    # Turn-by-turn resolution
    FINISHED = "finished"


class Winner(str, Enum):
    NONE = "none"
    THIEVES = "thieves"
    WARDEN = "warden"


@dataclass
class Thief:
    id: int
    pos: Coord
    path: list[Coord] = field(default_factory=list)   # planned path, index = step within path
    path_index: int = 0
    has_loot: bool = False
    escaped: bool = False
    caught: bool = False


@dataclass
class Guard:
    id: int
    pos: Coord


@dataclass
class GameState:
    gmap: GameMap
    thieves: dict[int, Thief]
    guards: dict[int, Guard]
    turn: int = 0
    phase: Phase = Phase.PLANNING
    winner: Winner = Winner.NONE
    # play mode: "human_mastermind", "human_warden", "hotseat", "ai_vs_ai"
    mode: str = "ai_vs_ai"
    # cached artifacts for visualization
    last_cbs: Optional[CBSResult] = None
    last_minimax: Optional[dict] = None
    last_conflicts: list[dict] = field(default_factory=list)
    sensor_events: list[dict] = field(default_factory=list)   # this turn's sensor triggers
    bayes: Optional[BayesTracker] = None

    # ------------------------------------------------------------------
    @classmethod
    def new(cls, gmap: GameMap, mode: str = "ai_vs_ai") -> "GameState":
        thieves = {i: Thief(id=i, pos=gmap.thief_spawns[i])
                   for i in range(len(gmap.thief_spawns))}
        guards = {i: Guard(id=i, pos=gmap.guard_spawns[i])
                  for i in range(len(gmap.guard_spawns))}
        state = cls(gmap=gmap, thieves=thieves, guards=guards, mode=mode)
        state.bayes = BayesTracker(
            gmap=gmap,
            thief_ids=list(thieves.keys()),
            thief_spawns={i: t.pos for i, t in thieves.items()},
        )
        return state

    # ------------------------------------------------------------------
    def plan_thief_paths(self, goals: dict[int, Coord]) -> CBSResult | None:
        """Use CBS to plan conflict-free paths for the thieves named in `goals`.

        Thieves without a goal are treated as static obstacles by padding the
        solution with a single-cell "path" at their current position.
        """
        active_starts = {i: t.pos for i, t in self.thieves.items()
                         if not t.escaped and not t.caught}
        planned_goals = {i: tuple(goals[i]) for i in goals if i in active_starts}
        if not planned_goals:
            return None
        starts = {i: active_starts[i] for i in planned_goals}
        result = cbs(self.gmap, starts, planned_goals)
        if result is None:
            return None
        self.last_cbs = result
        self.last_conflicts = result.conflicts
        for tid, path in result.paths.items():
            self.thieves[tid].path = path
            self.thieves[tid].path_index = 0
        return result

    def _vault_zone(self) -> list[Coord]:
        """Vault cell plus its walkable neighbors. Three thieves each get a
        distinct cell from this zone as their CBS goal — standing in the zone
        counts as looting.
        """
        zone = [self.gmap.vault] + list(self.gmap.neighbors(self.gmap.vault))
        return zone

    def auto_plan_thieves(self) -> CBSResult | None:
        """AI Mastermind strategy: first go to vault zone, then escape via
        distinct exits. Distinct per-agent goals keep CBS tractable.
        """
        active = [(tid, th) for tid, th in self.thieves.items()
                  if not th.escaped and not th.caught]
        if not active:
            return None

        goals: dict[int, Coord] = {}
        # Stage 1 assignment — loot not yet collected: distinct zone cells
        zone = self._vault_zone()
        zone_idx = 0
        # Stage 2 assignment — have loot: distinct exits
        exits = list(self.gmap.exits)
        exit_idx = 0

        for tid, th in active:
            if not th.has_loot:
                # pick the nearest unused zone cell to this thief
                remaining = [z for z in zone if z not in goals.values()]
                if not remaining:
                    remaining = zone
                goals[tid] = min(remaining,
                                 key=lambda z: abs(z[0] - th.pos[0]) + abs(z[1] - th.pos[1]))
            else:
                remaining = [e for e in exits if e not in goals.values()]
                if not remaining:
                    remaining = exits
                goals[tid] = min(remaining,
                                 key=lambda e: abs(e[0] - th.pos[0]) + abs(e[1] - th.pos[1]))
        return self.plan_thief_paths(goals)

    # ------------------------------------------------------------------
    def step_thieves(self) -> list[dict]:
        """Advance each thief by one step along its planned path."""
        events = []
        for tid, th in self.thieves.items():
            if th.escaped or th.caught:
                continue
            if not th.path or th.path_index + 1 >= len(th.path):
                # reached end of plan — grant loot if on zone, else idle
                if th.pos in self._vault_zone() and not th.has_loot:
                    th.has_loot = True
                    events.append({"type": "loot", "thief": tid})
                continue
            th.path_index += 1
            th.pos = th.path[th.path_index]
            if th.pos in self._vault_zone() and not th.has_loot:
                th.has_loot = True
                events.append({"type": "loot", "thief": tid})
            if th.has_loot and th.pos in self.gmap.exits:
                th.escaped = True
                events.append({"type": "escape", "thief": tid})
        return events

    # ------------------------------------------------------------------
    def collect_observations(self) -> list[dict]:
        """Roll each sensor: triggered if any thief truly inside coverage
        (with detect_prob), plus a false-positive chance.
        """
        import random
        obs = []
        true_positions = {tid: t.pos for tid, t in self.thieves.items()
                          if not t.escaped and not t.caught}

        for i, cam in enumerate(self.gmap.cameras):
            in_cov = any(p in cam.coverage for p in true_positions.values())
            if in_cov:
                triggered = random.random() < cam.detect_prob
            else:
                triggered = random.random() < 0.05
            obs.append({"kind": "camera", "index": i, "triggered": triggered,
                        "pos": list(cam.pos)})

        for i, s in enumerate(self.gmap.sensors):
            in_cov = any(abs(p[0] - s.pos[0]) + abs(p[1] - s.pos[1]) <= s.radius
                         for p in true_positions.values())
            if in_cov:
                triggered = random.random() < s.detect_prob
            else:
                triggered = random.random() < 0.05
            obs.append({"kind": "sensor", "index": i, "triggered": triggered,
                        "pos": list(s.pos)})

        self.sensor_events = [o for o in obs if o["triggered"]]
        return obs

    # ------------------------------------------------------------------
    def step_warden_ai(self) -> dict:
        """Use Minimax to pick guards' joint move, then apply it."""
        assert self.bayes is not None
        belief = np.array(self.bayes.heatmap())
        guard_list = [self.guards[i].pos for i in sorted(self.guards.keys())]
        decision = minimax_warden(self.gmap, guard_list, belief, depth=2)
        self.last_minimax = {
            "joint_move": [list(p) for p in decision.joint_move],
            "score": decision.score,
            "nodes_evaluated": decision.nodes_evaluated,
            "tree": decision.tree,
        }
        for i, new_pos in zip(sorted(self.guards.keys()), decision.joint_move):
            self.guards[i].pos = new_pos
        return self.last_minimax

    def move_guard(self, guard_id: int, new_pos: Coord) -> bool:
        """Human Warden move."""
        if guard_id not in self.guards:
            return False
        g = self.guards[guard_id]
        # must be neighbor or stay
        if new_pos != g.pos and new_pos not in list(self.gmap.neighbors(g.pos)):
            return False
        # no overlap with other guards
        if any(g2.pos == new_pos for gid2, g2 in self.guards.items() if gid2 != guard_id):
            return False
        g.pos = new_pos
        return True

    # ------------------------------------------------------------------
    def check_captures(self) -> list[dict]:
        caught = []
        for tid, th in self.thieves.items():
            if th.escaped or th.caught:
                continue
            for g in self.guards.values():
                if g.pos == th.pos or abs(g.pos[0] - th.pos[0]) + abs(g.pos[1] - th.pos[1]) <= 1:
                    # direct adjacency capture
                    if g.pos == th.pos:
                        th.caught = True
                        caught.append({"type": "capture", "thief": tid, "guard_pos": list(g.pos)})
                        break
        return caught

    # ------------------------------------------------------------------
    def check_end(self) -> None:
        active = [t for t in self.thieves.values() if not t.escaped and not t.caught]
        escaped = [t for t in self.thieves.values() if t.escaped]
        if not active:
            # everyone either escaped or caught
            if len(escaped) >= 2:
                self.winner = Winner.THIEVES
            else:
                self.winner = Winner.WARDEN
            self.phase = Phase.FINISHED
        elif len(escaped) >= 2:
            self.winner = Winner.THIEVES
            self.phase = Phase.FINISHED
        elif self.turn >= 120:
            self.winner = Winner.WARDEN
            self.phase = Phase.FINISHED

    # ------------------------------------------------------------------
    def advance_turn(self) -> dict:
        """Run a full turn: thieves move, Bayes predict+update, warden moves,
        captures checked. Returns a serialised event log for the UI.
        """
        assert self.bayes is not None
        turn_log: dict = {"turn": self.turn, "events": []}

        # 1. Thieves step
        evs = self.step_thieves()
        turn_log["events"].extend(evs)

        # 2. Bayes predict
        self.bayes.predict()

        # 3. Sensor observations & Bayes update
        obs = self.collect_observations()
        self.bayes.update(obs)

        # guard vision also updates belief
        self.bayes.observe_guard_vision(
            [g.pos for g in self.guards.values()],
            {tid: t.pos for tid, t in self.thieves.items()
             if not t.escaped and not t.caught},
        )
        turn_log["observations"] = obs

        # 4. Warden action
        if self.mode in ("ai_vs_ai", "human_mastermind"):
            self.step_warden_ai()
            turn_log["warden"] = self.last_minimax
        # human warden case: caller provides the move separately

        # 5. Captures
        caps = self.check_captures()
        turn_log["events"].extend(caps)

        # 6. End-state
        self.turn += 1
        self.check_end()
        turn_log["phase"] = self.phase.value
        turn_log["winner"] = self.winner.value
        return turn_log

    # ------------------------------------------------------------------
    def snapshot(self) -> dict:
        """Serialize current state for the frontend."""
        return {
            "rows": self.gmap.rows,
            "cols": self.gmap.cols,
            "tiles": ["".join(row) for row in self.gmap.tiles],
            "thieves": [
                {"id": t.id, "pos": list(t.pos),
                 "has_loot": t.has_loot, "escaped": t.escaped, "caught": t.caught,
                 "path": [list(p) for p in t.path],
                 "path_index": t.path_index}
                for t in self.thieves.values()
            ],
            "guards": [
                {"id": g.id, "pos": list(g.pos)} for g in self.guards.values()
            ],
            "vault": list(self.gmap.vault),
            "exits": [list(e) for e in self.gmap.exits],
            "cameras": [
                {"pos": list(c.pos), "coverage": [list(p) for p in c.coverage]}
                for c in self.gmap.cameras
            ],
            "sensors": [
                {"pos": list(s.pos), "radius": s.radius} for s in self.gmap.sensors
            ],
            "turn": self.turn,
            "phase": self.phase.value,
            "winner": self.winner.value,
            "mode": self.mode,
            "heatmap": self.bayes.heatmap() if self.bayes else None,
            "sensor_events": self.sensor_events,
            "conflicts": self.last_conflicts,
            "minimax": self.last_minimax,
        }
