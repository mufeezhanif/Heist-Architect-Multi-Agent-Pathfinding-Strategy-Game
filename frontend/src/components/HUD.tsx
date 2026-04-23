/* ── HUD — heads-up display overlay with alert + event log ── */
import { useGameStore } from '../store/gameStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Star, Activity, CheckSquare, AlertTriangle, Terminal } from 'lucide-react'

const ALERT_COLORS = ['#00ff66', '#fcee0a', '#ff003c', '#ff003c']
const ALERT_LABELS = ['GREEN', 'YELLOW', 'RED', 'LOCKDOWN']

const s: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    pointerEvents: 'none',
    zIndex: 10,
    width: '320px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--neon-cyan)',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 600,
  },
  value: {
    fontFamily: 'monospace',
    fontSize: '1.2rem',
    fontWeight: 800,
    textShadow: '0 0 10px rgba(255,255,255,0.3)',
  },
  statusWon: { color: 'var(--neon-green)', textShadow: '0 0 10px var(--neon-green)' },
  statusLost: { color: 'var(--neon-magenta)', textShadow: '0 0 10px var(--neon-magenta)' },
  statusActive: { color: 'var(--neon-cyan)', textShadow: '0 0 10px var(--neon-cyan)' },
  eventLog: {
    marginTop: '8px',
    padding: '12px',
    maxHeight: '200px',
    overflowY: 'auto',
    pointerEvents: 'auto',
  },
  logEntry: {
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    padding: '6px 0',
    borderBottom: '1px solid var(--glass-border)',
    lineHeight: 1.4,
  },
  logTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: 'var(--neon-cyan)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '8px',
    fontWeight: 600,
  },
}

export default function HUD() {
  const turn = useGameStore((s) => s.turn)
  const maxTurns = 50
  const score = useGameStore((s) => s.score)
  const gameStatus = useGameStore((s) => s.gameStatus)
  const objectivesCompleted = useGameStore((s) => s.objectivesCompleted)
  const building = useGameStore((s) => s.building)
  const alertLevel = useGameStore((s) => s.alertLevel)
  const eventLog = useGameStore((s) => s.eventLog)

  const totalObjectives = building?.objectives.length || 0
  const alertColor = ALERT_COLORS[alertLevel] || 'var(--neon-green)'
  const alertLabel = ALERT_LABELS[alertLevel] || 'GREEN'

  const statusStyle =
    gameStatus === 'won' ? s.statusWon : gameStatus === 'lost' ? s.statusLost : s.statusActive

  const badgeVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
  }

  return (
    <div style={s.container}>
      <motion.div custom={0} initial="hidden" animate="visible" variants={badgeVariants} className="glass-panel" style={s.badge} title="Current turn number out of 50 maximum turns">
        <span style={s.label}><Clock size={16} /> Turn</span>
        <span style={s.value}>{turn} <span style={{fontSize: '0.8rem', opacity: 0.6}}>/ {maxTurns}</span></span>
      </motion.div>
      
      <motion.div custom={1} initial="hidden" animate="visible" variants={badgeVariants} className="glass-panel" style={s.badge} title="Your heist score — higher is better, bonus for speed">
        <span style={s.label}><Star size={16} /> Score</span>
        <motion.span 
          style={s.value}
          key={score}
          initial={{ scale: 1.5, color: 'var(--neon-yellow)' }}
          animate={{ scale: 1, color: '#fff' }}
          transition={{ duration: 0.3 }}
        >
          {score}
        </motion.span>
      </motion.div>

      <motion.div custom={2} initial="hidden" animate="visible" variants={badgeVariants} className="glass-panel" style={s.badge} title="Game status — ACTIVE means the heist is in progress">
        <span style={s.label}><Activity size={16} /> Status</span>
        <span style={{...s.value, ...statusStyle}}>{gameStatus.toUpperCase()}</span>
      </motion.div>

      <motion.div custom={3} initial="hidden" animate="visible" variants={badgeVariants} className="glass-panel" style={s.badge} title="Objectives completed — complete ALL to unlock extraction">
        <span style={s.label}><CheckSquare size={16} /> Objectives</span>
        <span style={s.value}>{objectivesCompleted.length} <span style={{fontSize: '0.8rem', opacity: 0.6}}>/ {totalObjectives}</span></span>
      </motion.div>

      <motion.div 
        custom={4} initial="hidden" animate="visible" variants={badgeVariants} 
        className="glass-panel" 
        style={{
          ...s.badge,
          borderLeft: `4px solid ${alertColor}`,
          boxShadow: alertLevel > 0 ? `0 0 15px ${alertColor}40` : 'none'
        }} 
        title="Alert level — GREEN=safe, YELLOW=suspicious, RED=converging, LOCKDOWN=next detection loses the game"
      >
        <span style={{...s.label, color: alertColor}}><AlertTriangle size={16} /> Alert</span>
        <motion.span 
          key={alertLevel}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          style={{...s.value, color: alertColor, textShadow: `0 0 10px ${alertColor}`}}
        >
          {alertLabel}
        </motion.span>
      </motion.div>

      {/* Event log */}
      <AnimatePresence>
        {eventLog.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass-panel" 
            style={s.eventLog}
          >
            <div style={s.logTitle}><Terminal size={14} /> Event Log</div>
            <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
              {eventLog.slice(-15).reverse().map((msg, i) => (
                <motion.div 
                  key={`${msg}-${i}`} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: i === 0 ? 1 : 0.6, x: 0 }}
                  style={{
                    ...s.logEntry,
                    color: msg.includes('LOCKDOWN') || msg.includes('CAUGHT') ? 'var(--neon-magenta)' :
                           msg.includes('ALERT') || msg.includes('SUSPICIOUS') ? 'var(--neon-yellow)' :
                           msg.includes('complete') || msg.includes('COMPLETE') ? 'var(--neon-green)' :
                           '#aaa',
                  }}
                >
                  {msg}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
