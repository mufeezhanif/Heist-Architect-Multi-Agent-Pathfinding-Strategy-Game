/**
 * ObservatoryLanding — the new main entry. 3 cards linking to each mode.
 */
import { Link } from 'react-router-dom'

export default function ObservatoryLanding() {
  return (
    <div className="obs-landing">
      <div className="obs-landing-hero">
        <h1>AI Observatory</h1>
        <p className="obs-landing-subtitle">
          Interactive visualization of multi-agent pathfinding & adversarial AI
        </p>
        <p className="obs-landing-blurb">
          Explore the inner workings of <strong>A*</strong>, <strong>CBS</strong>, <strong>CSP</strong>, <strong>Bayesian inference</strong>, and <strong>Minimax</strong> —
          step by step, algorithm by algorithm, through three distinct modes.
        </p>
      </div>

      <div className="obs-landing-cards">
        <Link to="/arena" className="obs-card">
          <div className="obs-card-icon">🔬</div>
          <h2>Algorithm Arena</h2>
          <p className="obs-card-desc">
            Interactive inspector. Pick a map, click start &amp; goal, watch A* expand the frontier step by step.
            Race heuristics side-by-side. Run CBS on multiple agents and inspect the conflict tree.
          </p>
          <div className="obs-card-tags">
            <span>A*</span><span>CBS</span><span>Heuristics</span><span>Scrubbable</span>
          </div>
        </Link>

        <Link to="/theater" className="obs-card">
          <div className="obs-card-icon">🎭</div>
          <h2>AI Theater</h2>
          <p className="obs-card-desc">
            Autonomous crew AI vs. Warden AI. Watch the crew plan routes via CBS + A*,
            while the Warden tracks them with Bayesian inference and deploys guards via Minimax.
            Live thought-bubble narration of every decision.
          </p>
          <div className="obs-card-tags">
            <span>AI vs AI</span><span>Bayesian</span><span>Minimax</span><span>Spectator</span>
          </div>
        </Link>

        <Link to="/bench" className="obs-card">
          <div className="obs-card-icon">📊</div>
          <h2>MAPF Lab</h2>
          <p className="obs-card-desc">
            Research-grade benchmark harness. Run CBS on random scenarios across standard maps
            or upload your own in MovingAI format. Aggregate stats, per-trial breakdown, CSV export.
          </p>
          <div className="obs-card-tags">
            <span>Benchmark</span><span>MovingAI</span><span>CSV</span><span>Stats</span>
          </div>
        </Link>
      </div>

      <footer className="obs-landing-footer">
        CS 2005 — Artificial Intelligence Lab Project ·
        Algorithms: A*, Bayesian Filtering, Conflict-Based Search, Constraint Satisfaction, Minimax
      </footer>
    </div>
  )
}
