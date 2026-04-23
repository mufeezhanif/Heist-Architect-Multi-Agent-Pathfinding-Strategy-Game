"""
MODULE: grid.py
PURPOSE: Lightweight 2D grid + MovingAI .map format loader
         Used by Arena (interactive A*) and Bench (MAPF benchmarks).

MovingAI .map format:
    type octile
    height H
    width W
    map
    .............@@
    ........@@@@@@@
    ...
Symbols: '.' passable, '@' wall, 'T' tree (wall), 'S' swamp, 'W' water
"""
from __future__ import annotations
from dataclasses import dataclass, field
import random


@dataclass
class SimpleGrid:
    width: int
    height: int
    # cells[y][x] = True if walkable
    cells: list[list[bool]] = field(default_factory=list)
    name: str = "custom"

    def is_walkable(self, x: int, y: int) -> bool:
        if not (0 <= x < self.width and 0 <= y < self.height):
            return False
        return self.cells[y][x]

    def neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        """4-connected walkable neighbors."""
        out = []
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if self.is_walkable(nx, ny):
                out.append((nx, ny))
        return out

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "width": self.width,
            "height": self.height,
            "cells": [[1 if c else 0 for c in row] for row in self.cells],
        }

    def random_walkable(self, rng: random.Random | None = None) -> tuple[int, int]:
        r = rng or random
        for _ in range(1000):
            x, y = r.randrange(self.width), r.randrange(self.height)
            if self.cells[y][x]:
                return (x, y)
        # fallback: first walkable found
        for y in range(self.height):
            for x in range(self.width):
                if self.cells[y][x]:
                    return (x, y)
        return (0, 0)


def parse_movingai_map(text: str, name: str = "custom") -> SimpleGrid:
    """
    Parse a MovingAI-style .map file. Permissive: ignores unknown headers.
    '.', 'G' (grass) treated as walkable. Everything else as wall.
    """
    lines = [ln.rstrip("\r\n") for ln in text.splitlines() if ln.strip() != ""]
    width = height = 0
    body_start = 0
    for i, ln in enumerate(lines):
        low = ln.lower()
        if low.startswith("height"):
            try:
                height = int(low.split()[1])
            except Exception:
                pass
        elif low.startswith("width"):
            try:
                width = int(low.split()[1])
            except Exception:
                pass
        elif low == "map":
            body_start = i + 1
            break

    if width == 0 or height == 0:
        # No header — infer from body
        body_start = 0
        height = len(lines)
        width = max((len(ln) for ln in lines), default=0)

    body = lines[body_start : body_start + height]
    cells: list[list[bool]] = []
    for y in range(height):
        row = body[y] if y < len(body) else ""
        row = row.ljust(width, "@")
        cells.append([ch in ".G" for ch in row[:width]])
    return SimpleGrid(width=width, height=height, cells=cells, name=name)


# ─────────────────────────────────────────────────────────────
# Built-in sample maps (keeps demo self-contained)
# ─────────────────────────────────────────────────────────────

SAMPLE_MAPS: dict[str, str] = {
    "empty-20": "type octile\nheight 20\nwidth 20\nmap\n" + "\n".join(["." * 20 for _ in range(20)]),

    "rooms-24": """type octile
height 18
width 24
map
........................
.@@@@@@@.......@@@@@@@@.
.@.....@.......@......@.
.@.....@.......@......@.
.@.....@.......@......@.
.@.....@.......@......@.
.@@.@@@@.......@@@@@@.@.
........................
........................
........................
.@@@@@@@@@.....@@@@@@@..
.@.......@.....@......@.
.@.......@.....@......@.
.@.......@.....@......@.
.@.......@.....@......@.
.@@@@.@@@@.....@@@@.@@@.
........................
........................""",

    "maze-20": """type octile
height 20
width 20
map
....................
.@@@@@@.@@@@@@.@@@@.
.@....@.@....@.@..@.
.@.@@.@.@.@@.@.@.@@.
.@.@@.@.@.@@.@...@..
.@.@..@.@.@..@@@@@..
.@.@@.@.@.@@.@......
.@....@.@....@.@@@@.
.@@@@@@.@@@@.@.@..@.
........@....@.@.@@.
.@@@@.@@@@@@.@.@....
.@..@.@......@.@@@@.
.@.@@.@.@@@@.@....@.
.@.@..@.@..@.@@@@.@.
.@.@@.@.@.@@.@....@.
.@....@.@.@..@.@@.@.
.@@@@@@.@.@@.@.@..@.
........@....@.@@.@.
.@@@@@@@@@@@.@....@.
....................""",

    "bottleneck-16": """type octile
height 12
width 16
map
................
.@@@@@@..@@@@@@.
.@....@..@....@.
.@....@..@....@.
.@....@..@....@.
.@....@@@@....@.
.@............@.
.@....@@@@....@.
.@....@..@....@.
.@....@..@....@.
.@@@@@@..@@@@@@.
................""",
}


def load_sample(name: str) -> SimpleGrid:
    text = SAMPLE_MAPS.get(name)
    if text is None:
        raise KeyError(f"Unknown sample map: {name}")
    return parse_movingai_map(text, name=name)


def make_empty(width: int, height: int) -> SimpleGrid:
    return SimpleGrid(
        width=width, height=height,
        cells=[[True] * width for _ in range(height)],
        name=f"empty-{width}x{height}",
    )
