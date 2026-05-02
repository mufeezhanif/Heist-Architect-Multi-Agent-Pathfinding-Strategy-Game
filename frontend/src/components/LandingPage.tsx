import { useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { createGame, connectWebSocket } from '../api/client'
import { normalizeAgent, normalizeGuard, normalizeBuilding } from '../api/normalize'
import HowToPlay from './HowToPlay'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Eye, HelpCircle, BookOpen } from 'lucide-react'

const s: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 15% 10%, rgba(84, 198, 255, 0.2), transparent 30%), radial-gradient(circle at 85% 85%, rgba(255, 104, 73, 0.2), transparent 35%), linear-gradient(155deg, #0a1120, #101a30 55%, #0d182a)',
  },
  gridBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.09) 1px, transparent 1px)',
    backgroundSize: '34px 34px',
    maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
  },
  boardPreview: {
    position: 'absolute',
    right: '6%',
    top: '16%',
    width: 'min(38vw, 500px)',
    aspectRatio: '30 / 25',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.45)',
    background: '#0b1322',
  },
  boardPreviewGrid: {
    display: 'grid',
    width: '100%',
    height: '100%',
    gridTemplateColumns: 'repeat(30, 1fr)',
    gridTemplateRows: 'repeat(25, 1fr)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    padding: 'min(8vh, 72px) 7%',
    gap: '6%',
    zIndex: 10,
  },
  leftColumn: {
    maxWidth: 620,
    width: '100%',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(152, 178, 208, 0.35)',
    background: 'rgba(7, 13, 26, 0.52)',
    borderRadius: 999,
    padding: '6px 14px',
    color: '#9ad6ff',
    fontFamily: 'Space Grotesk, sans-serif',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: 700,
    fontSize: '0.72rem',
    marginBottom: 18,
  },
  title: {
    fontSize: 'clamp(2.2rem, 5vw, 4.6rem)',
    lineHeight: 0.95,
    fontFamily: 'Space Grotesk, sans-serif',
    letterSpacing: '0.03em',
    color: '#f3f7ff',
    marginBottom: 16,
    textWrap: 'balance',
  },
  subtitle: {
    fontSize: 'clamp(1rem, 1.7vw, 1.2rem)',
    color: '#b9c7dd',
    lineHeight: 1.6,
    maxWidth: 580,
    marginBottom: 24,
  },
  algorithmPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 26,
  },
  pill: {
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(140, 170, 203, 0.35)',
    color: '#d4deef',
    fontSize: '0.76rem',
    fontFamily: 'monospace',
    background: 'rgba(8, 16, 30, 0.55)',
  },
  btnGroup: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #7dd3fc',
    color: '#05111f',
    background: 'linear-gradient(135deg, #7dd3fc, #38bdf8)',
    padding: '12px 18px',
    borderRadius: 10,
    fontFamily: 'Space Grotesk, sans-serif',
    fontWeight: 700,
    letterSpacing: '0.04em',
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(249, 115, 22, 0.8)',
    color: '#ffd8bf',
    background: 'rgba(249, 115, 22, 0.14)',
    padding: '12px 18px',
    borderRadius: 10,
    fontFamily: 'Space Grotesk, sans-serif',
    fontWeight: 700,
    letterSpacing: '0.04em',
    cursor: 'pointer',
  },
  ghostBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(148, 163, 184, 0.55)',
    color: '#d6e0ee',
    background: 'rgba(8, 16, 30, 0.6)',
    padding: '11px 16px',
    borderRadius: 10,
    fontFamily: 'Space Grotesk, sans-serif',
    fontWeight: 600,
    letterSpacing: '0.03em',
    cursor: 'pointer',
  },
  footer: {
    position: 'absolute',
    left: 24,
    bottom: 16,
    fontSize: '0.72rem',
    color: '#9fb1cc',
    letterSpacing: '0.08em',
    opacity: 0.82,
  },
}

function buildPreviewCells() {
  return Array.from({ length: 25 * 30 }).map((_, idx) => {
    const x = idx % 30
    const y = Math.floor(idx / 30)
    if (x === 0 || y === 0 || x === 29 || y === 24) return '#1f2a44'
    if ((x + y) % 13 === 0) return '#4b2240'
    if (x > 10 && x < 22 && y > 8 && y < 20) return '#13233b'
    return '#0f1a2d'
  })
}

export default function LandingPage() {
  const setScreen = useGameStore((st) => st.setScreen)
  const setGameMode = useGameStore((st) => st.setGameMode)
  const setGameId = useGameStore((st) => st.setGameId)
  const setBuilding = useGameStore((st) => st.setBuilding)
  const setCrew = useGameStore((st) => st.setCrew)
  const setGuards = useGameStore((st) => st.setGuards)
  const setIsTutorial = useGameStore((st) => st.setIsTutorial)
  const setTutorialStep = useGameStore((st) => st.setTutorialStep)
  const setShowHowToPlay = useGameStore((st) => st.setShowHowToPlay)
  const showHowToPlay = useGameStore((st) => st.showHowToPlay)

  const previewCells = useMemo(buildPreviewCells, [])

  const startGame = async (mode: 'pvai' | 'spectator', tutorial = false) => {
    try {
      const data = (await createGame(mode)) as {
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
      <div style={s.gridBackdrop} />

      <motion.div
        style={s.boardPreview}
        initial={{ opacity: 0, y: 24, rotate: 2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div style={s.boardPreviewGrid}>
          {previewCells.map((color, i) => (
            <div key={i} style={{ background: color, border: '1px solid rgba(120, 145, 173, 0.08)' }} />
          ))}
        </div>
      </motion.div>

      <div style={s.overlay}>
        <motion.div
          style={s.leftColumn}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div style={s.badge}>Top-Down Tactical View</div>
          <h1 style={s.title}>HEIST ARCHITECT</h1>
          <p style={s.subtitle}>
            Plan your crew in a clear 2D tactical map. No camera-angle confusion, no hidden corridors, just readable stealth strategy.
            The game now focuses on explainable path planning, Bayesian suspicion tracking, and smooth turn execution.
          </p>

          <div style={s.algorithmPills}>
            <span style={s.pill}>A* Pathfinding</span>
            <span style={s.pill}>CBS Multi-Agent Planner</span>
            <span style={s.pill}>Bayesian Suspicion Grid</span>
            <span style={s.pill}>CSP Objective Order</span>
          </div>

          <div style={s.btnGroup}>
            <motion.button
              whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(56, 189, 248, 0.38)' }}
              whileTap={{ scale: 0.98 }}
              style={s.primaryBtn}
              onClick={() => startGame('pvai')}
            >
              <Play size={18} /> Play as Mastermind
            </motion.button>
            <motion.button
              whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(249, 115, 22, 0.34)' }}
              whileTap={{ scale: 0.98 }}
              style={s.secondaryBtn}
              onClick={() => startGame('spectator')}
            >
              <Eye size={18} /> Watch AI vs AI
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              style={s.ghostBtn}
              onClick={() => startGame('pvai', true)}
            >
              <BookOpen size={16} /> Interactive Tutorial
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              style={s.ghostBtn}
              onClick={() => setShowHowToPlay(true)}
            >
              <HelpCircle size={16} /> How to Play
            </motion.button>
          </div>
        </motion.div>
      </div>

      <div style={s.footer}>CS 2005 - Artificial Intelligence Lab Project</div>

      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'absolute', inset: 0, zIndex: 100 }}
          >
            <HowToPlay asModal />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
