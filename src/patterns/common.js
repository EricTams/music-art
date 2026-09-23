// Shared helpers for pattern generators.
//
// A hole is { shape: 'circle'|'square'|'bar', x, y, w, h, rot } in inches,
// centered at (x, y), rot in radians. 'bar' is a rounded slot (stadium).
// A free-form hole is { shape: 'poly', points: [[x, y], ...], x, y, w, h }
// where x/y is the bounding-box center and w/h its size.

import { SHEET, standoffCenters, keepoutRadius } from '../sheet.js';

// Half-extent of a hole projected onto unit direction (ux, uy).
export function support(hole, ux, uy) {
  if (hole.shape === 'circle') return hole.w / 2;
  if (hole.shape === 'poly') {
    let lo = Infinity;
    let hi = -Infinity;
    for (const [x, y] of hole.points) {
      const d = (x - hole.x) * ux + (y - hole.y) * uy;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    return Math.max(-lo, hi);
  }
  const c = Math.cos(hole.rot);
  const s = Math.sin(hole.rot);
  return (Math.abs(ux * c + uy * s) * hole.w) / 2 + (Math.abs(-ux * s + uy * c) * hole.h) / 2;
}

// Outline of any hole as a polygon, for distance checks.
export function toPolygon(hole) {
  if (hole.shape === 'poly') return hole.points;
  const c = Math.cos(hole.rot);
  const s = Math.sin(hole.rot);
  const place = (u, v) => [hole.x + u * c - v * s, hole.y + u * s + v * c];
  if (hole.shape === 'circle') {
    return Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      return place((Math.cos(a) * hole.w) / 2, (Math.sin(a) * hole.w) / 2);
    });
  }
  const hw = hole.w / 2;
  const hh = hole.h / 2;
  if (hole.shape === 'bar') {
    // Stadium: two half circles joined by straight sides.
    const r = Math.min(hw, hh);
    const pts = [];
    const along = hw >= hh;
    const ext = (along ? hw : hh) - r;
    for (const end of [1, -1]) {
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI - Math.PI / 2;
        const u = end * (ext + r * Math.cos(a));
        const v = end * r * Math.sin(a);
        pts.push(along ? place(u, v) : place(v, u));
      }
    }
    return pts;
  }
  return [place(-hw, -hh), place(hw, -hh), place(hw, hh), place(-hw, hh)];
}

// Build a poly hole from an outline.
export function polyHole(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { shape: 'poly', points, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, rot: 0 };
}

// Is the hole fully inside the margin frame and clear of every standoff?
export function placeable(hole, cut) {
  const ex = support(hole, 1, 0);
  const ey = support(hole, 0, 1);
  if (hole.x - ex < cut.margin || hole.x + ex > SHEET.w - cut.margin) return false;
  if (hole.y - ey < cut.margin || hole.y + ey > SHEET.h - cut.margin) return false;
  const kr = keepoutRadius(cut);
  for (const c of standoffCenters(cut)) {
    if (hole.shape === 'poly') {
      if (hole.points.some(([x, y]) => Math.hypot(x - c.x, y - c.y) < kr)) return false;
    } else {
      const r = Math.hypot(hole.w, hole.h) / 2; // conservative bounding circle
      if (Math.hypot(hole.x - c.x, hole.y - c.y) < kr + r) return false;
    }
  }
  return true;
}

function segDist(ax, ay, bx, by, px, py) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0;
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Exact-enough gap between two outlines: vertex-to-edge distances both
// ways, negative when they overlap.
export function polyGap(pa, pb) {
  if (inside(pb, ...pa[0]) || inside(pa, ...pb[0])) return -1;
  let best = Infinity;
  for (const [p, q] of [[pa, pb], [pb, pa]]) {
    for (const [x, y] of p) {
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
        const d = segDist(q[j][0], q[j][1], q[i][0], q[i][1], x, y);
        if (d < best) best = d;
      }
    }
  }
  return best;
}
