/* ── WaypointPicker — raycasting click-to-set-waypoint on 3D grid ── */
import { useCallback } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '../store/gameStore'

export default function WaypointPicker() {
  const building = useGameStore((s) => s.building)
  const selectedAgent = useGameStore((s) => s.selectedAgent)
  const setWaypoint = useGameStore((s) => s.setWaypoint)

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!selectedAgent || !building) return
      e.stopPropagation()

      // Convert intersection point to grid coordinates
      const x = Math.round(e.point.x)
      const z = Math.round(e.point.z)

      // Validate within bounds and walkable
      if (x < 0 || x >= building.width || z < 0 || z >= building.height) return
      const cell = building.grid[z]?.[x]
      if (!cell || !cell.walkable) return

      setWaypoint(selectedAgent, [x, z])
    },
    [selectedAgent, building, setWaypoint],
  )

  if (!building) return null

  return (
    <mesh
      position={[building.width / 2 - 0.5, 0.001, building.height / 2 - 0.5]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
    >
      <planeGeometry args={[building.width, building.height]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
