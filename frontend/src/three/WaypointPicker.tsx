/* ── WaypointPicker — click-to-move on 3D grid with hover effect ── */
import { useCallback, useState, useRef } from 'react'
import { ThreeEvent, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { sendWS } from '../api/client'

const ROLE_COLORS: Record<string, string> = {
  hacker: '#00ff88',
  thief: '#e94560',
  muscle: '#ff6b35',
}

export default function WaypointPicker() {
  const building = useGameStore((s) => s.building)
  const selectedAgent = useGameStore((s) => s.selectedAgent)
  const crew = useGameStore((s) => s.crew)
  const setWaypoint = useGameStore((s) => s.setWaypoint)
  const moveMode = useGameStore((s) => s.moveMode)
  const setPendingMove = useGameStore((s) => s.setPendingMove)
  const isTutorial = useGameStore((s) => s.isTutorial)
  const tutorialStep = useGameStore((s) => s.tutorialStep)
  const advanceTutorial = useGameStore((s) => s.advanceTutorial)
  const planning = useGameStore((s) => s.planning)

  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)
  const hoverRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef(0)

  // Animate hover cell pulse
  useFrame(() => {
    if (hoverRef.current && hoverCell) {
      pulseRef.current += 0.05
      hoverRef.current.material = hoverRef.current.material as THREE.MeshStandardMaterial
      const mat = hoverRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.15 + Math.sin(pulseRef.current) * 0.1
    }
  })

  const getGridPos = (point: THREE.Vector3): [number, number] | null => {
    if (!building) return null
    const x = Math.round(point.x)
    const z = Math.round(point.z)
    if (x < 0 || x >= building.width || z < 0 || z >= building.height) return null
    const cell = building.grid[z]?.[x]
    if (!cell || !cell.walkable) return null
    return [x, z]
  }

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!selectedAgent || !building || planning) return
      e.stopPropagation()

      const pos = getGridPos(e.point)
      if (!pos) return
      const [x, z] = pos

      if (moveMode === 'quick') {
        // Quick mode: set destination and auto-plan+execute
        setPendingMove(selectedAgent, [x, z])
        setWaypoint(selectedAgent, [x, z])

        // Auto plan + execute immediately
        const wp = { ...useGameStore.getState().waypoints, [selectedAgent]: [x, z] as [number, number] }
        useGameStore.getState().setPlanning(true)
        useGameStore.getState().clearCBSEvents()
        useGameStore.getState().clearNarration()
        sendWS({ action: 'plan', waypoints: wp })
        useGameStore.setState({ _autoExecuteAfterPlan: true } as Record<string, unknown>)
      } else {
        // Strategic mode: set waypoint as before
        setWaypoint(selectedAgent, [x, z])
      }

      // Advance tutorial on waypoint set
      if (isTutorial && tutorialStep === 3) advanceTutorial()
    },
    [selectedAgent, building, setWaypoint, moveMode, setPendingMove, isTutorial, tutorialStep, advanceTutorial, planning],
  )

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!building || !selectedAgent) {
        setHoverCell(null)
        return
      }
      const pos = getGridPos(e.point)
      setHoverCell(pos)
    },
    [building, selectedAgent],
  )

  const handlePointerLeave = useCallback(() => {
    setHoverCell(null)
  }, [])

  if (!building) return null

  const selectedCrewMember = crew.find((c) => c.agent_id === selectedAgent)
  const hoverColor = selectedCrewMember ? (ROLE_COLORS[selectedCrewMember.role] || '#00d4ff') : '#00d4ff'

  return (
    <group>
      {/* Invisible click plane */}
      <mesh
        position={[building.width / 2 - 0.5, 0.001, building.height / 2 - 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <planeGeometry args={[building.width, building.height]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Hover highlight */}
      {hoverCell && selectedAgent && (
        <mesh
          ref={hoverRef}
          position={[hoverCell[0], 0.06, hoverCell[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.92, 0.92]} />
          <meshStandardMaterial
            color={hoverColor}
            emissive={hoverColor}
            emissiveIntensity={0.6}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Waypoint destination markers */}
      {Object.entries(useGameStore.getState().waypoints).map(([agentId, wp]) => {
        const c = crew.find((c) => c.agent_id === agentId)
        const col = c ? (ROLE_COLORS[c.role] || '#fff') : '#fff'
        return (
          <group key={`wp-${agentId}`} position={[wp[0], 0.1, wp[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.2, 0.32, 8]} />
              <meshStandardMaterial
                color={col}
                emissive={col}
                emissiveIntensity={1}
                transparent
                opacity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
