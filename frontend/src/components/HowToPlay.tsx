/* ── HowToPlay — comprehensive game description & rules screen ── */
import { useGameStore } from '../store/gameStore'

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 5, 15, 0.97)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflowY: 'auto',
    padding: '40px 20px 80px',
    backdropFilter: 'blur(10px)',
  },
  content: {
    maxWidth: 800,
    width: '100%',
    fontFamily: 'monospace',
    color: '#e0e0e0',
  },
  backBtn: {
    position: 'fixed',
    top: 20,
    right: 24,
    padding: '10px 24px',
    border: '2px solid #00d4ff',
    borderRadius: 6,
    background: 'rgba(0, 212, 255, 0.1)',
    color: '#00d4ff',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 1,
    textTransform: 'uppercase',
    zIndex: 201,
  },
  title: {
    fontSize: 42,
    fontWeight: 900,
    letterSpacing: 6,
    color: '#fff',
    textShadow: '0 0 30px #00d4ff, 0 0 60px #00d4ff44',
    textAlign: 'center',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 48,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 1.8,
    color: '#ccc',
    marginBottom: 12,
  },
  crewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginTop: 12,
  },
  crewCard: {
    background: 'rgba(10, 10, 25, 0.8)',
    border: '1px solid',
    borderRadius: 8,
    padding: 16,
  },
  crewName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
  },
  crewAbility: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 1.6,
  },
  stepFlow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  stepCard: {
    flex: '1 1 140px',
    maxWidth: 180,
    background: 'rgba(10, 10, 25, 0.8)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: 8,
    padding: '16px 12px',
    textAlign: 'center',
  },
  stepNum: {
    fontSize: 24,
    fontWeight: 900,
    color: '#00d4ff',
    marginBottom: 6,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepDesc: {
    fontSize: 11,
    color: '#aaa',
    lineHeight: 1.5,
  },
  arrow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 20,
    color: '#00d4ff44',
    padding: '0 6px',
  },
  conditionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginTop: 12,
  },
  conditionCard: {
    background: 'rgba(10, 10, 25, 0.8)',
    borderRadius: 8,
    padding: 16,
  },
  alertGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
    marginTop: 12,
  },
  alertCard: {
    borderRadius: 6,
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 700,
  },
  aiCard: {
    background: 'rgba(10, 10, 25, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  },
  aiDesc: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 1.6,
  },
  tipBox: {
    background: 'rgba(0, 212, 255, 0.05)',
    border: '1px solid rgba(0, 212, 255, 0.15)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 8,
    fontSize: 13,
    color: '#ccc',
    lineHeight: 1.6,
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  controlKey: {
    background: 'rgba(0, 212, 255, 0.15)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: '#00d4ff',
    minWidth: 110,
    textAlign: 'center',
  },
  controlDesc: {
    fontSize: 12,
    color: '#aaa',
  },
}

export default function HowToPlay({ asModal = false }: { asModal?: boolean }) {
  const setShowHowToPlay = useGameStore((s) => s.setShowHowToPlay)
  const setScreen = useGameStore((s) => s.setScreen)

  const handleBack = () => {
    if (asModal) {
      setShowHowToPlay(false)
    } else {
      setScreen('landing')
    }
  }

  return (
    <div style={s.overlay}>
      <button style={s.backBtn} onClick={handleBack}>
        {asModal ? '✕ Close' : '← Back'}
      </button>

      <div style={s.content}>
        {/* Title */}
        <div style={s.title}>HEIST ARCHITECT</div>
        <div style={s.tagline}>A Multi-Agent Pathfinding Strategy Game</div>

        {/* Game Overview */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#00d4ff' }}>What Is This Game?</div>
          <div style={s.paragraph}>
            You are the <strong style={{ color: '#00d4ff' }}>Mastermind</strong> — the brains behind a high-stakes heist.
            You command a crew of 3 specialists to infiltrate a guarded building, complete objectives
            (hack servers, steal loot, disable alarms), and escape to the extraction point.
          </div>
          <div style={s.paragraph}>
            Standing against you is the <strong style={{ color: '#e94560' }}>AI Warden</strong> — an intelligent opponent
            that controls guards, cameras, and sensors. The Warden uses probability tracking and strategic planning
            to hunt down your crew. If you're detected during a lockdown, it's game over.
          </div>
          <div style={s.paragraph}>
            This is a <strong>turn-based strategy game</strong> — think of it like chess, but with 3 pieces that
            move simultaneously through a building while being hunted. Every move matters.
          </div>
        </div>

        {/* Your Crew */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#00ff88' }}>Your Crew</div>
          <div style={s.crewGrid}>
            <div style={{ ...s.crewCard, borderColor: '#00ff8844' }}>
              <div style={{ ...s.crewName, color: '#00ff88' }}>🟢 Hacker</div>
              <div style={s.crewAbility}>
                <strong>Ability:</strong> Disable cameras & alarms<br />
                <strong>Speed:</strong> 2 tiles per turn<br />
                <strong>Uses:</strong> 3 charges, 2-turn cooldown<br />
                <em>Use the Hacker to clear the path by disabling security devices before your team moves through.</em>
              </div>
            </div>
            <div style={{ ...s.crewCard, borderColor: '#e9456044' }}>
              <div style={{ ...s.crewName, color: '#e94560' }}>🔴 Thief</div>
              <div style={s.crewAbility}>
                <strong>Ability:</strong> Pick locks on doors<br />
                <strong>Speed:</strong> 3 tiles per turn (fastest)<br />
                <strong>Uses:</strong> 3 charges, 2-turn cooldown<br />
                <em>The Thief can reach objectives quickly and open locked doors that block other agents.</em>
              </div>
            </div>
            <div style={{ ...s.crewCard, borderColor: '#ff6b3544' }}>
              <div style={{ ...s.crewName, color: '#ff6b35' }}>🟠 Muscle</div>
              <div style={s.crewAbility}>
                <strong>Ability:</strong> Knock out guards (1 use!)<br />
                <strong>Speed:</strong> 2 tiles per turn<br />
                <strong>Uses:</strong> 1 charge, single use<br />
                <em>Save the Muscle's knockout for emergencies — you only get one shot to neutralize a guard.</em>
              </div>
            </div>
          </div>
        </div>

        {/* How A Turn Works */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#ffcc00' }}>How A Turn Works</div>
          <div style={s.paragraph}>
            Each turn follows a clear sequence. You plan, the system computes safe paths, then everyone moves simultaneously.
          </div>
          <div style={s.stepFlow}>
            <div style={s.stepCard}>
              <div style={s.stepNum}>1</div>
              <div style={s.stepLabel}>Select Agent</div>
              <div style={s.stepDesc}>Click an agent card at the bottom or click directly on an agent in the 3D scene</div>
            </div>
            <div style={s.arrow}>→</div>
            <div style={s.stepCard}>
              <div style={s.stepNum}>2</div>
              <div style={s.stepLabel}>Set Destination</div>
              <div style={s.stepDesc}>Click any walkable cell on the map. A path preview will appear instantly.</div>
            </div>
            <div style={s.arrow}>→</div>
            <div style={s.stepCard}>
              <div style={s.stepNum}>3</div>
              <div style={s.stepLabel}>Plan Paths</div>
              <div style={s.stepDesc}>Hit "Plan" to compute collision-free routes. The CBS algorithm ensures no agents crash into each other.</div>
            </div>
            <div style={s.arrow}>→</div>
            <div style={s.stepCard}>
              <div style={s.stepNum}>4</div>
              <div style={s.stepLabel}>Execute</div>
              <div style={s.stepDesc}>Hit "Execute" to move. Watch your crew move, guards patrol, and sensors trigger. Step through or auto-play.</div>
            </div>
            <div style={s.arrow}>→</div>
            <div style={s.stepCard}>
              <div style={s.stepNum}>5</div>
              <div style={s.stepLabel}>Warden Reacts</div>
              <div style={s.stepDesc}>The AI Warden updates its suspicion map and repositions guards. The narration panel explains what happened.</div>
            </div>
          </div>
        </div>

        {/* Two Modes */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#00d4ff' }}>Move Modes</div>
          <div style={s.conditionGrid}>
            <div style={{ ...s.conditionCard, border: '1px solid rgba(0, 212, 255, 0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00d4ff', marginBottom: 8 }}>⚡ Quick Move</div>
              <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
                The default mode. Click an agent, click a destination — the system automatically plans and
                previews the path. Set destinations for all agents you want to move, then hit "End Turn" to execute everything at once.
                Fast and intuitive, like moving chess pieces.
              </div>
            </div>
            <div style={{ ...s.conditionCard, border: '1px solid rgba(255, 204, 0, 0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffcc00', marginBottom: 8 }}>🎯 Strategic Plan</div>
              <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
                For coordinated multi-agent operations. Set waypoints for all agents, then click "Plan All" to see
                the CBS algorithm find collision-free paths. Review the paths, then "Execute All" for synchronized movement.
                Shows the full CBS decision tree.
              </div>
            </div>
          </div>
        </div>

        {/* Win & Lose */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#00ff88' }}>Winning & Losing</div>
          <div style={s.conditionGrid}>
            <div style={{ ...s.conditionCard, border: '1px solid rgba(0, 255, 136, 0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00ff88', marginBottom: 8 }}>✅ You Win When</div>
              <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
                • Complete ALL objectives (hack, steal, disable)<br />
                • Get ALL crew members to the extraction point<br />
                • Do it within 50 turns<br />
                • Higher score for fewer turns used
              </div>
            </div>
            <div style={{ ...s.conditionCard, border: '1px solid rgba(255, 0, 85, 0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ff0055', marginBottom: 8 }}>❌ You Lose When</div>
              <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
                • A crew member is detected during LOCKDOWN alert<br />
                • All crew members are caught/eliminated<br />
                • You run out of turns (50 max)<br />
                • You run out of planning time resource
              </div>
            </div>
          </div>
        </div>

        {/* Alert System */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#ffcc00' }}>Alert System</div>
          <div style={s.paragraph}>
            Every time a sensor detects your crew, the alert level rises. The Warden becomes more aggressive at higher levels.
            Alert decays over time if you stay hidden.
          </div>
          <div style={s.alertGrid}>
            <div style={{ ...s.alertCard, background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', border: '1px solid #00ff8833' }}>
              GREEN<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Normal patrols</span>
            </div>
            <div style={{ ...s.alertCard, background: 'rgba(255, 204, 0, 0.1)', color: '#ffcc00', border: '1px solid #ffcc0033' }}>
              YELLOW<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Guards widen search</span>
            </div>
            <div style={{ ...s.alertCard, background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', border: '1px solid #ff444433' }}>
              RED<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Guards converge</span>
            </div>
            <div style={{ ...s.alertCard, background: 'rgba(255, 0, 85, 0.1)', color: '#ff0055', border: '1px solid #ff005533' }}>
              LOCKDOWN<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Next detection = GAME OVER</span>
            </div>
          </div>
        </div>

        {/* Controls Reference */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#00d4ff' }}>Controls</div>
          <div style={s.controlRow}>
            <div style={s.controlKey}>Click Agent Card</div>
            <div style={s.controlDesc}>Select which crew member to command</div>
          </div>
          <div style={s.controlRow}>
            <div style={s.controlKey}>Click Map Cell</div>
            <div style={s.controlDesc}>Set destination for the selected agent</div>
          </div>
          <div style={s.controlRow}>
            <div style={s.controlKey}>End Turn / Execute</div>
            <div style={s.controlDesc}>Move all agents and advance the game by one turn</div>
          </div>
          <div style={s.controlRow}>
            <div style={s.controlKey}>Ability Buttons</div>
            <div style={s.controlDesc}>Use agent's special ability (Hack, Pick Lock, Knock Out)</div>
          </div>
          <div style={s.controlRow}>
            <div style={s.controlKey}>⏯ Step / Play</div>
            <div style={s.controlDesc}>During execution, step through movements one-by-one or auto-play</div>
          </div>
          <div style={s.controlRow}>
            <div style={s.controlKey}>Quick ↔ Strategic</div>
            <div style={s.controlDesc}>Toggle between quick-move and strategic planning modes</div>
          </div>
          <div style={s.controlRow}>
            <div style={s.controlKey}>? Help</div>
            <div style={s.controlDesc}>Open this guide anytime during gameplay</div>
          </div>
        </div>

        {/* AI Under the Hood */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#e94560' }}>The AI Behind the Game</div>
          <div style={s.paragraph}>
            This game showcases 4 core AI systems working together. The visualization panels let you see the algorithms in action.
          </div>
          <div style={s.aiCard}>
            <div style={{ ...s.aiTitle, color: '#00d4ff' }}>🔍 A* Search — Pathfinding</div>
            <div style={s.aiDesc}>
              Finds the shortest path from an agent's position to their destination.
              Uses Manhattan distance as a heuristic. Operates in space-time (same cell at different times = different nodes).
            </div>
          </div>
          <div style={s.aiCard}>
            <div style={{ ...s.aiTitle, color: '#00ff88' }}>🌲 CBS (Conflict-Based Search) — Multi-Agent Coordination</div>
            <div style={s.aiDesc}>
              The core algorithm. Plans paths for all 3 agents simultaneously, guaranteeing no collisions.
              When two agents would collide, CBS branches into alternatives and picks the lowest-cost solution.
              Watch the CBS tree grow during planning — green nodes are the winning solution.
            </div>
          </div>
          <div style={s.aiCard}>
            <div style={{ ...s.aiTitle, color: '#e94560' }}>📊 Bayesian Probability — Warden's Suspicion</div>
            <div style={s.aiDesc}>
              The Warden doesn't know exactly where you are. Instead, it maintains a probability map
              of where your crew might be. Each sensor event updates these probabilities using Bayes' theorem.
              The heatmap overlay shows this — red cells are where the Warden suspects you are.
            </div>
          </div>
          <div style={s.aiCard}>
            <div style={{ ...s.aiTitle, color: '#ff6b35' }}>🛡️ Warden Heuristic — Guard Pressure</div>
            <div style={s.aiDesc}>
              Instead of a deep game tree, guards now follow a clear rule: move toward high-suspicion tiles from the Bayesian map.
              This keeps guard behavior understandable and consistent while staying fast and responsive each turn.
            </div>
          </div>
          <div style={s.aiCard}>
            <div style={{ ...s.aiTitle, color: '#ffcc00' }}>🔗 CSP — Temporal Constraints</div>
            <div style={s.aiDesc}>
              Ensures agents complete objectives in the right order. For example, the Hacker must disable
              an alarm BEFORE the Thief enters the vault. CSP generates time-locked constraints fed into CBS.
            </div>
          </div>
        </div>

        {/* Tips */}
        <div style={s.section}>
          <div style={{ ...s.sectionTitle, color: '#ffcc00' }}>Tips & Strategy</div>
          <div style={s.tipBox}>
            💡 <strong>Don't bunch up.</strong> If all 3 agents use the same corridor, CBS has to resolve more conflicts and your planning time resource decreases faster.
          </div>
          <div style={s.tipBox}>
            💡 <strong>Use the Hacker first.</strong> Disable cameras and alarms along the route before sending the Thief and Muscle through.
          </div>
          <div style={s.tipBox}>
            💡 <strong>Watch the Bayesian heatmap.</strong> It shows where the Warden thinks you are. Move away from red zones, or bait the Warden by triggering a sensor in one area while sneaking through another.
          </div>
          <div style={s.tipBox}>
            💡 <strong>Save the Muscle's knockout.</strong> You only get one use. Save it for when a guard blocks a critical path.
          </div>
          <div style={s.tipBox}>
            💡 <strong>Keep alert level low.</strong> The longer you stay at GREEN, the less aggressive the guards are. Avoid unnecessary sensor triggers.
          </div>
        </div>
      </div>
    </div>
  )
}
