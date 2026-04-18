"""
Heist Architect — Agents Module

Crew members (Mastermind's team) and Guards (Warden's team).
"""
from __future__ import annotations
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


@dataclass
class CrewMember:
    agent_id: str
    role: CrewRole
    x: int
    y: int
    movement_speed: int = 2       # tiles per turn
    health: int = 3
    abilities: list[AbilityType] = field(default_factory=list)
    ability_uses: int = 1         # uses remaining per ability
    detected: bool = False

    def __post_init__(self):
        if not self.abilities:
            role_abilities = {
                CrewRole.HACKER: [AbilityType.DISABLE_DEVICE],
                CrewRole.THIEF: [AbilityType.PICK_LOCK],
                CrewRole.MUSCLE: [AbilityType.KNOCK_OUT],
            }
            self.abilities = role_abilities.get(self.role, [])

    def to_dict(self) -> dict:
        return {
            "id": self.agent_id,
            "role": self.role.value,
            "x": self.x, "y": self.y,
            "speed": self.movement_speed,
            "health": self.health,
            "abilities": [a.value for a in self.abilities],
            "ability_uses": self.ability_uses,
            "detected": self.detected,
        }


@dataclass
class Guard:
    guard_id: str
    x: int
    y: int
    vision_range: int = 2
    patrol_route: list[tuple[int, int]] = field(default_factory=list)
    patrol_index: int = 0
    knocked_out: bool = False

    def advance_patrol(self):
        """Move guard one step along patrol route."""
        if self.knocked_out or not self.patrol_route:
            return
        self.patrol_index = (self.patrol_index + 1) % len(self.patrol_route)
        self.x, self.y = self.patrol_route[self.patrol_index]

    def get_vision_cells(self, building: Building) -> list[tuple[int, int]]:
        """Cells visible to this guard (manhattan radius, line of sight)."""
        if self.knocked_out:
            return []
        visible = []
        r = self.vision_range
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
            "vision_range": self.vision_range,
            "knocked_out": self.knocked_out,
            "patrol_route": self.patrol_route,
        }


def create_default_crew(
    entry_cells: list[tuple[int, int]],
) -> list[CrewMember]:
    """Create the default 3-agent crew at entry positions."""
    roles = [
        (CrewRole.HACKER, 2, "hacker"),
        (CrewRole.THIEF, 3, "thief"),
        (CrewRole.MUSCLE, 2, "muscle"),
    ]
    crew = []
    for i, (role, speed, aid) in enumerate(roles):
        pos = entry_cells[i % len(entry_cells)]
        crew.append(CrewMember(
            agent_id=aid, role=role,
            x=pos[0], y=pos[1],
            movement_speed=speed,
        ))
    return crew


def create_default_guards(building: Building) -> list[Guard]:
    """Create guards with patrol routes for the medium building."""
    guards = [
        Guard(
            guard_id="guard_1",
            x=6, y=3,
            patrol_route=[(6, 3), (6, 4), (6, 5), (6, 6),
                          (6, 7), (6, 8), (6, 7), (6, 6),
                          (6, 5), (6, 4)],
        ),
        Guard(
            guard_id="guard_2",
            x=14, y=8,
            patrol_route=[(14, 8), (14, 9), (14, 10), (14, 11),
                          (14, 12), (14, 13), (14, 12), (14, 11),
                          (14, 10), (14, 9)],
        ),
    ]
    return guards
