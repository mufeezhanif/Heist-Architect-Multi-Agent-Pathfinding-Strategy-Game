"""Grid / map representation for Heist Architect.

The building is modeled as a 2D grid. Each cell has a tile type and optional
sensor metadata. Adjacency is 4-connected (no diagonals) which keeps A*'s
Manhattan heuristic admissible.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

# Tile codes used in map JSON / ASCII layouts
TILE_WALL = "#"
TILE_FLOOR = "."
TILE_DOOR = "D"
TILE_VAULT = "V"
TILE_EXIT = "E"
TILE_SPAWN_THIEF = "T"
TILE_SPAWN_GUARD = "G"

WALKABLE = {TILE_FLOOR, TILE_DOOR, TILE_VAULT, TILE_EXIT,
            TILE_SPAWN_THIEF, TILE_SPAWN_GUARD}

Coord = tuple[int, int]  # (row, col)


@dataclass(frozen=True)
class Camera:
    pos: Coord
    # cells the camera can see (precomputed line-of-sight cone)
    coverage: frozenset[Coord]
    # detection probability when a thief is inside coverage
    detect_prob: float = 0.9


@dataclass(frozen=True)
class MotionSensor:
    pos: Coord
    # sensor fires when a thief is within `radius` (Manhattan)
    radius: int = 1
    detect_prob: float = 0.6


@dataclass
class GameMap:
    rows: int
    cols: int
    tiles: list[list[str]]
    thief_spawns: list[Coord]
    guard_spawns: list[Coord]
    vault: Coord
    exits: list[Coord]
    cameras: list[Camera] = field(default_factory=list)
    sensors: list[MotionSensor] = field(default_factory=list)

    # ------------------------------------------------------------------
    def in_bounds(self, pos: Coord) -> bool:
        r, c = pos
        return 0 <= r < self.rows and 0 <= c < self.cols

    def is_walkable(self, pos: Coord) -> bool:
        if not self.in_bounds(pos):
            return False
        return self.tiles[pos[0]][pos[1]] in WALKABLE

    def neighbors(self, pos: Coord) -> Iterable[Coord]:
        r, c = pos
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            np = (r + dr, c + dc)
            if self.is_walkable(np):
                yield np

    def cells_in_coverage(self, origin: Coord, max_range: int = 5) -> set[Coord]:
        """Compute a simple line-of-sight cone in 4 cardinal directions.

        A camera sees along each axis until it hits a wall, up to max_range.
        Good enough for the demo and easy to visualize in the UI.
        """
        out: set[Coord] = {origin}
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            for step in range(1, max_range + 1):
                p = (origin[0] + dr * step, origin[1] + dc * step)
                if not self.in_bounds(p):
                    break
                if self.tiles[p[0]][p[1]] == TILE_WALL:
                    break
                out.add(p)
        return out


# ---------------------------------------------------------------------------
# Default hand-designed 15x15 map
# Legend:
#   # wall  . floor  D door  V vault  E exit
#   T thief spawn  G guard spawn  c camera anchor  s motion sensor anchor
# Camera / sensor tiles are walkable floors with a parallel list of positions.
# ---------------------------------------------------------------------------

DEFAULT_LAYOUT = [
    "###############",
    "#T.....#.....E#",
    "#.###..D..###.#",
    "#.#.#..#..#.#.#",
    "#.#.#......#.#.",
    "#.#.####D###.#.",  # right side opens to corridor
    "#T#..........##",
    "#.D....V....D.#",
    "#.#..........#.",
    "#.#.####D###.#.",
    "#.#.#......#.#.",
    "#.#.#..#..#.#.#",
    "#.###..D..###.#",
    "#T..G.....G..E#",
    "###############",
]

# Normalize to exactly 15 cols by padding/truncating
def _normalize(layout: list[str], rows: int = 15, cols: int = 15) -> list[str]:
    out = []
    for i in range(rows):
        row = layout[i] if i < len(layout) else "#" * cols
        if len(row) < cols:
            row = row + "#" * (cols - len(row))
        elif len(row) > cols:
            row = row[:cols]
        # enforce border walls
        if i == 0 or i == rows - 1:
            row = "#" * cols
        else:
            row = "#" + row[1:cols - 1] + "#"
        out.append(row)
    return out


def load_default_map() -> GameMap:
    layout = _normalize(DEFAULT_LAYOUT, 15, 15)
    rows, cols = 15, 15
    tiles = [list(r) for r in layout]

    thief_spawns: list[Coord] = []
    guard_spawns: list[Coord] = []
    vault: Coord | None = None
    exits: list[Coord] = []

    for r in range(rows):
        for c in range(cols):
            ch = tiles[r][c]
            if ch == TILE_SPAWN_THIEF:
                thief_spawns.append((r, c))
                tiles[r][c] = TILE_FLOOR
            elif ch == TILE_SPAWN_GUARD:
                guard_spawns.append((r, c))
                tiles[r][c] = TILE_FLOOR
            elif ch == TILE_VAULT:
                vault = (r, c)
            elif ch == TILE_EXIT:
                exits.append((r, c))

    # Fallback safety: ensure we have exactly 3 thief and 2 guard spawns
    if len(thief_spawns) < 3:
        # add interior floors as extra spawns
        for r in range(1, rows - 1):
            for c in range(1, cols - 1):
                if len(thief_spawns) >= 3:
                    break
                if tiles[r][c] == TILE_FLOOR and (r, c) not in thief_spawns:
                    thief_spawns.append((r, c))
    thief_spawns = thief_spawns[:3]
    if len(guard_spawns) < 2:
        for r in range(1, rows - 1):
            for c in range(1, cols - 1):
                if len(guard_spawns) >= 2:
                    break
                if tiles[r][c] == TILE_FLOOR and (r, c) not in guard_spawns \
                        and (r, c) not in thief_spawns:
                    guard_spawns.append((r, c))
    guard_spawns = guard_spawns[:2]

    if vault is None:
        vault = (rows // 2, cols // 2)
        tiles[vault[0]][vault[1]] = TILE_VAULT
    if not exits:
        exits = [(1, cols - 2), (rows - 2, cols - 2)]
        for e in exits:
            tiles[e[0]][e[1]] = TILE_EXIT

    gm = GameMap(
        rows=rows, cols=cols, tiles=tiles,
        thief_spawns=thief_spawns, guard_spawns=guard_spawns,
        vault=vault, exits=exits,
    )

    # Place cameras at 4 strategic chokepoints, sensors near vault
    camera_anchors: list[Coord] = [
        (2, 7), (7, 2), (7, 12), (12, 7),
    ]
    for pos in camera_anchors:
        if gm.in_bounds(pos) and gm.tiles[pos[0]][pos[1]] != TILE_WALL:
            gm.cameras.append(Camera(pos=pos, coverage=frozenset(gm.cells_in_coverage(pos, 4))))

    sensor_anchors: list[Coord] = [(6, 7), (8, 7)]
    for pos in sensor_anchors:
        if gm.in_bounds(pos) and gm.tiles[pos[0]][pos[1]] != TILE_WALL:
            gm.sensors.append(MotionSensor(pos=pos, radius=2))

    return gm
