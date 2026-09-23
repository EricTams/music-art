// Bars: horizontal slots stacked down the sheet, like an audio meter turned
// on its side. Envelope mode centers each bar on the wave's center with a
// length of 2 × halfWidth; line mode draws a signed bar from the center out
// to the wave, like an oscilloscope trace.

import { SHEET, standoffCenters, keepoutRadius } from '../sheet.js';
import { placeable } from './common.js';

export function generate(layer, field, cut) {
  const p = layer.bars;
  const wave = layer.wave;
  const pitch = Math.max(p.pitch, 0.02);
  const barH = Math.min(p.barH, pitch - cut.minBridge);
  if (barH < cut.minHole) return [];

  // Rows near the standoffs get their x range pulled in to clear them.
  const kr = keepoutRadius(cut);
  const corners = standoffCenters(cut);

  const holes = [];
  for (let y = cut.margin + barH / 2 + p.offsetY; y <= SHEET.h - cut.margin - barH / 2; y += pitch) {
    let x0, x1;
    if (wave.mode === 'envelope') {
      const hw = field.halfWidth(y);
      x0 = wave.center - hw;
      x1 = wave.center + hw;
    } else {
      const s = field.signal(y);
      x0 = Math.min(wave.center, wave.center + s);
      x1 = Math.max(wave.center, wave.center + s);
    }
    x0 = Math.max(x0, cut.margin);
    x1 = Math.min(x1, SHEET.w - cut.margin);

    for (const c of corners) {
      if (Math.abs(y - c.y) < kr + barH / 2) {
        if (c.x < SHEET.w / 2) x0 = Math.max(x0, c.x + kr);
        else x1 = Math.min(x1, c.x - kr);
      }
    }

    const len = x1 - x0;
    if (len < Math.max(p.minLen, barH, cut.minHole)) continue;

    const hole = { shape: p.round ? 'bar' : 'square', x: (x0 + x1) / 2, y, w: len, h: barH, rot: 0 };
    if (placeable(hole, cut)) holes.push(hole);
  }
  return holes;
}
