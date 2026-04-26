/* ── Building3D — renders the building grid as 3D geometry ── */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useGameStore } from '../store/gameStore'

const CELL = 1 // 1 unit per cell
const WALL_H = 1.6
const FLOOR_Y = 0
function getColors(theme: 'dark' | 'light') {
  if (theme === 'light') {
    return {
      ground: '#dbe8f7',
      floor: '#c9dbef',
      wall: '#7f98b5',
      corridor: '#bdd2e9',
      door: '#c85b77',
      objective: '#148f57',
      entry: '#0a8fb5',
      extraction: '#d86a2d',
      camera: '#cc3a6a',
      door_sensor: '#c58a1e',
      motion_sensor: '#0aa2c7',
      sound_sensor: '#b24aa8',
    }
  }
  return {
    ground: '#080812',
    floor: '#1a1a2e',
    wall: '#16213e',
    corridor: '#0f0f23',
    door: '#e94560',
    objective: '#00ff88',
    entry: '#00d4ff',
    extraction: '#ff6b35',
    camera: '#ff0055',
    door_sensor: '#ffaa00',
    motion_sensor: '#00ffff',
    sound_sensor: '#ff00ff',
  }
}

function objectiveAssignment(objectiveId: string): { agent: string; color: string; task: string } {
  if (objectiveId === 'disable_alarm') return { agent: 'Hacker', color: '#00ff66', task: 'Disable alarm' }
  if (objectiveId === 'disable_camera') return { agent: 'Hacker', color: '#00ff66', task: 'Disable camera network' }
  if (objectiveId === 'hack_server') return { agent: 'Hacker', color: '#00ff66', task: 'Hack server' }
  if (objectiveId === 'steal_loot') return { agent: 'Thief', color: '#ff003c', task: 'Steal loot' }
  return { agent: 'Muscle', color: '#fcee0a', task: objectiveId.replaceAll('_', ' ') }
}

export default function Building3D() {
  const building = useGameStore((s) => s.building)
  const showSecurityLabels = useGameStore((s) => s.showSecurityLabels)
  const uiTheme = useGameStore((s) => s.uiTheme)
  const colors = useMemo(() => getColors(uiTheme), [uiTheme])

  const { walls, floors, doors, objectives, entries, extractions, sensors } = useMemo(() => {
    if (!building) return { walls: [], floors: [], doors: [], objectives: [], entries: [], extractions: [], sensors: [] }

    const walls: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const floors: { pos: [number, number, number]; color: string }[] = []
    const doors: [number, number][] = []
    const objectivesList: { pos: [number, number]; label: string }[] = []
    const sensorsList: { pos: [number, number]; type: string }[] = []

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
          floors.push({ pos: [wx, FLOOR_Y, wz], color: colors.door })
        } else if (cell.walkable) {
          const color = cell.type === 'corridor' ? colors.corridor : colors.floor
          floors.push({ pos: [wx, FLOOR_Y, wz], color })
        }

        // Add sensor if present on this cell
        if (cell.sensor) {
          sensorsList.push({ pos: [wx, wz], type: cell.sensor })
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
      sensors: sensorsList,
    }
  }, [building, colors])

  if (!building) return null

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[building.width / 2 - 0.5, -0.01, building.height / 2 - 0.5]}>
        <planeGeometry args={[building.width + 2, building.height + 2]} />
        <meshStandardMaterial color={colors.ground} />
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
          <meshStandardMaterial color={colors.wall} />
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...w.size)]} />
            <lineBasicMaterial color={uiTheme === 'light' ? '#5e7da0' : '#00d4ff'} transparent opacity={0.2} />
          </lineSegments>
        </mesh>
      ))}

      {/* Doors (red/pink) */}
      {doors.map(([x, z], i) => (
        <group key={`d${i}`} position={[x, 0.05, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CELL * 0.9, CELL * 0.9]} />
            <meshStandardMaterial color={colors.door} emissive={colors.door} emissiveIntensity={0.3} transparent opacity={0.5} />
          </mesh>
          {/* Door label */}
          <Html position={[0, 0.25, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(233, 69, 96, 0.15)',
              border: '1px solid #e94560',
              borderRadius: 3,
              padding: '1px 4px',
              fontFamily: 'monospace',
              fontSize: 7,
              fontWeight: 700,
              color: '#e94560',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
            }}>
              🚪 door
            </div>
          </Html>
        </group>
      ))}

      {/* Objectives (green) */}
      {objectives.map((obj, i) => (
        <group key={`obj${i}`} position={[obj.pos[0], 0.3, obj.pos[1]]}>
          <mesh>
            <octahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial color={colors.objective} emissive={colors.objective} emissiveIntensity={0.6} wireframe />
          </mesh>
          {/* Objective label */}
          <Html position={[0, 0.45, 0]} center style={{ pointerEvents: 'none' }}>
            {(() => {
              const assignment = objectiveAssignment(obj.label)
              return (
            <div style={{
              background: `${assignment.color}22`,
              border: `1px solid ${assignment.color}`,
              borderRadius: 3,
              padding: '1px 4px',
              fontFamily: 'monospace',
              fontSize: 7,
              fontWeight: 700,
              color: assignment.color,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
            }}>
              🎯 {assignment.task} · {assignment.agent}
            </div>
              )
            })()}
          </Html>
        </group>
      ))}

      {/* Entry points (cyan) */}
      {entries.map(([x, y], i) => (
        <mesh key={`ent${i}`} position={[x, 0.05, y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.4, 4]} />
            <meshStandardMaterial color={colors.entry} emissive={colors.entry} emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Extraction points (orange) */}
      {extractions.map(([x, y], i) => (
        <group key={`ext${i}`} position={[x, 0.05, y]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 0.4, 4]} />
            <meshStandardMaterial color={colors.extraction} emissive={colors.extraction} emissiveIntensity={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* Extraction label */}
          <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(255, 107, 53, 0.15)',
              border: '1px solid #ff6b35',
              borderRadius: 3,
              padding: '1px 4px',
              fontFamily: 'monospace',
              fontSize: 7,
              fontWeight: 700,
              color: '#ff6b35',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
            }}>
              🚪 extract
            </div>
          </Html>
        </group>
      ))}

      {/* Camera sensors */}
      {building.cameras.map((cam, i) => (
        <group key={`cam${i}`} position={[cam.pos[0], 1.2, cam.pos[1]]}>
          <mesh>
            <coneGeometry args={[0.15, 0.3, 3]} />
            <meshStandardMaterial color={colors.camera} emissive={colors.camera} emissiveIntensity={0.5} />
          </mesh>
          {/* Camera label */}
          {showSecurityLabels && (
            <Html position={[0, -0.3, 0]} center style={{ pointerEvents: 'none' }}>
              <div style={{
                background: 'rgba(255, 0, 85, 0.15)',
                border: '1px solid #ff0055',
                borderRadius: 3,
                padding: '1px 4px',
                fontFamily: 'monospace',
                fontSize: 7,
                fontWeight: 700,
                color: '#ff0055',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                textShadow: '0 0 4px rgba(0,0,0,0.8)',
              }}>
                📷 camera
              </div>
            </Html>
          )}
        </group>
      ))}

      {/* Motion/Door/Sound Sensors */}
      {sensors.map((sensor, i) => {
        const sensorColor = colors[sensor.type as keyof typeof colors] || '#ffffff'
        const sensorLabel = sensor.type.replace('_', ' ').toUpperCase()
        return (
          <group key={`sensor${i}`} position={[sensor.pos[0], 0.5, sensor.pos[1]]}>
            {/* Sensor indicator */}
            <mesh>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshStandardMaterial color={sensorColor} emissive={sensorColor} emissiveIntensity={0.8} />
            </mesh>
            {/* Sensor label */}
            {showSecurityLabels && (
              <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                  background: `${sensorColor}22`,
                  border: `1px solid ${sensorColor}`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontFamily: 'monospace',
                  fontSize: 8,
                  fontWeight: 700,
                  color: sensorColor,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 4px rgba(0,0,0,0.8)',
                }}>
                  🔔 {sensorLabel}
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
