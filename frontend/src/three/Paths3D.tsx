/* ── Paths3D — render CBS-resolved paths as glowing neon lines ── */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

const PATH_COLORS: Record<string, string> = {
  hacker: '#00ff88',
  thief: '#e94560',
  muscle: '#ff6b35',
}

export default function Paths3D() {
  const paths = useGameStore((s) => s.paths)

  const lines = useMemo(() => {
    return Object.entries(paths).map(([agentId, pathPoints]) => {
      if (!pathPoints || pathPoints.length < 2) return null
      const color = PATH_COLORS[agentId] || '#ffffff'
      const points = pathPoints.map(([x, y]) => new THREE.Vector3(x, 0.15, y))

      return { agentId, color, points }
    }).filter(Boolean) as { agentId: string; color: string; points: THREE.Vector3[] }[]
  }, [paths])

  return (
    <group>
      {lines.map(({ agentId, color, points }) => (
        <line key={agentId}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
        </line>
      ))}

      {/* Path endpoint markers */}
      {lines.map(({ agentId, color, points }) => {
        const end = points[points.length - 1]
        return (
          <mesh key={`end-${agentId}`} position={[end.x, 0.15, end.z]}>
            <ringGeometry args={[0.15, 0.25, 8]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.8}
              side={THREE.DoubleSide}
              transparent
              opacity={0.6}
            />
          </mesh>
        )
      })}
    </group>
  )
}
