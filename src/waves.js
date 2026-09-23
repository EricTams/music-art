// Procedural waves. Time runs down the sheet (y). Each layer sums up to
// three sines; frequency is in cycles over the full sheet length and
// amplitude is a horizontal displacement in inches.
//
// Modes:
//   line     - a single wavy line: x = center + signal(y)
//   envelope - an audio-style waveform band: |x - center| < base + signal(y)

import { SHEET } from './sheet.js';

const SAMPLE_STEP = 0.02; // inches between polyline samples

// Which sines drive a sheet: its own, the shared master wave, or one
// harmonic of the master (the Fourier split across sheets).
export const SOURCES = {
  'Own sines': 'own',
  'Master: full wave': 'master',
  'Master: harmonic 1': 'h1',
  'Master: harmonic 2': 'h2',
  'Master: harmonic 3': 'h3',
  'Master: harmonic 4': 'h4',
  'Master: harmonics 1–2': 'h1-2',
  'Master: harmonics 1–3': 'h1-3',
};

function sines(wave, master) {
  const pick = (obj, prefix, ns) =>
    ns.map((n) => ({ f: obj[`${prefix}${n}f`], a: obj[`${prefix}${n}a`], p: obj[`${prefix}${n}p`] }));
  const src = wave.source ?? 'own';
  let terms;
  if (src === 'own' || !master) terms = pick(wave, 's', [1, 2, 3]);
  else if (src === 'master') terms = pick(master, 'h', [1, 2, 3, 4]);
  else if (src.startsWith('h1-')) {
    // Partial sum: harmonics 1..n, so sheets can build up to the full wave.
    const n = Number(src.slice(3));
    terms = pick(master, 'h', Array.from({ length: n }, (_, i) => i + 1));
  }
  else terms = pick(master, 'h', [Number(src.slice(1))]);
  return terms.filter((s) => s.a !== 0 && s.f !== 0);
}

function smoothstep(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

export function makeField(wave, master) {
  const terms = sines(wave, master);
  const sum = (list) => (y) => {
    const t = y / SHEET.h;
    let s = 0;
    for (const { f, a, p } of list) s += a * Math.sin(2 * Math.PI * f * t + p);
    return s;
  };
  const signal = sum(terms);
  // The lower wave this one rides on: everything except its highest
  // frequency term (for harmonics 1–3 that's harmonics 1–2).
  const top = terms.reduce((m, s) => (m && m.f >= s.f ? m : s), null);
  const carrier = sum(terms.filter((s) => s !== top));

  const halfWidth = (y) => Math.max(0, wave.base + signal(y));

  // Polyline of the line-mode curve, for true (not just horizontal) distance.
  const n = Math.ceil(SHEET.h / SAMPLE_STEP) + 1;
  const px = new Float64Array(n);
  for (let i = 0; i < n; i++) px[i] = wave.center + signal(i * SAMPLE_STEP);

  const core = wave.thickness / 2;
  const reach = core + wave.softness;

  function distToCurve(x, y) {
    const lo = Math.max(0, Math.floor((y - reach) / SAMPLE_STEP));
    const hi = Math.min(n - 1, Math.ceil((y + reach) / SAMPLE_STEP));
    let best = Infinity;
    for (let i = lo; i <= hi; i++) {
      const dx = x - px[i];
      const dy = y - i * SAMPLE_STEP;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // 0..1 "ink" value: 1 on the wave, falling to 0 over `softness` inches.
  function ink(x, y) {
    let d;
    if (wave.mode === 'envelope') {
      d = Math.abs(x - wave.center) - halfWidth(y) + core;
    } else {
      d = distToCurve(x, y);
    }
    let v = d <= core ? 1 : 1 - smoothstep((d - core) / Math.max(wave.softness, 1e-6));
    return wave.invert ? 1 - v : v;
  }

  return { signal, carrier, halfWidth, ink };
}
