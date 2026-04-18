/* ── Agents3D — crew members + guards as 3D meshes ── */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

const ROLE_COLORS: Record<string, string> = {
  hacker: '#00ff88',
  thief: '#e94560',
  muscle: '#ff6b35',
}

const GUARD_COLOR = '#ff0055'

function CrewAgent({ agent }: { agent: { agent_id: string; role: string; pos: [number, number] } }) {
  const ref = useRef<THREE.Mesh>(null)
  const color = ROLE_COLORS[agent.role] || '#ffffff'
  const targetPos = useRef(new THREE.Vector3(agent.pos[0], 0.4, agent.pos[1]))

  // Smoothly interpolate to target position
  useFrame(() => {
    if (ref.current) {
      targetPos.current.set(agent.pos[0], 0.4, agent.pos[1])
      ref.current.position.lerp(targetPos.current, 0.12)
      // Gentle hover bob
      ref.current.position.y += Math.sin(Date.now() * 0.003) * 0.03
    }
  })

  return (
    <group>
      <mesh ref={ref} position={[agent.pos[0], 0.4, agent.pos[1]]}>
        <capsuleGeometry args={[0.15, 0.3, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Point light for glow */}
      <pointLight position={[agent.pos[0], 0.6, agent.pos[1]]} color={color} intensity={0.6} distance={2} />
    </group>
  )
}

function GuardAgent({ guard }: { guard: { guard_id: string; pos: [number, number]; patrol: [number, number][]; knocked_out: boolean; vision: [number, number][] } }) {
  const ref = useRef<THREE.Mesh>(null)
  const targetPos = useRef(new THREE.Vector3(guard.pos[0], 0.4, guard.pos[1]))

  useFrame(() => {
    if (ref.current) {
      targetPos.current.set(guard.pos[0], 0.4, guard.pos[1])
      ref.current.position.lerp(targetPos.current, 0.12)
    }
  })

  if (guard.knocked_out) return null

  return (
    <group>
      <mesh ref={ref} position={[guard.pos[0], 0.4, guard.pos[1]]}>
        <capsuleGeometry args={[0.18, 0.35, 4, 8]} />
        <meshStandardMaterial color={GUARD_COLOR} emissive={GUARD_COLOR} emissiveIntensity={0.4} />
      </mesh>

      {/* Patrol route lines */}
      {guard.patrol.length > 1 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={guard.patrol.length}
              array={new Float32Array(guard.patrol.flatMap(([x, y]) => [x, 0.05, y]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={GUARD_COLOR} transparent opacity={0.3} />
        </line>
      )}

      {/* Vision cells */}
      {guard.vision.map(([vx, vy], i) => (
        <mesh key={i} position={[vx, 0.02, vy]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial color={GUARD_COLOR} transparent opacity={0.08} />
        </mesh>
      ))}
    </group>
  )
}

export default function Agents3D() {
  const crew = useGameStore((s) => s.crew)
  const guards = useGameStore((s) => s.guards)

  return (
    <group>
      {crew.map((agent) => (
        <CrewAgent key={agent.agent_id} agent={agent} />
      ))}
      {guards.map((guard) => (
        <GuardAgent key={guard.guard_id} guard={guard} />
      ))}
    </group>
  )
}
