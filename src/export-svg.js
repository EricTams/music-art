// Laser cut files: one SVG per sheet, in real inches.
//
// Laid out for Glowforge (and most laser software): every shape is a
// stroke with no fill, so it imports as a cut, not an engrave. Each color
// becomes its own step in the Glowforge app:
//   blue  - pattern holes          (cut first)
//   red   - standoff holes
//   green - sheet outline          (only if cutting from larger stock; cut last)

import { SHEET, standoffCenters } from './sheet.js';

export const CUT_COLORS = {
  holes: '#0000ff',
  standoffs: '#ff0000',
  outline: '#00a000',
};

const n = (v) => +v.toFixed(4);

function shapeSvg(h) {
  if (h.shape === 'circle') return `<circle cx="${n(h.x)}" cy="${n(h.y)}" r="${n(h.w / 2)}"/>`;
  if (h.shape === 'poly') {
    return `<path d="M${h.points.map(([x, y]) => `${n(x)},${n(y)}`).join('L')}Z"/>`;
  }
  const deg = n((h.rot * 180) / Math.PI);
  const rot = deg ? ` transform="rotate(${deg} ${n(h.x)} ${n(h.y)})"` : '';
  const r = h.shape === 'bar' ? ` rx="${n(Math.min(h.w, h.h) / 2)}"` : '';
  return `<rect x="${n(h.x - h.w / 2)}" y="${n(h.y - h.h / 2)}" width="${n(h.w)}" height="${n(h.h)}"${r}${rot}/>`;
}

export function sheetSvg(layer, holes, cut) {
  const group = (id, color, body) =>
    `  <g id="${id}" fill="none" stroke="${color}" stroke-width="0.01">\n${body}\n  </g>`;
  const standoffs = standoffCenters(cut).map((c) => ({
    shape: 'circle', x: c.x, y: c.y, w: cut.standoffDia, h: cut.standoffDia, rot: 0,
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${layer.name} sheet: ${SHEET.w} x ${SHEET.h} in, ${holes.length} holes.
     Blue = pattern holes, red = standoff holes, green = sheet outline.
     All strokes, no fills: each color imports as a separate cut step. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}in" height="${SHEET.h}in" viewBox="0 0 ${SHEET.w} ${SHEET.h}">
${group('pattern-holes', CUT_COLORS.holes, holes.map((h) => '    ' + shapeSvg(h)).join('\n'))}
${group('standoff-holes', CUT_COLORS.standoffs, standoffs.map((h) => '    ' + shapeSvg(h)).join('\n'))}
${group('sheet-outline', CUT_COLORS.outline, `    <rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}"/>`)}
</svg>
`;
}
