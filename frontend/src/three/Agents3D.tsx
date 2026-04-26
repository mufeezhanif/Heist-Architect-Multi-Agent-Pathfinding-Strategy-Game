/* ── Agents3D — crew + guards as distinctive 3D character models ── */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

const ROLE_COLORS: Record<string, string> = {
  hacker: '#00ff66',
  thief: '#00f0ff',
  muscle: '#fcee0a',
}

const ROLE_EMOJI: Record<string, string> = {
  hacker: '💻',
  thief: '🦊',
  muscle: '💪',
}

const GUARD_COLOR = '#ff003c'

/* ── Hacker Character — slim body, hoodie, antenna/signal ── */
function HackerModel({ color }: { color: string }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.25, 0.35, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#e0d0c0" />
      </mesh>
      {/* Hood */}
      <mesh position={[0, 0.6, -0.02]}>
        <sphereGeometry args={[0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Visor / glasses */}
      <mesh position={[0, 0.54, 0.1]}>
        <boxGeometry args={[0.18, 0.04, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      {/* Antenna — signal */}
      <mesh position={[0.1, 0.75, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.15, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.1, 0.85, 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.06, 0.03, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.08]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.06, 0.03, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.08]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  )
}

/* ── Thief Character — cat-ear mask, sleek body ── */
function ThiefModel({ color }: { color: string }) {
  return (
    <group>
      {/* Body — sleek */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.22, 0.35, 0.18]} />
        <meshStandardMaterial color="#1a1a1a" emissive={color} emissiveIntensity={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* Cat ears */}
      <mesh position={[-0.09, 0.7, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.04, 0.1, 3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.09, 0.7, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.04, 0.1, 3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Eyes — glowing */}
      <mesh position={[-0.04, 0.56, 0.1]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.04, 0.56, 0.1]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      {/* Belt / utility */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.24, 0.04, 0.2]} />
        <meshStandardMaterial color="#444" emissive={color} emissiveIntensity={0.2} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.05, 0.03, 0]}>
        <boxGeometry args={[0.07, 0.12, 0.07]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.05, 0.03, 0]}>
        <boxGeometry args={[0.07, 0.12, 0.07]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  )
}

/* ── Muscle Character — big body, broad shoulders ── */
function MuscleModel({ color }: { color: string }) {
  return (
    <group>
      {/* Body — wide */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.35, 0.4, 0.25]} />
        <meshStandardMaterial color="#2d1810" emissive={color} emissiveIntensity={0.1} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[-0.22, 0.4, 0]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#2d1810" emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0.22, 0.4, 0]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#2d1810" emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Head — larger */}
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>
      {/* Mohawk / crest */}
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[0.04, 0.12, 0.12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      {/* Fists */}
      <mesh position={[-0.25, 0.15, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#d4a574" emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.25, 0.15, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#d4a574" emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Legs — thick */}
      <mesh position={[-0.08, 0.03, 0]}>
        <boxGeometry args={[0.12, 0.14, 0.1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.08, 0.03, 0]}>
        <boxGeometry args={[0.12, 0.14, 0.1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  )
}

/* ── Guard Character — helmet, armor, red ── */
function GuardModel({ color }: { color: string }) {
  return (
    <group>
      {/* Body — armored */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.3, 0.38, 0.22]} />
        <meshStandardMaterial color="#1a0a0a" emissive={color} emissiveIntensity={0.1} />
      </mesh>
      {/* Armor plate */}
      <mesh position={[0, 0.3, 0.12]}>
        <boxGeometry args={[0.22, 0.2, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Helmet */}
      <mesh position={[0, 0.64, 0]}>
        <sphereGeometry args={[0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#222" emissive={color} emissiveIntensity={0.1} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 0.56, 0.11]}>
        <boxGeometry args={[0.16, 0.05, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.07, 0.03, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.09]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 0.03, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.09]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  )
}

const MODEL_MAP: Record<string, React.FC<{ color: string }>> = {
  hacker: HackerModel,
  thief: ThiefModel,
  muscle: MuscleModel,
}

function CrewAgent({ agent }: { agent: { agent_id: string; role: string; pos: [number, number]; alive: boolean } }) {
  const ref = useRef<THREE.Group>(null)
  const color = ROLE_COLORS[agent.role] || '#ffffff'
  const emoji = ROLE_EMOJI[agent.role] || '👤'
  const targetPos = useRef(new THREE.Vector3(agent.pos[0], 0, agent.pos[1]))
  const selectedAgent = useGameStore((s) => s.selectedAgent)
  const isSelected = selectedAgent === agent.agent_id
  const CharModel = MODEL_MAP[agent.role] || HackerModel

  useFrame(() => {
    if (ref.current) {
      targetPos.current.set(agent.pos[0], 0, agent.pos[1])
      ref.current.position.lerp(targetPos.current, 0.1)
      // Gentle hover bob
      ref.current.position.y = Math.sin(Date.now() * 0.003) * 0.03
    }
  })

  if (!agent.alive) return null

  return (
    <group ref={ref} position={[agent.pos[0], 0, agent.pos[1]]}>
      <CharModel color={color} />

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.38, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Glow light - only when selected */}
      {isSelected && <pointLight position={[0, 0.6, 0]} color={color} intensity={0.6} distance={2} />}

      {/* Floating label */}
      <Html position={[0, 1, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: isSelected ? `${color}33` : 'rgba(0,0,0,0.6)',
          border: `1px solid ${isSelected ? color : color + '44'}`,
          borderRadius: 6,
          padding: '2px 6px',
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: 700,
          color,
          textTransform: 'uppercase',
          letterSpacing: 1,
          whiteSpace: 'nowrap',
          textShadow: '0 0 8px rgba(0,0,0,0.8)',
        }}>
          {emoji} {agent.role}
        </div>
      </Html>
    </group>
  )
}

function GuardAgent({ guard }: { guard: { guard_id: string; pos: [number, number]; patrol: [number, number][]; knocked_out: boolean; vision: [number, number][] } }) {
  const ref = useRef<THREE.Group>(null)
  const targetPos = useRef(new THREE.Vector3(guard.pos[0], 0, guard.pos[1]))

  useFrame(() => {
    if (ref.current) {
      targetPos.current.set(guard.pos[0], 0, guard.pos[1])
      ref.current.position.lerp(targetPos.current, 0.1)
    }
  })

  if (guard.knocked_out) return null

  return (
    <group ref={ref} position={[guard.pos[0], 0, guard.pos[1]]}>
      <GuardModel color={GUARD_COLOR} />

      {/* Patrol route lines */}
      {guard.patrol.length > 1 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={guard.patrol.length}
              array={new Float32Array(guard.patrol.flatMap(([x, y]) => [x - guard.pos[0], 0.05, y - guard.pos[1]]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={GUARD_COLOR} transparent opacity={0.2} />
        </line>
      )}

      {/* Vision cells */}
      {guard.vision.map(([vx, vy], i) => (
        <mesh key={i} position={[vx - guard.pos[0], 0.02, vy - guard.pos[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial color={GUARD_COLOR} transparent opacity={0.08} />
        </mesh>
      ))}

      {/* Label */}
      <Html position={[0, 0.95, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(40,0,0,0.7)',
          border: '1px solid #ff005544',
          borderRadius: 6,
          padding: '2px 6px',
          fontFamily: 'monospace',
          fontSize: 9,
          fontWeight: 700,
          color: GUARD_COLOR,
          whiteSpace: 'nowrap',
        }}>
          🛡️ GUARD
        </div>
      </Html>
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
