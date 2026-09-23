// Design state: defaults, persistence and randomizing. Plain JSON so a
// preset file is just this object.

import { DEFAULT_CUT, SHEET } from './sheet.js';

const STORAGE_KEY = 'music-art-state-v10';

function layer(name, color, strength, depth, { pattern = 'halftone', wave, halftone, moons } = {}) {
  return {
    name,
    color,
    strength,
    visible: true,
    showCurve: false,
    depth,
    pattern,
    wave: {
      source: 'own',
      mode: 'line',
      center: SHEET.w / 2,
      base: 1,
      thickness: 0.8,
      softness: 1.6,
      invert: false,
      s1f: 2, s1a: 3, s1p: 0,
      s2f: 0, s2a: 0, s2p: 0,
      s3f: 0, s3a: 0, s3p: 0,
      ...wave,
    },
    halftone: {
      cell: 0.3,
      minDot: 0,
      maxDot: 0.2,
      angle: 0,
      shape: 'circle',
      offsetX: 0,
      offsetY: 0,
      avoid: false, // fill the other sheets' negative space instead of the wave
      clearance: 0.15,
      fade: 1,
      ...halftone,
    },
    bars: {
      pitch: 0.3,
      barH: 0.16,
      minLen: 0.1,
      round: true,
      offsetY: 0,
    },
    moons: {
      style: 'crescent',
      thicknessBy: 'fixed',
      thickness: 0.4,
      slices: 1,
      sliceGap: 0.12,
      tipGap: 0.15,
      minBow: 0.05,
      rideLower: false,
      side: 'inside',
      fill: 'solid',
      spread: 0.15,
      ...moons,
    },
  };
}

export function defaultState() {
  const state = {
    global: {
      // 12 × 20 in: Glowforge's standard Proofgrade sheet, which fits the
      // Pro's bed in one pass.
      sheet: { w: 12, h: 20 },
      gap: 0.75,
      wallGap: 1,
      wallColor: '#f2f0ec',
      cut: { ...DEFAULT_CUT },
      // Shared wave, split into harmonics across sheets; filled in by
      // applyBuildUp below.
      master: {},
    },
    // Listed front to back; depth 0 is nearest the wall.
    layers: [
      layer('Yellow', '#ffd21f', 0.7, 3, {
        pattern: 'moons',
        wave: { source: 'h3', s1f: 4, s1a: 2.2, s2f: 9, s2a: 0.6, s2p: 1.1 },
        moons: { thickness: 0.3 },
      }),
      layer('Orange', '#ff7a1a', 0.65, 2, {
        pattern: 'moons',
        wave: { source: 'h2', s1f: 2.5, s1a: 3.2, s1p: 1.4, s2f: 6, s2a: 0.8 },
        moons: { thickness: 0.35 },
      }),
      layer('Red', '#e3262b', 0.6, 1, {
        pattern: 'moons',
        wave: { source: 'h1', s1f: 3, s1a: 2.8, s1p: 2.2, s2f: 7, s2a: 1, s2p: 0.4 },
        moons: { thickness: 0.6 },
      }),
      layer('Grey', '#7d7f84', 0.55, 0, {
        wave: { source: 'master', s1f: 1.5, s1a: 3.5, s1p: 0.6, thickness: 1.2, softness: 2 },
        halftone: { angle: 45, cell: 0.34, maxDot: 0.24, avoid: true },
      }),
    ],
  };
  applyBuildUp(state);
  return state;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return mergeDefaults(JSON.parse(raw));
  } catch {
    // Unreadable or blocked storage: fall back to defaults.
  }
  return defaultState();
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable; the design still works for this session.
  }
}

// Fill in any fields added since a preset was saved.
export function mergeDefaults(saved) {
  const d = defaultState();
  const merge = (base, over) => {
    if (typeof base !== 'object' || base === null || Array.isArray(base)) return over ?? base;
    const out = { ...base };
    for (const k of Object.keys(over ?? {})) out[k] = merge(base[k], over[k]);
    return out;
  };
  return {
    global: merge(d.global, saved.global),
    layers: d.layers.map((l, i) => merge(l, saved.layers?.[i])),
  };
}

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const round = (v, step) => Math.round(v / step) * step;

export function randomizeLayer(l) {
  const w = l.wave;
  w.mode = Math.random() < 0.5 ? 'line' : 'envelope';
  w.center = round(rand(4, 8), 0.1);
  w.base = round(rand(0.3, 1.8), 0.1);
  w.thickness = round(rand(0.2, 1.4), 0.05);
  w.softness = round(rand(0.6, 2.5), 0.1);
  w.s1f = round(rand(0.5, 5), 0.25);
  w.s1a = round(rand(1.5, 4), 0.1);
  w.s1p = round(rand(0, Math.PI * 2), 0.05);
  w.s2f = round(rand(3, 12), 0.25);
  w.s2a = round(rand(0, 1.2), 0.1);
  w.s2p = round(rand(0, Math.PI * 2), 0.05);
  l.halftone.angle = Math.round(rand(0, 90));
  l.halftone.shape = Math.random() < 0.65 ? 'circle' : 'square';
}

// Keep harmonics as integer multiples of a random fundamental so the
// Fourier split still reads as one wave.
export function randomizeMaster(m) {
  const f = round(rand(0.75, 2.5), 0.25);
  const mult = [1, ...[2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a - b)];
  mult.forEach((k, i) => {
    const n = i + 1;
    m[`h${n}f`] = f * k;
    m[`h${n}a`] = n === 4 ? 0 : round(rand(2, 3.5) / k, 0.05);
    m[`h${n}p`] = round(rand(0, Math.PI * 2), 0.05);
  });
}

// Build-up: each sheet adds the next harmonic, so looking front to back
// the waveform assembles itself: red = 1, orange = 1+2, yellow = 1+2+3.
// Harmonics 2× and 3× (not the square wave's 3× and 5×) keep the peaks
// rounded. Moons sit outside each bend, split at the curve's own
// inflections, so they hug the wave. This is also the default design.
export function applyBuildUp(state) {
  Object.assign(state.global.master, {
    h1f: 1.5, h1a: 3, h1p: 0,
    h2f: 3, h2a: 1.2, h2p: 0.8,
    h3f: 4.5, h3a: 0.7, h3p: 1.9,
    h4f: 0, h4a: 0, h4p: 0,
  });
  const sources = { Red: 'h1', Orange: 'h1-2', Yellow: 'h1-3', Grey: 'master' };
  // Nested crescents grow toward the front: yellow 3, orange 2, red 1.
  const slices = { Red: 1, Orange: 2, Yellow: 3 };
  // ...while each crescent gets thicker toward the back.
  const thickness = { Red: 1.5, Orange: 0.8, Yellow: 0.3 };
  for (const l of state.layers) {
    if (!sources[l.name]) continue;
    if (slices[l.name]) l.moons.slices = slices[l.name];
    if (thickness[l.name]) l.moons.thickness = thickness[l.name];
    l.wave.source = sources[l.name];
    l.wave.mode = 'line';
    l.moons.side = 'outside';
    l.moons.rideLower = false;
  }
}

// Test: draw the crescents in dots instead of cutting them out. Finer
// grids toward the front, and a different screen angle per sheet so the
// overlapping dot grids make moiré. Set Fill back to Solid to undo.
export function applyHalftoneMoons(state) {
  const settings = {
    Yellow: { cell: 0.18, maxDot: 0.08, angle: 0 },
    Orange: { cell: 0.22, maxDot: 0.12, angle: 30 },
    Red: { cell: 0.28, maxDot: 0.18, angle: 60 },
  };
  for (const l of state.layers) {
    if (!settings[l.name] || l.pattern !== 'moons') continue;
    l.moons.fill = 'halftone';
    Object.assign(l.halftone, { minDot: 0, shape: 'circle', offsetX: 0, offsetY: 0 }, settings[l.name]);
  }
}
