import React, { useEffect, useState, useRef, useCallback } from 'react';
import PhaserGame from './game/PhaserGame.jsx';
import { api, connectWS } from './api.js';

const MODES = [
  { id: 'ai_vs_ai',          label: 'AI vs AI',          desc: 'Auto-demo' },
  { id: 'human_mastermind',  label: 'Human Mastermind',  desc: 'You plan thieves' },
  { id: 'human_warden',      label: 'Human Warden',      desc: 'You control guards' },
  { id: 'hotseat',           label: 'Hotseat',           desc: 'Two humans' },
];

export default function App() {
  const [mode, setMode] = useState('ai_vs_ai');
  const [state, setState] = useState(null);
  const [astarPreview, setAstarPreview] = useState(null);
  const [selectedGuard, setSelectedGuard] = useState(0);
  const [selectedThief, setSelectedThief] = useState(0);
  const [plannedGoals, setPlannedGoals] = useState({}); // for human mastermind
  const [banner, setBanner] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const wsRef = useRef(null);

  // boot WebSocket once
  useEffect(() => {
    const ws = connectWS((msg) => {
      if (msg.type === 'snapshot' || msg.type === 'step' ||
          msg.type === 'plan' || msg.type === 'guard_move') {
        setState(msg.payload);
      }
    });
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const flashBanner = (text, ms = 1500) => {
    setBanner(text);
    setTimeout(() => setBanner(null), ms);
  };

  const startGame = async (newMode = mode) => {
    setAutoRunning(false);
    setPlannedGoals({});
    setAstarPreview(null);
    const snap = await api.newGame(newMode);
    setState(snap);
    setMode(newMode);
    flashBanner(`New game — ${newMode.replace('_', ' ')}`);
  };

  // boot initial game
  useEffect(() => { startGame('ai_vs_ai'); /* eslint-disable-next-line */ }, []);

  // --------------------------------------------------------------
  const stepOnce = async () => {
    const snap = await api.step();
    setState(snap);
  };

  const startAutorun = async () => {
    await api.autorun(450);
    setAutoRunning(true);
  };

  const stopAutorun = async () => {
    await api.stopAutorun();
    setAutoRunning(false);
  };

  const autoPlan = async () => {
    const snap = await api.autoPlan();
    setState(snap);
    flashBanner('Mastermind planned via CBS');
  };

  // --------------------------------------------------------------
  // Click handling depends on mode
  const handleCellClick = useCallback(async (r, c) => {
    if (!state) return;
    if (state.phase === 'finished') return;

    if (mode === 'human_warden') {
      // click assigns a move for the selected guard (must be adjacent or same cell)
      try {
        await api.moveGuard(selectedGuard, [r, c]);
        // backend broadcasts via WS
        // still advance one turn so thieves step too
        await stepOnce();
      } catch (e) {
        flashBanner('Illegal guard move');
      }
      return;
    }

    if (mode === 'human_mastermind' || mode === 'hotseat') {
      // click assigns a goal for the currently selected thief
      const goals = { ...plannedGoals, [selectedThief]: [r, c] };
      setPlannedGoals(goals);

      // show A* preview immediately for feedback
      const thief = state.thieves[selectedThief];
      if (thief && !thief.caught && !thief.escaped) {
        try {
          const pv = await api.astarPreview(thief.pos, [r, c]);
          setAstarPreview(pv);
        } catch (e) { setAstarPreview(null); }
      }
      return;
    }
  }, [state, mode, selectedGuard, selectedThief, plannedGoals]);

  const commitPlan = async () => {
    if (Object.keys(plannedGoals).length === 0) {
      flashBanner('Assign goals to all thieves first');
      return;
    }
    try {
      const snap = await api.plan(plannedGoals);
      setState(snap);
      setPlannedGoals({});
      setAstarPreview(null);
      flashBanner('Plan committed via CBS');
    } catch (e) {
      flashBanner('CBS could not resolve conflicts. Try different goals.');
    }
  };

  // --------------------------------------------------------------
  const thieves = state?.thieves ?? [];
  const guards = state?.guards ?? [];

  const finished = state?.phase === 'finished';
  const winner = state?.winner;

  return (
    <div className="app-shell">
      {/* topbar */}
      <div className="topbar">
        <h1>HEIST ARCHITECT</h1>
        <div className="subtitle">Multi-Agent Pathfinding · Bayesian Tracking · Adversarial Search</div>
        <div className="spacer" />
        <div className="badge">Turn {state?.turn ?? 0}</div>
        <div className="badge">{state?.mode ?? '—'}</div>
      </div>

      {/* left: controls */}
      <div className="panel col" style={{ gap: 14 }}>
        <div>
          <h2>Game Mode</h2>
          <div className="mode-select">
            {MODES.map(m => (
              <button
                key={m.id}
                className={mode === m.id ? 'active' : ''}
                onClick={() => startGame(m.id)}
              >
                <div>{m.label}</div>
                <div style={{ fontSize: 9, opacity: 0.7 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2>Controls</h2>
          <div className="col">
            <button className="primary" onClick={() => startGame(mode)}>Reset Game</button>
            {mode === 'ai_vs_ai' && !autoRunning && (
              <button className="primary" onClick={startAutorun}>▶ Auto-Run Demo</button>
            )}
            {mode === 'ai_vs_ai' && autoRunning && (
              <button className="danger" onClick={stopAutorun}>■ Stop Auto-Run</button>
            )}
            <button onClick={stepOnce} disabled={finished}>Step 1 Turn</button>
            {(mode === 'human_mastermind' || mode === 'hotseat') && (
              <>
                <button onClick={autoPlan} disabled={finished}>AI Plan (CBS)</button>
                <button className="primary" onClick={commitPlan} disabled={finished}>Commit My Plan</button>
              </>
            )}
          </div>
        </div>

        {(mode === 'human_mastermind' || mode === 'hotseat') && (
          <div>
            <h2>Select Thief</h2>
            <div className="row">
              {thieves.map(t => (
                <button
                  key={t.id}
                  className={selectedThief === t.id ? 'primary' : ''}
                  onClick={() => setSelectedThief(t.id)}
                  disabled={t.caught || t.escaped}
                >
                  T{t.id}{t.has_loot ? '$' : ''}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 6 }}>
              Click a cell to assign a goal. Yellow line previews A*.
            </div>
          </div>
        )}

        {mode === 'human_warden' && (
          <div>
            <h2>Select Guard</h2>
            <div className="row">
              {guards.map(g => (
                <button
                  key={g.id}
                  className={selectedGuard === g.id ? 'primary' : ''}
                  onClick={() => setSelectedGuard(g.id)}
                >G{g.id}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 6 }}>
              Click an adjacent cell to move the selected guard.
            </div>
          </div>
        )}

        <div>
          <h2>Legend</h2>
          <div style={{ fontSize: 11, lineHeight: 1.8 }}>
            <div><span className="tag-thief">●</span> Thief · <span style={{color:'#ffbb33'}}>$</span> has loot</div>
            <div><span className="tag-guard">●</span> Guard · <span style={{color:'#ff4d6d'}}>◯</span> camera</div>
            <div><span style={{color:'#33c1ff'}}>●</span> Motion sensor</div>
            <div><span style={{color:'#ffbb33'}}>$</span> Vault · <span style={{color:'#4ade80'}}>EXIT</span></div>
          </div>
        </div>
      </div>

      {/* center: board */}
      <div className="stage">
        <PhaserGame state={state} onCellClick={handleCellClick} astarPreview={astarPreview} />
        {banner && <div className="banner">{banner}</div>}
        {finished && (
          <div className={`end-overlay ${winner}`}>
            <div className="title">{winner === 'thieves' ? 'HEIST SUCCESS' : 'HEIST FOILED'}</div>
            <button className="primary" onClick={() => startGame(mode)}>Play Again</button>
          </div>
        )}
      </div>

      {/* right: AI panel */}
      <div className="panel col" style={{ gap: 14 }}>
        <div>
          <h2>AI Telemetry</h2>
          <div className="stat"><span>Turn</span><span>{state?.turn ?? 0}</span></div>
          <div className="stat"><span>Phase</span><span>{state?.phase ?? '—'}</span></div>
          <div className="stat"><span>Thieves active</span>
            <span>{thieves.filter(t => !t.caught && !t.escaped).length}/{thieves.length}</span></div>
          <div className="stat"><span>Escaped</span>
            <span>{thieves.filter(t => t.escaped).length}</span></div>
          <div className="stat"><span>Caught</span>
            <span>{thieves.filter(t => t.caught).length}</span></div>
        </div>

        <div>
          <h2>CBS Conflicts</h2>
          {(state?.conflicts ?? []).slice(-4).reverse().map((cf, i) => (
            <div key={i} className="conflict">
              {cf.type === 'vertex'
                ? `vertex T${cf.a1}×T${cf.a2} @ (${cf.cell[0]},${cf.cell[1]}) t=${cf.t}`
                : `edge T${cf.a1}↔T${cf.a2} (${cf.cell_a[0]},${cf.cell_a[1]})↔(${cf.cell_b[0]},${cf.cell_b[1]}) t=${cf.t}`}
            </div>
          ))}
          {(!state?.conflicts || state.conflicts.length === 0) && (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>No conflicts yet.</div>
          )}
        </div>

        <div>
          <h2>Minimax (Warden)</h2>
          {state?.minimax ? (
            <>
              <div className="stat">
                <span>Best score</span>
                <span>{state.minimax.score?.toFixed?.(2) ?? '—'}</span>
              </div>
              <div className="stat">
                <span>Nodes eval.</span>
                <span>{state.minimax.nodes_evaluated}</span>
              </div>
              <div className="stat">
                <span>Chosen move</span>
                <span>{JSON.stringify(state.minimax.joint_move)}</span>
              </div>
              <h3>Candidate actions</h3>
              <div className="minimax-tree">
                {(state.minimax.tree?.children ?? []).slice(0, 20).map((c, i) => {
                  const isBest = JSON.stringify(c.move) === JSON.stringify(state.minimax.joint_move);
                  return (
                    <div key={i} className={`mv ${isBest ? 'best' : ''}`}>
                      <span>{JSON.stringify(c.move)}</span>
                      <span>{c.score}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
              Warden hasn't played yet.
            </div>
          )}
        </div>

        <div>
          <h2>Bayesian Belief</h2>
          <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
            Heatmap overlay on the board shows the Warden's belief about thief
            positions, updated each turn via Bayes' rule on sensor readings.
          </div>
        </div>
      </div>
    </div>
  );
}
