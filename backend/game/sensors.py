"""
Heist Architect — Sensor System

Sensors detect agent activity and generate observations for
the Bayesian tracker. The Warden uses sensor events to update
beliefs about thief positions.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from game.building import Building


class SensorEventType(Enum):
    DOOR_TRIGGER = "door_trigger"
    DOOR_SILENT = "door_silent"
    MOTION_TRIGGER = "motion_trigger"
    MOTION_SILENT = "motion_silent"
    CAMERA_SPOTTED = "camera_spotted"
    CAMERA_CLEAR = "camera_clear"
    SOUND_HEARD = "sound_heard"


@dataclass
class SensorEvent:
    """A single sensor event from one turn."""
    sensor_id: str
    event_type: SensorEventType
    sensor_x: int
    sensor_y: int
    timestep: int
    triggered_by: str | None = None  # agent_id if known (camera only)
    exact_pos: tuple[int, int] | None = None


@dataclass
class Sensor:
    """Base sensor placed on the map."""
    sensor_id: str
    sensor_type: str  # "door", "motion", "camera", "sound"
    x: int
    y: int
    radius: int = 2
    active: bool = True


@dataclass
class SensorSystem:
    """Manages all sensors and checks for triggers each turn."""
    sensors: list[Sensor] = field(default_factory=list)

    def check_all(
        self,
        agent_positions: dict[str, tuple[int, int]],
        timestep: int,
        building: Building,
        special_actions: list[dict] | None = None,
    ) -> list[SensorEvent]:
        """
        Check all sensors against agent positions.
        Returns list of events (both triggers and silences).
        """
        events = []

        for sensor in self.sensors:
            if not sensor.active:
                continue

            triggered = False

            if sensor.sensor_type == "door":
                # Triggers when any agent is AT the door cell
                for aid, (ax, ay) in agent_positions.items():
                    if ax == sensor.x and ay == sensor.y:
                        events.append(SensorEvent(
                            sensor_id=sensor.sensor_id,
                            event_type=SensorEventType.DOOR_TRIGGER,
                            sensor_x=sensor.x, sensor_y=sensor.y,
                            timestep=timestep,
                            triggered_by=aid,
                        ))
                        triggered = True
                        break
                if not triggered:
                    events.append(SensorEvent(
                        sensor_id=sensor.sensor_id,
                        event_type=SensorEventType.DOOR_SILENT,
                        sensor_x=sensor.x, sensor_y=sensor.y,
                        timestep=timestep,
                    ))

            elif sensor.sensor_type == "motion":
                # Triggers when any agent is within radius
                for aid, (ax, ay) in agent_positions.items():
                    dist = abs(ax - sensor.x) + abs(ay - sensor.y)
                    if dist <= sensor.radius:
                        events.append(SensorEvent(
                            sensor_id=sensor.sensor_id,
                            event_type=SensorEventType.MOTION_TRIGGER,
                            sensor_x=sensor.x, sensor_y=sensor.y,
                            timestep=timestep,
                        ))
                        triggered = True
                        break
                if not triggered:
                    events.append(SensorEvent(
                        sensor_id=sensor.sensor_id,
                        event_type=SensorEventType.MOTION_SILENT,
                        sensor_x=sensor.x, sensor_y=sensor.y,
                        timestep=timestep,
                    ))

            elif sensor.sensor_type == "camera":
                # Triggers when agent is in camera cone
                cam_cells = _camera_cone(sensor, building)
                for aid, (ax, ay) in agent_positions.items():
                    if (ax, ay) in cam_cells:
                        events.append(SensorEvent(
                            sensor_id=sensor.sensor_id,
                            event_type=SensorEventType.CAMERA_SPOTTED,
                            sensor_x=sensor.x, sensor_y=sensor.y,
                            timestep=timestep,
                            triggered_by=aid,
                            exact_pos=(ax, ay),
                        ))
                        triggered = True
                        break
                if not triggered:
                    events.append(SensorEvent(
                        sensor_id=sensor.sensor_id,
                        event_type=SensorEventType.CAMERA_CLEAR,
                        sensor_x=sensor.x, sensor_y=sensor.y,
                        timestep=timestep,
                    ))

            elif sensor.sensor_type == "sound":
                # Triggers on special actions within radius
                if special_actions:
                    for action in special_actions:
                        ax, ay = action.get("x", 0), action.get("y", 0)
                        dist = abs(ax - sensor.x) + abs(ay - sensor.y)
                        if dist <= sensor.radius:
                            events.append(SensorEvent(
                                sensor_id=sensor.sensor_id,
                                event_type=SensorEventType.SOUND_HEARD,
                                sensor_x=sensor.x, sensor_y=sensor.y,
                                timestep=timestep,
                            ))
                            triggered = True
                            break

        return events


def _camera_cone(sensor: Sensor, building: Building) -> set[tuple[int, int]]:
    """Compute cells in a camera's vision cone (simplified)."""
    cells = set()
    # Assume direction is stored as metadata; default facing south
    direction = getattr(sensor, "direction", 2)
    dir_vectors = [(0, -1), (1, 0), (0, 1), (-1, 0)]
    dx, dy = dir_vectors[direction % 4]
    perp_dx, perp_dy = -dy, dx

    for dist in range(1, sensor.radius + 1):
        cx, cy = sensor.x + dx * dist, sensor.y + dy * dist
        half_w = max(1, dist // 2)
        for w in range(-half_w, half_w + 1):
            vx, vy = cx + perp_dx * w, cy + perp_dy * w
            if building.is_walkable(vx, vy):
                cells.add((vx, vy))
    return cells


def create_default_sensors(building: Building) -> SensorSystem:
    """Create sensors from the building's door positions and cameras."""
    sensors = []
    sid = 0

    # Door sensors on every door cell
    from game.building import CellType, SensorType as BSensorType
    for y in range(building.height):
        for x in range(building.width):
            cell = building.cell_at(x, y)
            if cell and cell.cell_type == CellType.DOOR:
                sid += 1
                sensors.append(Sensor(
                    sensor_id=f"door_{sid}",
                    sensor_type="door",
                    x=x, y=y, radius=1,
                ))

    # Motion sensors at key locations (near objectives on 30x25 map)
    motion_spots = [(12, 13), (23, 13), (5, 8), (15, 18)]
    for mx, my in motion_spots:
        sid += 1
        sensors.append(Sensor(
            sensor_id=f"motion_{sid}",
            sensor_type="motion",
            x=mx, y=my, radius=2,
        ))

    # Camera sensors from building cameras
    for cam in building.cameras:
        sid += 1
        s = Sensor(
            sensor_id=f"camera_{sid}",
            sensor_type="camera",
            x=cam.x, y=cam.y, radius=cam.cone_length,
        )
        s.direction = cam.direction  # type: ignore
        sensors.append(s)

    return SensorSystem(sensors=sensors)
