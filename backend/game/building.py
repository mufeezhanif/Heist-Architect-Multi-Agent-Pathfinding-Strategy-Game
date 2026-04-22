"""
Heist Architect — Building Grid Model

The building is a 2D grid where each cell has a type and optional properties.
Used by A*/CBS for pathfinding and by the game engine for state tracking.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class CellType(Enum):
    WALL = "wall"
    FLOOR = "floor"
    CORRIDOR = "corridor"
    DOOR = "door"
    ENTRY = "entry"
    EXTRACTION = "extraction"


class SensorType(Enum):
    DOOR_SENSOR = "door_sensor"
    MOTION_SENSOR = "motion_sensor"
    SOUND_SENSOR = "sound_sensor"


class ObjectiveType(Enum):
    HACK_SERVER = "hack_server"
    STEAL_LOOT = "steal_loot"
    DISABLE_ALARM = "disable_alarm"
    DISABLE_CAMERA = "disable_camera"


@dataclass
class Cell:
    x: int
    y: int
    cell_type: CellType
    room_id: Optional[str] = None
    sensor: Optional[SensorType] = None
    objective: Optional[ObjectiveType] = None
    is_locked: bool = False
    lockdown_turns: int = 0


@dataclass
class Camera:
    camera_id: str
    x: int
    y: int
    direction: int  # 0=N,1=E,2=S,3=W
    cone_length: int = 3
    active: bool = True


@dataclass
class Building:
    width: int
    height: int
    grid: list[list[Cell]]
    cameras: list[Camera] = field(default_factory=list)
    name: str = "Unnamed"

    def cell_at(self, x: int, y: int) -> Optional[Cell]:
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.grid[y][x]
        return None

    def is_walkable(self, x: int, y: int) -> bool:
        cell = self.cell_at(x, y)
        if cell is None:
            return False
        if cell.cell_type == CellType.WALL:
            return False
        if cell.lockdown_turns > 0:
            return False
        return True

    def neighbors(self, x: int, y: int) -> list[tuple[int, int]]:
        result = []
        for dx, dy in [(0, -1), (1, 0), (0, 1), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if self.is_walkable(nx, ny):
                result.append((nx, ny))
        return result

    def find_cells(self, cell_type: CellType) -> list[Cell]:
        return [c for row in self.grid for c in row if c.cell_type == cell_type]

    def find_objectives(self, obj_type: ObjectiveType) -> list[Cell]:
        return [c for row in self.grid for c in row if c.objective == obj_type]

    def get_camera_vision(self, camera: Camera) -> list[tuple[int, int]]:
        if not camera.active:
            return []
        dir_vectors = [(0, -1), (1, 0), (0, 1), (-1, 0)]
        dx, dy = dir_vectors[camera.direction % 4]
        perp_dx, perp_dy = -dy, dx
        visible = []
        for dist in range(1, camera.cone_length + 1):
            cx, cy = camera.x + dx * dist, camera.y + dy * dist
            half_w = max(1, dist // 2)
            for w in range(-half_w, half_w + 1):
                vx, vy = cx + perp_dx * w, cy + perp_dy * w
                if self.is_walkable(vx, vy):
                    visible.append((vx, vy))
        return visible

    def tick_lockdowns(self):
        for row in self.grid:
            for cell in row:
                if cell.lockdown_turns > 0:
                    cell.lockdown_turns -= 1

    def to_dict(self) -> dict:
        grid_data = []
        for row in self.grid:
            grid_data.append([
                {
                    "x": c.x, "y": c.y,
                    "type": c.cell_type.value,
                    "room_id": c.room_id,
                    "walkable": c.cell_type != CellType.WALL and c.lockdown_turns <= 0,
                    "sensor": c.sensor.value if c.sensor else None,
                    "objective": c.objective.value if c.objective else None,
                    "is_locked": c.is_locked,
                    "lockdown": c.lockdown_turns,
                }
                for c in row
            ])

        entries = [(c.x, c.y) for row in self.grid for c in row if c.cell_type == CellType.ENTRY]
        extractions = [(c.x, c.y) for row in self.grid for c in row if c.cell_type == CellType.EXTRACTION]
        objectives = [
            {"id": c.objective.value, "pos": [c.x, c.y], "label": c.objective.value}
            for row in self.grid for c in row if c.objective is not None
        ]

        return {
            "width": self.width,
            "height": self.height,
            "name": self.name,
            "grid": grid_data,
            "cameras": [
                {
                    "id": cam.camera_id,
                    "pos": [cam.x, cam.y],
                    "direction": cam.direction,
                    "active": cam.active,
                    "vision": self.get_camera_vision(cam),
                }
                for cam in self.cameras
            ],
            "entries": entries,
            "extraction_points": extractions,
            "objectives": objectives,
        }


def create_medium_building() -> Building:
    """
    Create a 30x25 building with multiple wings, corridors, vents, and
    alternate routes to make gameplay richer and more unpredictable.

    Layout key:
      # = wall, . = floor, - = corridor, D = door
      E = entry, X = extraction
      S = hack_server, L = steal_loot, A = disable_alarm
      C = disable_camera, V = vent (floor shortcut)
    """
    layout = [
        "##############################",  # 0
        "#E...#------#.....#....#....X#",  # 1
        "#....#------#.....#....#.....#",  # 2
        "#....D------D.....D....D.....#",  # 3
        "#....#------#.....#....#.....#",  # 4
        "######------###D########.....#",  # 5
        "#....D------D.........#......#",  # 6
        "#....#------#.........D......#",  # 7
        "#..A.#------#.........#......#",  # 8
        "#....#------#.........########",  # 9
        "######------###D####D##.....##",  # 10
        "#....D------D......#..#......#",  # 11
        "#....#------#......D..D......#",  # 12
        "#....#------#..S...#..#..C...#",  # 13
        "#....#------#......#..#......#",  # 14
        "######------###D####..####D###",  # 15
        "#....D------D......#.........#",  # 16
        "#....#------#......#.........#",  # 17
        "#....#------#..L...D........X#",  # 18
        "#....#------#......#.........#",  # 19
        "######------###D####.........#",  # 20
        "#....D------D.....#..........#",  # 21
        "#....#------#.....#..........#",  # 22
        "#.E..#------#.....D.........X#",  # 23
        "##############################",  # 24
    ]

    char_map = {
        "#": CellType.WALL, ".": CellType.FLOOR, "-": CellType.CORRIDOR,
        "D": CellType.DOOR, "E": CellType.ENTRY, "X": CellType.EXTRACTION,
        "S": CellType.FLOOR, "L": CellType.FLOOR, "A": CellType.FLOOR,
        "C": CellType.FLOOR, "V": CellType.FLOOR,
    }
    objective_map = {
        "S": ObjectiveType.HACK_SERVER,
        "L": ObjectiveType.STEAL_LOOT,
        "A": ObjectiveType.DISABLE_ALARM,
        "C": ObjectiveType.DISABLE_CAMERA,
    }

    height = len(layout)
    width = len(layout[0])
    grid: list[list[Cell]] = []

    for y, row in enumerate(layout):
        grid_row: list[Cell] = []
        for x, ch in enumerate(row):
            ct = char_map.get(ch, CellType.WALL)
            obj = objective_map.get(ch)
            cell = Cell(x=x, y=y, cell_type=ct, objective=obj)
            if ch == "D":
                cell.sensor = SensorType.DOOR_SENSOR
            grid_row.append(cell)
        grid.append(grid_row)

    cameras = [
        Camera("cam_1", 12, 6, direction=1),   # East-facing in upper wing
        Camera("cam_2", 12, 12, direction=2),   # South-facing mid area
        Camera("cam_3", 18, 11, direction=3),   # West-facing right wing
        Camera("cam_4", 22, 18, direction=0),   # North-facing near loot
    ]

    return Building(width=width, height=height, grid=grid,
                    cameras=cameras, name="Diamond Exchange")
