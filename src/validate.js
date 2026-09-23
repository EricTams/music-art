// Cut-safety checks on a generated hole list: the thinnest bridge between
// neighboring holes, plus any holes that break the frame or standoff rules.

import { support, placeable, toPolygon, polyGap } from './patterns/common.js';

// Separating-axis gap between two holes: the largest projected gap over the
// center line and each rectangle's own axes. Never more than the true
// distance, so it errs on the safe side.
function separation(a, b, dx, dy, d) {
  const axes = [[dx / d, dy / d]];
  for (const h of [a, b]) {
    if (h.shape === 'circle') continue;
    axes.push([Math.cos(h.rot), Math.sin(h.rot)], [-Math.sin(h.rot), Math.cos(h.rot)]);
  }
  let best = -Infinity;
  for (const [ux, uy] of axes) {
    const g = Math.abs(dx * ux + dy * uy) - support(a, ux, uy) - support(b, ux, uy);
    if (g > best) best = g;
  }
  return best;
}

export function validate(holes, cut) {
  let minBridge = Infinity;
  let violations = 0;

  if (holes.length) {
    const maxExtent = holes.reduce((m, h) => Math.max(m, h.w, h.h), 0);
    const bin = Math.max(maxExtent + cut.minBridge, 0.05);
    const grid = new Map();
    const key = (i, j) => i * 100003 + j;

    holes.forEach((h, idx) => {
      const k = key(Math.floor(h.x / bin), Math.floor(h.y / bin));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(idx);
    });

    holes.forEach((a, ai) => {
      const bi0 = Math.floor(a.x / bin);
      const bj0 = Math.floor(a.y / bin);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const cell = grid.get(key(bi0 + di, bj0 + dj));
          if (!cell) continue;
          for (const bi of cell) {
            if (bi <= ai) continue;
            const b = holes[bi];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            if (a.shape === 'poly' || b.shape === 'poly') {
              if (Math.abs(dx) > (a.w + b.w) / 2 + cut.minBridge * 4) continue;
              if (Math.abs(dy) > (a.h + b.h) / 2 + cut.minBridge * 4) continue;
              const gap = polyGap(toPolygon(a), toPolygon(b));
              if (gap < minBridge) minBridge = gap;
              continue;
            }
            const d = Math.hypot(dx, dy);
            if (d === 0) {
              minBridge = Math.min(minBridge, -1);
              continue;
            }
            const gap = separation(a, b, dx, dy, d);
            if (gap < minBridge) minBridge = gap;
          }
        }
      }
    });

    for (const h of holes) if (!placeable(h, cut)) violations++;
  }

  const ok = violations === 0 && (minBridge === Infinity || minBridge >= cut.minBridge - 1e-6);
  return { count: holes.length, minBridge, violations, ok };
}
