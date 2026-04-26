// Thin REST + WebSocket client for the Heist Architect backend.

const BASE = '';   // same origin (Vite proxies /api and /ws to FastAPI)

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  newGame: (mode) => post('/api/new_game', { mode }),
  snapshot: () => get('/api/snapshot'),
  plan: (goals) => post('/api/plan', { goals }),
  autoPlan: () => post('/api/auto_plan'),
  step: () => post('/api/step'),
  moveGuard: (guard_id, pos) => post('/api/move_guard', { guard_id, pos }),
  astarPreview: (start, goal) => post('/api/astar_preview', { start, goal }),
  autorun: (delay_ms = 400) => post(`/api/autorun?delay_ms=${delay_ms}`),
  stopAutorun: () => post('/api/stop_autorun'),
};

export function connectWS(onMessage) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      onMessage(msg);
    } catch (e) { console.error('bad ws message', e); }
  };
  ws.onopen = () => {
    // heartbeat so server keeps receive loop alive
    const hb = setInterval(() => {
      if (ws.readyState === 1) ws.send('ping');
      else clearInterval(hb);
    }, 15000);
  };
  return ws;
}
