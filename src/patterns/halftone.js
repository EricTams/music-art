// Halftone: a rotated grid of dots whose size follows the wave's ink field.
// Different screen angles per layer produce moiré where sheets overlap.

import { SHEET } from '../sheet.js';
import { placeable } from './common.js';

export function generate(layer, field, cut) {
  const p = layer.halftone;
  const cell = Math.max(p.cell, 0.02);
  const maxDot = Math.min(p.maxDot, cell - cut.minBridge);
  const minDot = Math.min(p.minDot, maxDot);
  const rot = (p.angle * Math.PI) / 180;
  const c = Math.cos(rot);
  const s = Math.sin(rot);

  const cx = SHEET.w / 2 + p.offsetX;
  const cy = SHEET.h / 2 + p.offsetY;
  const span = Math.ceil(Math.hypot(SHEET.w, SHEET.h) / 2 / cell) + 1;

  const holes = [];
  for (let j = -span; j <= span; j++) {
    for (let i = -span; i <= span; i++) {
      const u = i * cell;
      const v = j * cell;
      const x = cx + u * c - v * s;
      const y = cy + u * s + v * c;
      if (x < 0 || x > SHEET.w || y < 0 || y > SHEET.h) continue;

      const size = minDot + field.ink(x, y) * (maxDot - minDot);
      if (size < cut.minHole) continue;

      const hole = { shape: p.shape, x, y, w: size, h: size, rot };
      if (placeable(hole, cut)) holes.push(hole);
    }
  }
  return holes;
}
