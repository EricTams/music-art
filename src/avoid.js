// Ink fields built from other shapes rather than from a wave:
//   makeAvoidField - negative space: 0 on and near the shapes, rising to 1
//                    away from them, so a halftone fills what they leave open
//   makeFillField  - the shapes themselves: 1 inside, fading to 0 outside,
//                    so a halftone draws them in dots

import { toPolygon } from './patterns/common.js';

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function smoothstep(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// inside(x, y) and distance to the nearest outline (capped at `reach`).
function shapeDistance(holes, reach) {
  reach = Math.max(reach, 0.05);
  const polys = holes.map((h) => {
    const pts = toPolygon(h);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { pts, x0, y0, x1, y1 };
  });

  // Bucket outline points so each lookup only scans nearby ones.
  const buckets = new Map();
  const key = (i, j) => i * 100003 + j;
  for (const p of polys) {
    for (const [x, y] of p.pts) {
      const k = key(Math.floor(x / reach), Math.floor(y / reach));
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(x, y);
    }
  }

  return {
    inside(x, y) {
      return polys.some((p) => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1 && inside(p.pts, x, y));
    },
    dist(x, y) {
      const bi = Math.floor(x / reach);
      const bj = Math.floor(y / reach);
      let best = reach * reach;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const b = buckets.get(key(bi + di, bj + dj));
          if (!b) continue;
          for (let i = 0; i < b.length; i += 2) {
            const d = (b[i] - x) ** 2 + (b[i + 1] - y) ** 2;
            if (d < best) best = d;
          }
        }
      }
      return Math.sqrt(best);
    },
  };
}

export function makeAvoidField(holes, clearance, fade) {
  const sd = shapeDistance(holes, clearance + fade);
  return {
    ink(x, y) {
      if (sd.inside(x, y)) return 0;
      const d = sd.dist(x, y) - clearance;
      return d <= 0 ? 0 : smoothstep(d / Math.max(fade, 1e-6));
    },
  };
}

export function makeFillField(holes, spread) {
  const sd = shapeDistance(holes, spread);
  return {
    ink(x, y) {
      if (sd.inside(x, y)) return 1;
      if (spread <= 0) return 0;
      return 1 - smoothstep(sd.dist(x, y) / spread);
    },
  };
}
