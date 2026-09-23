// State → holes for every sheet. Shared by the page and by offline checks.

import { makeField } from './waves.js';
import { PATTERNS } from './patterns/index.js';
import { validate } from './validate.js';
import { makeAvoidField } from './avoid.js';

// The wave(s) a sheet is built from, as polylines in sheet inches. The
// lower wave is included (dashed) when moons ride on it.
function curvesOf(layer, field) {
  const w = layer.wave;
  const trace = (fx) => Array.from({ length: 241 }, (_, i) => [fx(i * 0.1), i * 0.1]);
  if (w.mode === 'envelope') {
    return [
      { points: trace((y) => w.center + field.halfWidth(y)) },
      { points: trace((y) => w.center - field.halfWidth(y)) },
    ];
  }
  const out = [{ points: trace((y) => w.center + field.signal(y)) }];
  if (layer.pattern === 'moons' && layer.moons.rideLower) {
    out.push({ points: trace((y) => w.center + field.carrier(y)), dashed: true });
  }
  return out;
}

const avoids = (l) => l.pattern === 'halftone' && l.halftone.avoid;

// Sheets that fill negative space are generated last, from the holes of
// every other sheet.
export function generateAll(state) {
  const cut = state.global.cut;
  const results = [];
  const order = state.layers.map((l, i) => i).sort((a, b) => avoids(state.layers[a]) - avoids(state.layers[b]));
  for (const i of order) {
    const layer = state.layers[i];
    const field = makeField(layer.wave, state.global.master);
    let pattern = field;
    if (avoids(layer)) {
      const others = results.filter((r, j) => r && j !== i && !avoids(state.layers[j]) && state.layers[j].visible);
      // Avoid the shapes a sheet draws (moon outlines), not its individual dots.
      pattern = makeAvoidField(others.flatMap((r) => r.holes.shapes ?? r.holes), layer.halftone.clearance, layer.halftone.fade);
    }
    const holes = PATTERNS[layer.pattern].generate(layer, pattern, cut);
    results[i] = {
      holes,
      curves: curvesOf(layer, field),
      check: { ...validate(holes, cut), dropped: holes.dropped ?? 0, offEdge: holes.offEdge ?? 0 },
    };
  }
  return results;
}
