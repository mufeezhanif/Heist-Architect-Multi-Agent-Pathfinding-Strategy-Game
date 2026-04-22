/* ── HelpButton — floating in-game help toggle ── */
import { useGameStore } from '../store/gameStore'

const s: Record<string, React.CSSProperties> = {
  btn: {
    position: 'absolute',
    top: 14,
    right: 190,
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '2px solid rgba(0, 212, 255, 0.4)',
    background: 'rgba(10, 10, 25, 0.9)',
    color: '#00d4ff',
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    backdropFilter: 'blur(8px)',
    transition: 'all 0.2s',
    boxShadow: '0 0 15px rgba(0, 212, 255, 0.1)',
  },
}

export default function HelpButton() {
  const setShowHowToPlay = useGameStore((s) => s.setShowHowToPlay)
  const showHowToPlay = useGameStore((s) => s.showHowToPlay)

  return (
    <button
      style={{
        ...s.btn,
        background: showHowToPlay ? 'rgba(0, 212, 255, 0.2)' : 'rgba(10, 10, 25, 0.9)',
      }}
      onClick={() => setShowHowToPlay(!showHowToPlay)}
      title="How to Play — Game Rules & Guide"
    >
      ?
    </button>
  )
}
