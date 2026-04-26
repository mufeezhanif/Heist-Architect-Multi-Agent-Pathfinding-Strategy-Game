/* ── BayesianOverlay3D — heatmap on the building floor ── */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

function probToColor(p: number): THREE.Color {
  // Blue (cold) → Yellow → Red (hot)
  if (p < 0.3) {
    return new THREE.Color(0, p * 2, 1 - p * 2)
  } else if (p < 0.6) {
    const t = (p - 0.3) / 0.3
    return new THREE.Color(t, 1, 0)
  } else {
    const t = (p - 0.6) / 0.4
    return new THREE.Color(1, 1 - t, 0)
  }
}

export default function BayesianOverlay3D() {
  const heatmap = useGameStore((s) => s.bayesianHeatmap)
  const show = useGameStore((s) => s.showBayesian)
  const guards = useGameStore((s) => s.guards)

  const cells = useMemo(() => {
    if (!show) return []
    const entries = Object.entries(heatmap)
      .map(([key, prob]) => {
        const [x, y] = key.split(',').map(Number)
        if (isNaN(x) || isNaN(y) || prob <= 0) return null
        return { x, y, prob }
      })
      .filter(Boolean) as { x: number; y: number; prob: number }[]

    if (entries.length === 0) return []

    const nearGuards = entries.filter((cell) =>
      guards.some((g) => Math.abs(g.pos[0] - cell.x) + Math.abs(g.pos[1] - cell.y) <= 10),
    )

    const candidates = nearGuards.length > 0 ? nearGuards : entries
    const candidateMaxProb = Math.max(...candidates.map((c) => c.prob), 0.0001)

    return candidates
      .filter((c) => c.prob / candidateMaxProb >= 0.05)
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 220)
      .map((c) => {
        const intensity = Math.min(1, c.prob / candidateMaxProb)
        return {
          x: c.x,
          y: c.y,
          prob: intensity,
          color: probToColor(intensity),
        }
      })
  }, [heatmap, show, guards])

  if (!show || cells.length === 0) return null

  return (
    <group>
      {cells.map(({ x, y, prob, color }) => (
        <mesh key={`${x},${y}`} position={[x, 0.08, y]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3 + prob * 1.1}
            transparent
            opacity={Math.min(0.25 + prob * 0.65, 0.88)}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
