/* ── TutorialOverlay — interactive step-by-step guide during gameplay ── */
import { useGameStore } from '../store/gameStore'

interface TutorialStepDef {
  title: string
  instruction: string
  detail: string
  highlight?: string   // CSS selector or area description
  waitForAction?: string  // action type that advances this step
  canAdvance: boolean     // can the user click "Next" to skip
}

const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    title: 'Welcome to Heist Architect!',
    instruction: 'You\'re the Mastermind. Your goal: complete all objectives and escape the building before the AI Warden catches you.',
    detail: 'This tutorial will walk you through your first heist step-by-step. Each step explains what to do and why. You can skip ahead anytime.',
    canAdvance: true,
  },
  {
    title: 'Meet Your Crew',
    instruction: 'Look at the bottom of the screen. You have 3 agents: Hacker (green), Thief (red), and Muscle (orange).',
    detail: 'Each agent has a unique ability. The Hacker disables security devices, the Thief picks locks, and the Muscle can knock out a guard. Their colored capsules are visible on the 3D map.',
    highlight: 'agent-cards',
    canAdvance: true,
  },
  {
    title: 'Select an Agent',
    instruction: 'Click on the HACKER agent card at the bottom panel to select them.',
    detail: 'The selected agent\'s card will glow and get a highlighted border. Once selected, you can set where they should move on the map.',
    highlight: 'agent-cards',
    waitForAction: 'select_agent',
    canAdvance: true,
  },
  {
    title: 'Set a Destination',
    instruction: 'Now click on any glowing (walkable) cell on the 3D map to set the Hacker\'s destination.',
    detail: 'A dotted path preview will appear showing the route. Dark cells are walls — you can only click on lit floor cells. Try clicking near an objective marker!',
    highlight: 'map',
    waitForAction: 'set_waypoint',
    canAdvance: true,
  },
  {
    title: 'Move More Agents (Optional)',
    instruction: 'Select another agent and set their destination too, or click "Next" to continue with just the Hacker.',
    detail: 'In a real game, you\'d typically move multiple agents per turn to be efficient. For now, moving one is fine.',
    canAdvance: true,
  },
  {
    title: 'Plan Safe Paths',
    instruction: 'Click the "PLAN" button to compute collision-free paths for your agents.',
    detail: 'This runs the CBS (Conflict-Based Search) algorithm. It finds routes where no two agents collide. Watch the CBS tree panel grow on the left — it shows the algorithm exploring different path combinations.',
    highlight: 'plan-button',
    waitForAction: 'plan',
    canAdvance: true,
  },
  {
    title: 'Review the Plan',
    instruction: 'Solid colored lines now show the planned paths on the map. Review them before executing.',
    detail: 'Green lines = Hacker\'s path, Red = Thief, Orange = Muscle. The CBS algorithm guaranteed these paths won\'t cause collisions between your agents.',
    canAdvance: true,
  },
  {
    title: 'Execute the Turn',
    instruction: 'Click "EXECUTE" to move your crew. Watch them move along their paths!',
    detail: 'During execution: your crew moves, guards patrol, sensors may trigger, and the Warden reacts. Use the Step/Play buttons to control the speed. The narration panel explains what happens at each step.',
    highlight: 'execute-button',
    waitForAction: 'execute',
    canAdvance: true,
  },
  {
    title: 'Read the Narration',
    instruction: 'Look at the narration panel on the right. It explains what just happened in plain English.',
    detail: 'The narration tells you who moved where, which sensors triggered, how the Warden\'s suspicion changed, and whether any objectives were completed. This is your play-by-play commentary.',
    canAdvance: true,
  },
  {
    title: 'Understand the Warden',
    instruction: 'Check the Bayesian heatmap — it shows where the Warden THINKS your crew is.',
    detail: 'Red cells = high suspicion, blue = low. The Warden updates this after every sensor event. The Minimax panel shows the Warden\'s decision tree for guard movement. Stay away from red zones!',
    canAdvance: true,
  },
  {
    title: 'Use an Ability',
    instruction: 'Select an agent, then click their ability button (⚡ Hack, 🔓 Pick, or 👊 KO) to use a special action.',
    detail: 'Abilities are powerful but limited. The Hacker can disable a nearby camera/alarm, the Thief can pick a locked door, and the Muscle can knock out an adjacent guard. Each ability has limited uses and a cooldown.',
    canAdvance: true,
  },
  {
    title: 'Try Quick Move vs Strategic Plan',
    instruction: 'Notice the "QUICK ↔ STRATEGIC" toggle. Quick Move is fast (click → move). Strategic Plan shows the full CBS tree.',
    detail: 'Quick Move: click destination, paths are auto-computed. Strategic Plan: set multiple waypoints, see full algorithm visualization. Use Quick Move for routine moves, Strategic Plan for critical coordinated maneuvers.',
    canAdvance: true,
  },
  {
    title: 'You\'re Ready!',
    instruction: 'You now know how to play Heist Architect! Complete all objectives and reach the extraction point to win.',
    detail: 'Remember: keep the alert level low, use your Hacker to disable security, and save the Muscle\'s knockout for emergencies. Click "End Tutorial" to continue playing freely. The "?" help button is always available.',
    canAdvance: true,
  },
]

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  card: {
    pointerEvents: 'auto',
    marginTop: 20,
    maxWidth: 520,
    width: '90%',
    background: 'rgba(5, 5, 20, 0.95)',
    border: '2px solid rgba(0, 212, 255, 0.4)',
    borderRadius: 12,
    padding: '20px 24px',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 0 40px rgba(0, 212, 255, 0.15)',
  },
  stepIndicator: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#00d4ff',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#fff',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#00d4ff',
    lineHeight: 1.6,
    marginBottom: 8,
    padding: '10px 14px',
    background: 'rgba(0, 212, 255, 0.08)',
    borderRadius: 6,
    border: '1px solid rgba(0, 212, 255, 0.15)',
  },
  detail: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#999',
    lineHeight: 1.6,
    marginBottom: 16,
  },
  buttons: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  navBtn: {
    padding: '8px 20px',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: 6,
    background: 'transparent',
    color: '#00d4ff',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  skipBtn: {
    padding: '8px 20px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
    background: 'transparent',
    color: '#666',
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  progress: {
    display: 'flex',
    gap: 4,
    marginTop: 12,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'all 0.2s',
  },
}

export default function TutorialOverlay() {
  const isTutorial = useGameStore((s) => s.isTutorial)
  const tutorialStep = useGameStore((s) => s.tutorialStep)
  const setTutorialStep = useGameStore((s) => s.setTutorialStep)
  const setIsTutorial = useGameStore((s) => s.setIsTutorial)

  if (!isTutorial) return null

  const step = TUTORIAL_STEPS[tutorialStep]
  if (!step) {
    // Tutorial complete
    setIsTutorial(false)
    return null
  }

  const isFirst = tutorialStep === 0
  const isLast = tutorialStep === TUTORIAL_STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      setIsTutorial(false)
    } else {
      setTutorialStep(tutorialStep + 1)
    }
  }

  const handlePrev = () => {
    if (tutorialStep > 0) {
      setTutorialStep(tutorialStep - 1)
    }
  }

  const handleSkip = () => {
    setIsTutorial(false)
  }

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.stepIndicator}>
          Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}
        </div>
        <div style={s.title}>{step.title}</div>
        <div style={s.instruction}>{step.instruction}</div>
        <div style={s.detail}>{step.detail}</div>

        <div style={s.buttons}>
          <button
            style={{ ...s.navBtn, opacity: isFirst ? 0.3 : 1, cursor: isFirst ? 'default' : 'pointer' }}
            onClick={handlePrev}
            disabled={isFirst}
          >
            ← Back
          </button>

          <button style={s.skipBtn} onClick={handleSkip}>
            Skip Tutorial
          </button>

          <button
            style={{
              ...s.navBtn,
              background: isLast ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 212, 255, 0.1)',
              borderColor: isLast ? '#00ff88' : 'rgba(0, 212, 255, 0.3)',
              color: isLast ? '#00ff88' : '#00d4ff',
            }}
            onClick={handleNext}
          >
            {isLast ? 'End Tutorial →' : 'Next →'}
          </button>
        </div>

        {/* Progress dots */}
        <div style={s.progress}>
          {TUTORIAL_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                ...s.dot,
                background: i === tutorialStep ? '#00d4ff' : i < tutorialStep ? '#00d4ff44' : '#333',
                cursor: 'pointer',
              }}
              onClick={() => setTutorialStep(i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
