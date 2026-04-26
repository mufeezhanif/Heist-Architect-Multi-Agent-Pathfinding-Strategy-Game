/* ── Data normalization — backend → frontend type adapters ── */
import type { Agent, Guard, Building } from '../store/gameStore'

export function normalizeAgent(raw: Record<string, unknown>): Agent {
  return {
    agent_id: (raw.id as string) || (raw.agent_id as string) || '',
    role: raw.role as string,
    pos: [raw.x as number, raw.y as number],
    alive: raw.alive !== undefined ? (raw.alive as boolean) : !(raw.detected as boolean),
    abilities: (raw.abilities as string[]) || [],
    ability_uses: (raw.ability_uses as Record<string, number>) || {},
    ability_cooldowns: (raw.ability_cooldowns as Record<string, number>) || {},
    detected: (raw.detected as boolean) || false,
  }
}

export function normalizeGuard(raw: Record<string, unknown>): Guard {
  const patrolRoute = (raw.patrol_route || raw.patrol || []) as [number, number][]
  return {
    guard_id: (raw.id as string) || (raw.guard_id as string) || '',
    pos: [raw.x as number, raw.y as number],
    patrol: patrolRoute,
    patrol_type: (raw.patrol_type as string) || 'linear',
    knocked_out: (raw.knocked_out as boolean) || false,
    knocked_out_turns: (raw.knocked_out_turns as number) || 0,
    vision: (raw.vision as [number, number][]) || [],
  }
}

export function normalizeBuilding(raw: Record<string, unknown>): Building {
  const grid = raw.grid as Record<string, unknown>[][]
  return {
    width: raw.width as number,
    height: raw.height as number,
    grid: grid.map((row) =>
      row.map((c) => ({
        type: c.type as string,
        room_id: (c.room_id as string) || null,
        walkable: (c.walkable as boolean) || false,
        sensor: (c.sensor as string) || null,
      })),
    ),
    cameras: ((raw.cameras || []) as Record<string, unknown>[]).map((cam) => ({
      id: cam.id as string,
      pos: (cam.pos as [number, number]) || [cam.x as number, cam.y as number],
      direction: String(cam.direction),
      active: cam.active !== undefined ? (cam.active as boolean) : true,
      vision: (cam.vision || []) as [number, number][],
    })),
    entries: (raw.entries || []) as [number, number][],
    extraction_points: (raw.extraction_points || []) as [number, number][],
    objectives: (raw.objectives || []) as { id: string; pos: [number, number]; label: string }[],
  }
}
