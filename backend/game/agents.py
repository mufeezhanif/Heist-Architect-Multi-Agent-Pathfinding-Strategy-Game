"""
Heist Architect — Agents Module

Crew members (Mastermind's team) and Guards (Warden's team).
Guards have varied patrol types and alert-level behaviour.
Crew members have usable abilities with cooldowns.
"""
from __future__ import annotations
import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from game.building import Building


class CrewRole(Enum):
    HACKER = "hacker"
    THIEF = "thief"
    MUSCLE = "muscle"


class AbilityType(Enum):
    DISABLE_DEVICE = "disable_device"   # Hacker: disables camera/alarm
    PICK_LOCK = "pick_lock"             # Thief: opens locked doors
    KNOCK_OUT = "knock_out"             # Muscle: neutralizes a guard
    SPRINT = "sprint"                   # Thief: move extra step this turn


class PatrolType(Enum):
    LINEAR = "linear"       # A→B→A→B ping-pong
    LOOP = "loop"           # A→B→C→A→B→C cyclic
    RANDOM = "random"       # Picks random adjacent walkable cell each turn


@dataclass
class CrewMember:
    agent_id: str
    role: CrewRole
    x: int
    y: int
    movement_speed: int = 2       # tiles per turn
    health: int = 3
    abilities: list[AbilityType] = field(default_factory=list)
    ability_uses: dict[str, int] = field(default_factory=dict)
    ability_cooldowns: dict[str, int] = field(default_factory=dict)
    detected: bool = False
    alive: bool = True

    def __post_init__(self):
        if not self.abilities:
            role_abilities = {
                CrewRole.HACKER: [AbilityType.DISABLE_DEVICE],
                CrewRole.THIEF: [AbilityType.PICK_LOCK, AbilityType.SPRINT],
                CrewRole.MUSCLE: [AbilityType.KNOCK_OUT],
            }
            self.abilities = role_abilities.get(self.role, [])
        if not self.ability_uses:
            self.ability_uses = {a.value: 3 for a in self.abilities}
        if not self.ability_cooldowns:
            self.ability_cooldowns = {a.value: 0 for a in self.abilities}

    def can_use_ability(self, ability: AbilityType) -> bool:
        return (
            ability in self.abilities
            and self.ability_uses.get(ability.value, 0) > 0
            and self.ability_cooldowns.get(ability.value, 0) <= 0
            and self.alive
        )

    def use_ability(self, ability: AbilityType):
        if self.can_use_ability(ability):
            self.ability_uses[ability.value] -= 1
            self.ability_cooldowns[ability.value] = 2  # 2 turn cooldown

    def tick_cooldowns(self):
        for k in self.ability_cooldowns:
            if self.ability_cooldowns[k] > 0:
                self.ability_cooldowns[k] -= 1

    def to_dict(self) -> dict:
        return {
            "id": self.agent_id,
            "role": self.role.value,
            "x": self.x, "y": self.y,
            "speed": self.movement_speed,
            "health": self.health,
            "abilities": [a.value for a in self.abilities],
            "ability_uses": self.ability_uses,
            "ability_cooldowns": self.ability_cooldowns,
            "detected": self.detected,
            "alive": self.alive,
        }


@dataclass
class Guard:
    guard_id: str
    x: int
    y: int
    vision_range: int = 2
    patrol_route: list[tuple[int, int]] = field(default_factory=list)
    patrol_index: int = 0
    patrol_type: PatrolType = PatrolType.LINEAR
    patrol_direction: int = 1   # +1 forward, -1 backward (for LINEAR)
    knocked_out: bool = False
    knocked_out_turns: int = 0
    alert_bonus_range: int = 0  # Extra vision from alert level

    def advance_patrol(self, building: 'Building | None' = None, alert_level: int = 0):
        """Move guard one step along patrol route, behaviour varies by type."""
        if self.knocked_out:
            self.knocked_out_turns -= 1
            if self.knocked_out_turns <= 0:
                self.knocked_out = False
                self.knocked_out_turns = 0
            return

        if not self.patrol_route:
            return

        if self.patrol_type == PatrolType.LINEAR:
            nxt = self.patrol_index + self.patrol_direction
            if nxt >= len(self.patrol_route) or nxt < 0:
                self.patrol_direction *= -1
                nxt = self.patrol_index + self.patrol_direction
            self.patrol_index = max(0, min(nxt, len(self.patrol_route) - 1))

        elif self.patrol_type == PatrolType.LOOP:
            self.patrol_index = (self.patrol_index + 1) % len(self.patrol_route)

        elif self.patrol_type == PatrolType.RANDOM:
            if building:
                neighbors = building.neighbors(self.x, self.y)
                if neighbors:
                    # Prefer patrol cells but sometimes deviate
                    patrol_set = set(self.patrol_route)
                    on_route = [n for n in neighbors if n in patrol_set]
                    if on_route and random.random() < 0.6:
                        self.x, self.y = random.choice(on_route)
                    else:
                        self.x, self.y = random.choice(neighbors)
                    return

        self.x, self.y = self.patrol_route[self.patrol_index]

    def get_vision_cells(self, building: 'Building') -> list[tuple[int, int]]:
        """Cells visible to this guard (manhattan radius + alert bonus)."""
        if self.knocked_out:
            return []
        visible = []
        r = self.vision_range + self.alert_bonus_range
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if abs(dx) + abs(dy) <= r and (dx != 0 or dy != 0):
                    vx, vy = self.x + dx, self.y + dy
                    if building.is_walkable(vx, vy):
                        visible.append((vx, vy))
        return visible

    def to_dict(self) -> dict:
        return {
            "id": self.guard_id,
            "x": self.x, "y": self.y,
            "vision_range": self.vision_range + self.alert_bonus_range,
            "knocked_out": self.knocked_out,
            "knocked_out_turns": self.knocked_out_turns,
            "patrol_route": self.patrol_route,
            "patrol_type": self.patrol_type.value,
        }


def create_default_crew(
    entry_cells: list[tuple[int, int]],
) -> list[CrewMember]:
    """Create the default 3-agent crew at entry positions.
    
    Each agent must start at a unique cell for CBS to work.
    If there are fewer entry cells than agents, offset extras
    to adjacent floor cells.
    """
    roles = [
        (CrewRole.HACKER, 2, "hacker"),
        (CrewRole.THIEF, 3, "thief"),
        (CrewRole.MUSCLE, 2, "muscle"),
    ]
    # Build unique start positions
    used: set[tuple[int, int]] = set()
    positions: list[tuple[int, int]] = []
    for i in range(len(roles)):
        pos = entry_cells[i % len(entry_cells)]
        # If position already taken, offset to neighboring cell
        if pos in used:
            for dx, dy in [(1, 0), (0, 1), (-1, 0), (0, -1), (2, 0), (0, 2)]:
                alt = (pos[0] + dx, pos[1] + dy)
                if alt not in used:
                    pos = alt
                    break
        used.add(pos)
        positions.append(pos)

    crew = []
    for i, (role, speed, aid) in enumerate(roles):
        pos = positions[i]
        crew.append(CrewMember(
            agent_id=aid, role=role,
            x=pos[0], y=pos[1],
            movement_speed=speed,
        ))
    return crew


def create_default_guards(building: 'Building') -> list[Guard]:
    """Create 4 guards with varied patrol patterns for the 30x25 map.
    
    Patrols are placed AWAY from entry points (1,1) and (3,23)
    so the player has breathing room at the start.
    """
    guards = [
        # Guard 1: Linear patrol in mid-right wing (far from entries)
        Guard(
            guard_id="guard_1",
            x=18, y=7,
            vision_range=2,
            patrol_type=PatrolType.LINEAR,
            patrol_route=[(18, 6), (18, 7), (18, 8), (18, 9),
                          (17, 10), (16, 11)],
        ),
        # Guard 2: Loop patrol through central rooms
        Guard(
            guard_id="guard_2",
            x=13, y=13,
            vision_range=2,
            patrol_type=PatrolType.LOOP,
            patrol_route=[(13, 11), (13, 12), (13, 13), (13, 14),
                          (14, 14), (15, 14), (15, 13), (15, 12),
                          (15, 11), (14, 11)],
        ),
        # Guard 3: Random patrol near vault area (lower-center)
        Guard(
            guard_id="guard_3",
            x=15, y=18,
            vision_range=2,
            patrol_type=PatrolType.RANDOM,
            patrol_route=[(14, 17), (14, 18), (15, 18), (15, 19),
                          (16, 18), (16, 17)],
        ),
        # Guard 4: Linear patrol in right wing corridor
        Guard(
            guard_id="guard_4",
            x=22, y=16,
            vision_range=2,
            patrol_type=PatrolType.LINEAR,
            patrol_route=[(22, 14), (22, 15), (22, 16), (22, 17),
                          (22, 18), (22, 19)],
        ),
    ]
    return guards
