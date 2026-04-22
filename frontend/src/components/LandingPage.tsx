/* ── LandingPage — cinematic cyberpunk entry screen ── */
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { createGame, connectWebSocket } from '../api/client'
import { normalizeAgent, normalizeGuard, normalizeBuilding } from '../api/normalize'
import HowToPlay from './HowToPlay'

// ── Floating particles ──
function Particles({ count = 120 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i++) {
      arr[i] = (Math.random() - 0.5) * 30
    }
    return arr
  }, [count])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.02
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.01) * 0.1
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#00d4ff" size={0.06} transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

// ── Slowly rotating wireframe building ──
function RotatingBuilding() {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.08
    }
  })

  return (
    <group ref={ref} position={[0, -1, 0]}>
      {/* A simple wireframe grid representing the building */}
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 5 }).map((_, col) => {
          const h = 0.5 + Math.random() * 1.5
          return (
            <mesh key={`${row}-${col}`} position={[(row - 2) * 1.2, h / 2, (col - 2) * 1.2]}>
              <boxGeometry args={[1, h, 1]} />
              <meshStandardMaterial
                color="#16213e"
                wireframe
                transparent
                opacity={0.4}
              />
            </mesh>
          )
        }),
      )}
      {/* Neon floor grid */}
      <gridHelper args={[8, 8, '#00d4ff', '#0a0a2e']} />
    </group>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  title: {
    fontSize: 64,
    fontWeight: 900,
    fontFamily: 'monospace',
    letterSpacing: 8,
    color: '#fff',
    textShadow: '0 0 40px #00d4ff, 0 0 80px #00d4ff55',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#888',
    letterSpacing: 4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  pitch: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#aaa',
    textAlign: 'center' as const,
    maxWidth: 520,
    lineHeight: 1.7,
    marginBottom: 36,
  },
  btnGroup: {
    display: 'flex',
    gap: 20,
    pointerEvents: 'auto',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  secondaryBtnGroup: {
    display: 'flex',
    gap: 16,
    pointerEvents: 'auto',
    marginTop: 20,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  btn: {
    padding: '16px 40px',
    border: '2px solid',
    borderRadius: 8,
    background: 'rgba(10, 10, 25, 0.7)',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    backdropFilter: 'blur(10px)',
    transition: 'all 0.2s',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#444',
    letterSpacing: 2,
    zIndex: 10,
  },
}

export default function LandingPage() {
  const setScreen = useGameStore((s) => s.setScreen)
  const setGameMode = useGameStore((s) => s.setGameMode)
  const setGameId = useGameStore((s) => s.setGameId)
  const setBuilding = useGameStore((s) => s.setBuilding)
  const setCrew = useGameStore((s) => s.setCrew)
  const setGuards = useGameStore((s) => s.setGuards)
  const setIsTutorial = useGameStore((s) => s.setIsTutorial)
  const setTutorialStep = useGameStore((s) => s.setTutorialStep)
  const setShowHowToPlay = useGameStore((s) => s.setShowHowToPlay)
  const showHowToPlay = useGameStore((s) => s.showHowToPlay)

  const startGame = async (mode: 'pvai' | 'spectator', tutorial = false) => {
    try {
      const data = await createGame(mode) as {
        game_id: string
        building: Record<string, unknown>
        state: { crew: Record<string, unknown>[]; guards: Record<string, unknown>[] }
      }
      setGameId(data.game_id)
      setGameMode(mode)
      setBuilding(normalizeBuilding(data.building))
      if (data.state?.crew) setCrew(data.state.crew.map(normalizeAgent))
      if (data.state?.guards) setGuards(data.state.guards.map(normalizeGuard))
      connectWebSocket(data.game_id)
      if (tutorial) {
        setIsTutorial(true)
        setTutorialStep(0)
      }
      setScreen('game')
    } catch (err) {
      console.error('Failed to create game:', err)
    }
  }

  return (
    <div style={s.container}>
      {/* 3D Background */}
      <Canvas camera={{ position: [0, 4, 8], fov: 50 }} style={{ position: 'absolute', inset: 0 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[5, 5, 5]} intensity={0.4} color="#00d4ff" />
        <pointLight position={[-5, 3, -5]} intensity={0.3} color="#e94560" />
        <fog attach="fog" args={['#0a0a1a', 8, 25]} />
        <RotatingBuilding />
        <Particles />
      </Canvas>

      {/* Overlay */}
      <div style={s.overlay}>
        <div style={s.title}>HEIST ARCHITECT</div>
        <div style={s.subtitle}>Multi-Agent Pathfinding Strategy Game</div>

        <div style={s.pitch}>
          Command a crew of 3 specialists to pull off the perfect heist.
          Navigate guards, cameras, and sensors in this turn-based strategy game powered by 5 AI algorithms.
          Outsmart the AI Warden — or watch two AIs battle it out.
        </div>

        <div style={s.btnGroup}>
          <button
            style={{ ...s.btn, borderColor: '#00d4ff', color: '#00d4ff' }}
            onClick={() => startGame('pvai')}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(10, 10, 25, 0.7)'
            }}
          >
            Play as Mastermind
          </button>
          <button
            style={{ ...s.btn, borderColor: '#e94560', color: '#e94560' }}
            onClick={() => startGame('spectator')}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(233, 69, 96, 0.15)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(10, 10, 25, 0.7)'
            }}
          >
            Watch AI vs AI
          </button>
        </div>

        <div style={s.secondaryBtnGroup}>
          <button
            style={{ ...s.btn, borderColor: '#00ff88', color: '#00ff88', padding: '12px 28px', fontSize: 12 }}
            onClick={() => startGame('pvai', true)}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.15)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(10, 10, 25, 0.7)'
            }}
          >
            📖 Interactive Tutorial
          </button>
          <button
            style={{ ...s.btn, borderColor: '#ffcc00', color: '#ffcc00', padding: '12px 28px', fontSize: 12 }}
            onClick={() => setShowHowToPlay(true)}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 204, 0, 0.15)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(10, 10, 25, 0.7)'
            }}
          >
            ❓ How to Play
          </button>
        </div>
      </div>

      <div style={s.footer}>CS 2005 — Artificial Intelligence Lab Project</div>

      {/* How to Play overlay */}
      {showHowToPlay && <HowToPlay asModal />}
    </div>
  )
}
