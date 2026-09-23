// Moons: split the wave at its inflection points (where the second
// derivative changes sign) so each piece bends one way only, then cut each
// piece as a moon on the inside of its bend. Consecutive moons alternate
// sides, and together they draw the curve.
//
// Styles:
//   crescent - outer edge on the curve, tapering to points at the inflections
//   halfmoon - outer edge on the curve, inner edge the straight chord
//   band     - constant-width strip along the curve
// Thickness follows a fixed width, the piece's curvature or its amplitude
// (how far it bows from its chord). Slices nest parallel copies inward.
//
// Side: "inside" puts the moon in the hollow of each bend; "outside" puts
// it on the bulging side, so the curve becomes the moon's inner edge.
//
// Fill: "solid" cuts each moon out whole; "halftone" draws it as dots using
// the sheet's Halftone settings.
//
// "Ride the lower wave" measures each moon against the wave without this
// sheet's highest harmonic instead of a straight chord: pieces split where
// the two curves cross, and each moon sits between them, so every ripple
// gets its own moon, carried along by the bigger wave.

import { SHEET } from '../sheet.js';
import { placeable, polyHole, polyGap } from './common.js';
import * as halftone from './halftone.js';
import { makeFillField } from '../avoid.js';

const STEP = 0.01; // inches between curve samples

// [curve, lower wave or null] pairs to cut moons from.
function curvesFor(layer, field) {
  const w = layer.wave;
  if (w.mode === 'envelope') {
    return [[(y) => w.center + field.halfWidth(y), null], [(y) => w.center - field.halfWidth(y), null]];
  }
  const lower = layer.moons.rideLower ? (y) => w.center + field.carrier(y) : null;
  return [[(y) => w.center + field.signal(y), lower]];
}

// Pieces of one curve between inflection points (or, with a lower wave,
// between crossings of it), with the measurements the thickness modes need.
function segments(fx, lower, cut) {
  const y0 = cut.margin;
  const y1 = SHEET.h - cut.margin;
  const n = Math.floor((y1 - y0) / STEP);
  const ys = Float64Array.from({ length: n + 1 }, (_, i) => y0 + i * STEP);
  const xs = ys.map(fx);
  const d2 = (i) => xs[i + 1] - 2 * xs[i] + xs[i - 1];

  const ls = lower ? ys.map(lower) : null;
  const split = lower ? (i) => xs[i] - ls[i] : d2;

  const breaks = [0];
  for (let i = 2; i < n - 1; i++) {
    if (Math.sign(split(i)) !== Math.sign(split(i - 1)) && Math.sign(split(i)) !== 0) breaks.push(i);
  }
  breaks.push(n);

  const segs = [];
  for (let k = 0; k < breaks.length - 1; k++) {
    const ia = breaks[k];
    const ib = breaks[k + 1];
    const ya = ys[ia];
    const yb = ys[ib];
    const chord = lower ?? ((y) => xs[ia] + ((xs[ib] - xs[ia]) * (y - ya)) / (yb - ya));
    let maxDev = 0;
    let devSum = 0;
    let maxCurv = 0;
    for (let i = Math.max(ia, 1); i <= Math.min(ib, n - 1); i++) {
      const dev = xs[i] - chord(ys[i]);
      devSum += dev;
      maxDev = Math.max(maxDev, Math.abs(dev));
      const x1 = (xs[i + 1] - xs[i - 1]) / (2 * STEP);
      const x2 = d2(i) / (STEP * STEP);
      maxCurv = Math.max(maxCurv, Math.abs(x2) / Math.pow(1 + x1 * x1, 1.5));
    }
    segs.push({ ya, yb, chord, side: Math.sign(devSum) || 1, maxDev, maxCurv, fx, riding: !!lower });
  }
  return segs;
}

export function generate(layer, field, cut) {
  const p = layer.moons;
  const tipGap = Math.max(p.tipGap, cut.minBridge / 2);
  const sliceGap = Math.max(p.sliceGap, cut.minBridge);
  const slices = p.style === 'halfmoon' ? 1 : Math.max(1, Math.round(p.slices));

  const segs = curvesFor(layer, field).flatMap(([fx, lower]) => segments(fx, lower, cut));
  const maxDev = Math.max(1e-6, ...segs.map((s) => s.maxDev));
  const maxCurv = Math.max(1e-6, ...segs.map((s) => s.maxCurv));

  const holes = [];
  let dropped = 0;
  let offEdge = 0;
  for (const s of segs) {
    const len = s.yb - s.ya;
    if (len < 2 * tipGap + 0.1 || s.maxDev < p.minBow) continue;

    let W = p.thickness;
    if (p.thicknessBy === 'amplitude') W *= s.maxDev / maxDev;
    if (p.thicknessBy === 'curvature') W *= s.maxCurv / maxCurv;
    if (W < cut.minHole) continue;

    const ya = s.ya + tipGap;
    const yb = s.yb - tipGap;
    const count = Math.max(8, Math.ceil((yb - ya) / 0.04));

    // Sample the curve with its inward normal (toward the chord side).
    const samples = [];
    for (let i = 0; i <= count; i++) {
      const y = ya + ((yb - ya) * i) / count;
      const x = s.fx(y);
      const slope = (s.fx(y + STEP) - s.fx(y - STEP)) / (2 * STEP);
      const L = Math.hypot(1, slope);
      const dir = p.side === 'outside' ? -1 : 1;
      const nx = (dir * -s.side * 1) / L;
      const ny = (dir * -s.side * -slope) / L;
      const t = (y - s.ya) / len; // 0..1 across the untrimmed piece
      samples.push({ x, y, nx, ny, t, cos: 1 / L });
    }

    for (let k = 0; k < slices; k++) {
      const off = k * (W + sliceGap);
      const pts = samples.map((q) => {
        const o0 = off;
        let o1 = off + (p.style === 'band' ? W : W * Math.sin(Math.PI * q.t));
        // Riding: no wider than the gap to the lower wave, so the moon
        // tracks the ripple (outside, it mirrors that gap across the curve).
        if (s.riding) o1 = Math.min(o1, Math.abs(q.x - s.chord(q.y)) * q.cos);
        const outer = [q.x + q.nx * o0, q.y + q.ny * o0];
        // Half-moon outside mirrors the chord across the curve.
        const chordX = p.side === 'outside' ? 2 * q.x - s.chord(q.y) : s.chord(q.y);
        const inner = p.style === 'halfmoon' ? [chordX, q.y] : [q.x + q.nx * o1, q.y + q.ny * o1];
        return { outer, inner, width: p.style === 'halfmoon' ? Infinity : o1 - o0 };
      });

      // Keep the longest stretch where this slice is wide enough to cut;
      // inner slices of a thin riding moon only fit near its middle.
      let best = [0, -1];
      for (let i = 0, start = -1; i <= pts.length; i++) {
        const fits = i < pts.length && pts[i].width >= cut.minHole;
        if (fits && start < 0) start = i;
        if (!fits && start >= 0) {
          if (i - 1 - start > best[1] - best[0]) best = [start, i - 1];
          start = -1;
        }
      }
      const run = pts.slice(best[0], best[1] + 1);
      if (run.length < 3) continue;
      const outer = run.map((r) => r.outer);
      const inner = run.map((r) => r.inner);
      const hole = polyHole([...outer, ...inner.reverse()]);
      if (!placeable(hole, cut)) {
        offEdge++;
        continue;
      }
      // Mirrored envelope edges can pinch together; keep the first moon
      // and drop any later one that would leave too thin a bridge.
      const clash = holes.some(
        (o) =>
          Math.abs(o.x - hole.x) < (o.w + hole.w) / 2 + cut.minBridge &&
          Math.abs(o.y - hole.y) < (o.h + hole.h) / 2 + cut.minBridge &&
          polyGap(o.points, hole.points) < cut.minBridge,
      );
      if (clash) dropped++;
      else holes.push(hole);
    }
  }
  holes.dropped = dropped;
  holes.offEdge = offEdge;
  if (p.fill !== 'halftone') return holes;

  // Draw the moons in dots: this sheet's halftone settings, with dot size
  // set by the moon shapes (full inside, fading over `spread` outside).
  const dots = halftone.generate(layer, makeFillField(holes, p.spread), cut);
  dots.shapes = holes; // the moon outlines, for sheets that avoid this one
  dots.dropped = dropped;
  dots.offEdge = offEdge;
  return dots;
}
