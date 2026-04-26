/* ── LandingPage — cinematic cyberpunk entry screen ── */
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { createGame, connectWebSocket } from '../api/client'
import { normalizeAgent, normalizeGuard, normalizeBuilding } from '../api/normalize'
import HowToPlay from './HowToPlay'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Eye, HelpCircle, BookOpen } from 'lucide-react'

// ── Floating particles ──
function Particles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i++) {
      arr[i] = (Math.random() - 0.5) * 40
    }
    return arr
  }, [count])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.015
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.01) * 0.05
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#00f0ff" size={0.08} transparent opacity={0.8} sizeAttenuation blending={THREE.AdditiveBlending} />
    </points>
  )
}

// ── Slowly rotating wireframe building ──
function RotatingBuilding() {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.05
    }
  })

  return (
    <group ref={ref} position={[0, -2, 0]}>
      {/* A simple wireframe grid representing the building */}
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: 7 }).map((_, col) => {
          const h = 0.5 + Math.random() * 2.5
          return (
            <mesh key={`${row}-${col}`} position={[(row - 3) * 1.5, h / 2, (col - 3) * 1.5]}>
              <boxGeometry args={[1.2, h, 1.2]} />
              <meshStandardMaterial
                color="#0a192f"
                emissive="#00f0ff"
                emissiveIntensity={0.1}
                wireframe
                transparent
                opacity={0.3}
              />
            </mesh>
          )
        }),
      )}
      {/* Neon floor grid */}
      <gridHelper args={[15, 15, '#00f0ff', '#050508']} />
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
    background: 'radial-gradient(circle at center, transparent 0%, rgba(5,5,8,0.8) 100%)',
  },
  title: {
    fontSize: '5rem',
    fontWeight: 800,
    letterSpacing: '0.2em',
    color: '#fff',
    textShadow: '0 0 20px var(--neon-cyan), 0 0 40px var(--neon-cyan)',
    marginBottom: '0.5rem',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: 'var(--neon-cyan)',
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    marginBottom: '2rem',
    fontWeight: 600,
    textShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
  },
  pitch: {
    fontSize: '1.1rem',
    color: '#a8b2d1',
    textAlign: 'center',
    maxWidth: '600px',
    lineHeight: 1.8,
    marginBottom: '3rem',
    backdropFilter: 'blur(4px)',
    padding: '1.5rem',
    borderRadius: '12px',
    background: 'rgba(10, 25, 47, 0.4)',
    border: '1px solid rgba(0, 240, 255, 0.1)',
  },
  btnGroup: {
    display: 'flex',
    gap: '24px',
    pointerEvents: 'auto',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  secondaryBtnGroup: {
    display: 'flex',
    gap: '16px',
    pointerEvents: 'auto',
    marginTop: '24px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  btnBase: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 40px',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    transition: 'all 0.3s ease',
    border: 'none',
    position: 'relative',
    overflow: 'hidden',
  },
  footer: {
    position: 'absolute',
    bottom: '24px',
    fontSize: '0.8rem',
    color: '#64ffda',
    letterSpacing: '0.2em',
    zIndex: 10,
    opacity: 0.7,
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
      <Canvas camera={{ position: [0, 6, 12], fov: 55 }} style={{ position: 'absolute', inset: 0 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[5, 5, 5]} intensity={0.8} color="#00f0ff" />
        <pointLight position={[-5, 3, -5]} intensity={0.5} color="#ff003c" />
        <fog attach="fog" args={['#050508', 10, 30]} />
        <RotatingBuilding />
        <Particles />
      </Canvas>

      {/* Overlay */}
      <div style={s.overlay}>
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={s.title}
          className="glitch-hover"
        >
          HEIST ARCHITECT
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          style={s.subtitle}
        >
          Multi-Agent Pathfinding Strategy Game
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          style={s.pitch}
          className="glass-panel"
        >
          Command a crew of 3 elite specialists to pull off the perfect heist.
          Navigate guards, cameras, and laser sensors in this turn-based strategy game powered by <strong>5 advanced AI algorithms</strong>.
          Outsmart the AI Warden — or watch two AIs battle it out in real-time.
        </motion.div>

        <motion.div 
          style={s.btnGroup}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 20px var(--neon-cyan)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              ...s.btnBase,
              background: 'rgba(0, 240, 255, 0.1)',
              color: 'var(--neon-cyan)',
              border: '2px solid var(--neon-cyan)',
            }}
            onClick={() => startGame('pvai')}
          >
            <Play size={20} />
            Play as Mastermind
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 20px var(--neon-magenta)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              ...s.btnBase,
              background: 'rgba(255, 0, 60, 0.1)',
              color: 'var(--neon-magenta)',
              border: '2px solid var(--neon-magenta)',
            }}
            onClick={() => startGame('spectator')}
          >
            <Eye size={20} />
            Watch AI vs AI
          </motion.button>

        </motion.div>

        <motion.div 
          style={s.secondaryBtnGroup}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.6 }}
        >
          <motion.button
            whileHover={{ scale: 1.05, background: 'rgba(0, 255, 102, 0.2)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              ...s.btnBase,
              padding: '12px 24px',
              fontSize: '0.9rem',
              background: 'rgba(10, 10, 15, 0.6)',
              color: 'var(--neon-green)',
              border: '1px solid var(--neon-green)',
            }}
            onClick={() => startGame('pvai', true)}
          >
            <BookOpen size={16} />
            Interactive Tutorial
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, background: 'rgba(252, 238, 10, 0.2)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              ...s.btnBase,
              padding: '12px 24px',
              fontSize: '0.9rem',
              background: 'rgba(10, 10, 15, 0.6)',
              color: 'var(--neon-yellow)',
              border: '1px solid var(--neon-yellow)',
            }}
            onClick={() => setShowHowToPlay(true)}
          >
            <HelpCircle size={16} />
            How to Play
          </motion.button>
        </motion.div>
      </div>

      <motion.div 
        style={s.footer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 1, delay: 2 }}
      >
        CS 2005 — Artificial Intelligence Lab Project
      </motion.div>

      {/* How to Play overlay */}
      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100 }}
          >
            <HowToPlay asModal />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
