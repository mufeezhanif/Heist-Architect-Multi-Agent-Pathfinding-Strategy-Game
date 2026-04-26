// Phaser scene rendering the Heist Architect board.
// Layers (top -> bottom):
//   interaction (click targets for guards / thief goals)
//   agents (thieves + guards sprites drawn as circles)
//   planned paths (thief-colored polylines)
//   CBS conflict markers (red X)
//   A* expanded nodes (light dots) + A* path preview
//   Bayesian heatmap (Warden view)
//   camera coverage cones + sensor radii
//   base tiles (walls / floor / vault / exit)

import Phaser from 'phaser';

export const CELL = 40;   // px
export const GRID = 15;
export const BOARD = CELL * GRID;

const TILE_COLORS = {
  '#': 0x1a2036,   // wall
  '.': 0x2a3352,   // floor
  'D': 0x3a4470,   // door (floor-ish)
  'V': 0x553311,   // vault (will also get gold inset)
  'E': 0x1e4d3b,   // exit (green-ish)
};

const THIEF_COLORS = [0x00e0c7, 0x33c1ff, 0xa379ff];
const GUARD_COLOR = 0xff4d6d;

export class MainScene extends Phaser.Scene {
  constructor() {
    super('main');
    this.state = null;
    this.showAStar = false;
    this.astarPreview = null;          // {path, expanded}
    this.clickHandler = null;
  }

  init(data) {
    this.clickHandler = data.clickHandler || null;
  }

  create() {
    this.add.rectangle(BOARD / 2, BOARD / 2, BOARD, BOARD, 0x0b0d14)
      .setStrokeStyle(1, 0x23294a);

    // layer containers (order = draw order)
    this.layerTiles    = this.add.container(0, 0);
    this.layerGrid     = this.add.container(0, 0);
    this.layerHeatmap  = this.add.container(0, 0);
    this.layerCoverage = this.add.container(0, 0);
    this.layerAStar    = this.add.container(0, 0);
    this.layerPaths    = this.add.container(0, 0);
    this.layerConflicts= this.add.container(0, 0);
    this.layerAgents   = this.add.container(0, 0);
    this.layerLabels   = this.add.container(0, 0);

    // Grid lines
    const g = this.add.graphics();
    g.lineStyle(1, 0x23294a, 0.5);
    for (let i = 0; i <= GRID; i++) {
      g.moveTo(i * CELL, 0); g.lineTo(i * CELL, BOARD);
      g.moveTo(0, i * CELL); g.lineTo(BOARD, i * CELL);
    }
    g.strokePath();
    this.layerGrid.add(g);

    // Click / hover handling
    this.input.on('pointerdown', (pointer) => {
      const c = Math.floor(pointer.x / CELL);
      const r = Math.floor(pointer.y / CELL);
      if (r < 0 || r >= GRID || c < 0 || c >= GRID) return;
      if (this.clickHandler) this.clickHandler(r, c);
    });
  }

  setClickHandler(fn) { this.clickHandler = fn; }

  setAStarPreview(preview) {
    this.astarPreview = preview;
    this.drawAStar();
  }

  setState(state) {
    this.state = state;
    this.drawTiles();
    this.drawHeatmap();
    this.drawCoverage();
    this.drawPaths();
    this.drawConflicts();
    this.drawAgents();
  }

  // --------------------------------------------------------------------
  drawTiles() {
    this.layerTiles.removeAll(true);
    if (!this.state) return;
    for (let r = 0; r < this.state.rows; r++) {
      for (let c = 0; c < this.state.cols; c++) {
        const ch = this.state.tiles[r][c];
        const color = TILE_COLORS[ch] ?? TILE_COLORS['.'];
        const rect = this.add.rectangle(c * CELL + CELL/2, r * CELL + CELL/2,
                                         CELL - 1, CELL - 1, color);
        this.layerTiles.add(rect);

        if (ch === 'V') {
          const g = this.add.graphics();
          g.lineStyle(2, 0xffbb33, 1);
          g.strokeCircle(c * CELL + CELL/2, r * CELL + CELL/2, CELL * 0.32);
          g.fillStyle(0xffbb33, 0.2);
          g.fillCircle(c * CELL + CELL/2, r * CELL + CELL/2, CELL * 0.32);
          this.layerTiles.add(g);
          const t = this.add.text(c * CELL + CELL/2, r * CELL + CELL/2,
            '$', { fontSize: '16px', color: '#ffbb33', fontStyle: 'bold' })
            .setOrigin(0.5);
          this.layerTiles.add(t);
        } else if (ch === 'E') {
          const t = this.add.text(c * CELL + CELL/2, r * CELL + CELL/2,
            'EXIT', { fontSize: '9px', color: '#4ade80', fontStyle: 'bold' })
            .setOrigin(0.5);
          this.layerTiles.add(t);
        } else if (ch === 'D') {
          const t = this.add.text(c * CELL + CELL/2, r * CELL + CELL/2,
            '▭', { fontSize: '16px', color: '#8a93ad' })
            .setOrigin(0.5);
          this.layerTiles.add(t);
        }
      }
    }
  }

  drawHeatmap() {
    this.layerHeatmap.removeAll(true);
    if (!this.state || !this.state.heatmap) return;
    const hm = this.state.heatmap;
    let maxV = 0;
    for (const row of hm) for (const v of row) if (v > maxV) maxV = v;
    if (maxV <= 0) return;
    for (let r = 0; r < hm.length; r++) {
      for (let c = 0; c < hm[r].length; c++) {
        const v = hm[r][c];
        if (v <= 0.005) continue;
        const intensity = Math.min(1, v / maxV);
        // yellow/red gradient
        const red = 0xff;
        const green = Math.floor(0xcc * (1 - intensity * 0.8));
        const color = (red << 16) | (green << 8) | 0x00;
        const rect = this.add.rectangle(c * CELL + CELL/2, r * CELL + CELL/2,
                                         CELL - 2, CELL - 2, color, 0.35 * intensity + 0.1);
        this.layerHeatmap.add(rect);
      }
    }
  }

  drawCoverage() {
    this.layerCoverage.removeAll(true);
    if (!this.state) return;
    for (const cam of this.state.cameras) {
      const g = this.add.graphics();
      g.fillStyle(0xff4d6d, 0.08);
      for (const [r, c] of cam.coverage) {
        g.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
      this.layerCoverage.add(g);
      // camera icon
      const [cr, cc] = cam.pos;
      const icon = this.add.circle(cc * CELL + CELL/2, cr * CELL + CELL/2,
                                    6, 0xff4d6d).setStrokeStyle(2, 0x111);
      this.layerCoverage.add(icon);
    }
    for (const s of this.state.sensors) {
      const [sr, sc] = s.pos;
      const g = this.add.graphics();
      g.fillStyle(0x33c1ff, 0.08);
      for (let r = sr - s.radius; r <= sr + s.radius; r++) {
        for (let c = sc - s.radius; c <= sc + s.radius; c++) {
          if (Math.abs(r-sr) + Math.abs(c-sc) <= s.radius) {
            g.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      }
      this.layerCoverage.add(g);
      const icon = this.add.circle(sc * CELL + CELL/2, sr * CELL + CELL/2,
                                    5, 0x33c1ff).setStrokeStyle(2, 0x111);
      this.layerCoverage.add(icon);
    }
    // flash triggered sensors
    if (this.state.sensor_events) {
      for (const ev of this.state.sensor_events) {
        const [r, c] = ev.pos;
        const flash = this.add.circle(c * CELL + CELL/2, r * CELL + CELL/2,
                                       CELL * 0.5, 0xffff00, 0.3)
          .setStrokeStyle(2, 0xffff00);
        this.layerCoverage.add(flash);
        this.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 500 });
      }
    }
  }

  drawAStar() {
    this.layerAStar.removeAll(true);
    if (!this.astarPreview) return;
    const { path, expanded } = this.astarPreview;
    if (expanded) {
      for (const [r, c] of expanded) {
        const dot = this.add.circle(c * CELL + CELL/2, r * CELL + CELL/2,
                                     3, 0xffbb33, 0.35);
        this.layerAStar.add(dot);
      }
    }
    if (path && path.length > 1) {
      const g = this.add.graphics();
      g.lineStyle(3, 0xffbb33, 0.9);
      const [r0, c0] = path[0];
      g.moveTo(c0 * CELL + CELL/2, r0 * CELL + CELL/2);
      for (let i = 1; i < path.length; i++) {
        const [r, c] = path[i];
        g.lineTo(c * CELL + CELL/2, r * CELL + CELL/2);
      }
      g.strokePath();
      this.layerAStar.add(g);
    }
  }

  drawPaths() {
    this.layerPaths.removeAll(true);
    if (!this.state) return;
    this.state.thieves.forEach((t, idx) => {
      if (t.caught || t.escaped || !t.path || t.path.length === 0) return;
      const color = THIEF_COLORS[idx % THIEF_COLORS.length];
      const g = this.add.graphics();
      g.lineStyle(3, color, 0.7);
      const remaining = t.path.slice(t.path_index);
      if (remaining.length < 2) return;
      const [r0, c0] = remaining[0];
      g.moveTo(c0 * CELL + CELL/2, r0 * CELL + CELL/2);
      for (let i = 1; i < remaining.length; i++) {
        const [r, c] = remaining[i];
        g.lineTo(c * CELL + CELL/2, r * CELL + CELL/2);
      }
      g.strokePath();
      this.layerPaths.add(g);
      // arrow at the end
      const last = remaining[remaining.length - 1];
      const endDot = this.add.circle(last[1] * CELL + CELL/2, last[0] * CELL + CELL/2,
                                      4, color, 1);
      this.layerPaths.add(endDot);
    });
  }

  drawConflicts() {
    this.layerConflicts.removeAll(true);
    if (!this.state || !this.state.conflicts) return;
    const lastTurn = this.state.turn;
    for (const cf of this.state.conflicts.slice(-3)) {
      const cell = cf.cell || cf.cell_a;
      if (!cell) continue;
      const [r, c] = cell;
      const x = this.add.text(c * CELL + CELL/2, r * CELL + CELL/2, '✕',
        { fontSize: '18px', color: '#ff4d6d', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.layerConflicts.add(x);
      this.tweens.add({ targets: x, alpha: 0.3, duration: 800, yoyo: true, repeat: 2 });
    }
  }

  drawAgents() {
    this.layerAgents.removeAll(true);
    this.layerLabels.removeAll(true);
    if (!this.state) return;
    this.state.thieves.forEach((t, idx) => {
      const color = THIEF_COLORS[idx % THIEF_COLORS.length];
      if (t.caught) {
        const [r, c] = t.pos;
        const x = this.add.text(c * CELL + CELL/2, r * CELL + CELL/2, '☠',
          { fontSize: '18px', color: '#888' }).setOrigin(0.5);
        this.layerAgents.add(x);
        return;
      }
      if (t.escaped) return;
      const [r, c] = t.pos;
      const circle = this.add.circle(c * CELL + CELL/2, r * CELL + CELL/2,
                                      CELL * 0.32, color, 1)
        .setStrokeStyle(2, 0x111);
      this.layerAgents.add(circle);
      const label = this.add.text(c * CELL + CELL/2, r * CELL + CELL/2,
        `T${t.id}${t.has_loot ? '$' : ''}`,
        { fontSize: '10px', color: '#111', fontStyle: 'bold' }).setOrigin(0.5);
      this.layerLabels.add(label);
    });
    this.state.guards.forEach((g) => {
      const [r, c] = g.pos;
      const circle = this.add.circle(c * CELL + CELL/2, r * CELL + CELL/2,
                                      CELL * 0.36, GUARD_COLOR, 1)
        .setStrokeStyle(2, 0x111);
      this.layerAgents.add(circle);
      const label = this.add.text(c * CELL + CELL/2, r * CELL + CELL/2,
        `G${g.id}`, { fontSize: '10px', color: '#111', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.layerLabels.add(label);
      // guard vision ring
      const ring = this.add.circle(c * CELL + CELL/2, r * CELL + CELL/2,
                                    CELL * 1.2, GUARD_COLOR, 0)
        .setStrokeStyle(1, GUARD_COLOR, 0.3);
      this.layerAgents.add(ring);
    });
  }
}
