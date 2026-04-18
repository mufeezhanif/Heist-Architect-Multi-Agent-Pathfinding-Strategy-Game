/* ── Building3D — renders the building grid as 3D geometry ── */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

const CELL = 1 // 1 unit per cell
const WALL_H = 1.6
const FLOOR_Y = 0
const COLORS = {
  floor: '#1a1a2e',
  wall: '#16213e',
  corridor: '#0f0f23',
  door: '#e94560',
  objective: '#00ff88',
  entry: '#00d4ff',
  extraction: '#ff6b35',
  wallEdge: '#00d4ff',
  camera: '#ff0055',
}

export default function Building3D() {
  const building = useGameStore((s) => s.building)

  const { walls, floors, doors, objectives, entries, extractions } = useMemo(() => {
    if (!building) return { walls: [], floors: [], doors: [], objectives: [], entries: [], extractions: [] }

    const walls: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const floors: { pos: [number, number, number]; color: string }[] = []
    const doors: [number, number][] = []
    const objectivesList: { pos: [number, number]; label: string }[] = []

    for (let y = 0; y < building.height; y++) {
      for (let x = 0; x < building.width; x++) {
        const cell = building.grid[y]?.[x]
        if (!cell) continue

        const wx = x * CELL
        const wz = y * CELL

        if (cell.type === 'wall') {
          walls.push({ pos: [wx, WALL_H / 2, wz], size: [CELL, WALL_H, CELL] })
        } else if (cell.type === 'door') {
          doors.push([wx, wz])
          floors.push({ pos: [wx, FLOOR_Y, wz], color: COLORS.door })
        } else if (cell.walkable) {
          const color = cell.type === 'corridor' ? COLORS.corridor : COLORS.floor
          floors.push({ pos: [wx, FLOOR_Y, wz], color })
        }
      }
    }

    for (const obj of building.objectives) {
      objectivesList.push({ pos: obj.pos, label: obj.id })
    }

    return {
      walls,
      floors,
      doors,
      objectives: objectivesList,
      entries: building.entries,
      extractions: building.extraction_points,
    }
  }, [building])

  if (!building) return null

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[building.width / 2 - 0.5, -0.01, building.height / 2 - 0.5]}>
        <planeGeometry args={[building.width + 2, building.height + 2]} />
        <meshStandardMaterial color="#080812" />
      </mesh>

      {/* Floor tiles */}
      {floors.map((f, i) => (
        <mesh key={`f${i}`} position={[f.pos[0], f.pos[1], f.pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CELL * 0.96, CELL * 0.96]} />
          <meshStandardMaterial color={f.color} transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Walls */}
      {walls.map((w, i) => (
        <mesh key={`w${i}`} position={w.pos}>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color={COLORS.wall} />
          {/* Neon edge glow */}
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...w.size)]} />
            <lineBasicMaterial color={COLORS.wallEdge} transparent opacity={0.15} />
          </lineSegments>
        </mesh>
      ))}

      {/* Doors */}
      {doors.map(([x, z], i) => (
        <mesh key={`d${i}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CELL * 0.9, CELL * 0.9]} />
          <meshStandardMaterial color={COLORS.door} emissive={COLORS.door} emissiveIntensity={0.4} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Objectives */}
      {objectives.map((obj, i) => (
        <group key={`obj${i}`} position={[obj.pos[0], 0.3, obj.pos[1]]}>
          <mesh>
            <octahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial color={COLORS.objective} emissive={COLORS.objective} emissiveIntensity={0.8} wireframe />
          </mesh>
          <pointLight color={COLORS.objective} intensity={1} distance={3} />
        </group>
      ))}

      {/* Entry points */}
      {entries.map(([x, y], i) => (
        <mesh key={`ent${i}`} position={[x, 0.05, y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.4, 6]} />
          <meshStandardMaterial color={COLORS.entry} emissive={COLORS.entry} emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Extraction points */}
      {extractions.map(([x, y], i) => (
        <mesh key={`ext${i}`} position={[x, 0.05, y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.4, 4]} />
          <meshStandardMaterial color={COLORS.extraction} emissive={COLORS.extraction} emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Camera sensors */}
      {building.cameras.map((cam, i) => (
        <group key={`cam${i}`} position={[cam.pos[0], 1.2, cam.pos[1]]}>
          <mesh>
            <coneGeometry args={[0.15, 0.3, 4]} />
            <meshStandardMaterial color={COLORS.camera} emissive={COLORS.camera} emissiveIntensity={0.6} />
          </mesh>
          {/* Vision cone (floor overlay) */}
          {cam.vision.map(([vx, vy], vi) => (
            <mesh key={vi} position={[vx - cam.pos[0], -1.15, vy - cam.pos[1]]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.9, 0.9]} />
              <meshStandardMaterial color={COLORS.camera} transparent opacity={0.1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
