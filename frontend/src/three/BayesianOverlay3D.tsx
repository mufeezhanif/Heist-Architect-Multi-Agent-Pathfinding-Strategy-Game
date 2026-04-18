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

  const cells = useMemo(() => {
    if (!show) return []
    return Object.entries(heatmap)
      .map(([key, prob]) => {
        const [x, y] = key.split(',').map(Number)
        if (isNaN(x) || isNaN(y) || prob < 0.01) return null
        return { x, y, prob, color: probToColor(prob) }
      })
      .filter(Boolean) as { x: number; y: number; prob: number; color: THREE.Color }[]
  }, [heatmap, show])

  if (!show || cells.length === 0) return null

  return (
    <group>
      {cells.map(({ x, y, prob, color }) => (
        <mesh key={`${x},${y}`} position={[x, 0.08, y]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={prob * 0.5}
            transparent
            opacity={Math.min(prob * 2, 0.7)}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
