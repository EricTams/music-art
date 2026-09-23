// Control panel (lil-gui). Every change calls onChange(); structural
// changes (load, reset) rebuild the panel from the new state.

import GUI from 'lil-gui';
import { PATTERNS } from './patterns/index.js';
import { SOURCES } from './waves.js';

export function buildControls(state, { onChange, onView, onRandomize, onBuildUp, onHalftoneMoons, onReset, onSave, onLoad }) {
  const gui = new GUI({ title: 'Music Art' });

  const view = gui.addFolder('View');
  const views = {
    front: () => onView('front'),
    angle: () => onView('angle'),
    side: () => onView('side'),
    close: () => onView('close'),
  };
  view.add(views, 'front').name('Front');
  view.add(views, 'angle').name('¾ angle');
  view.add(views, 'side').name('Side');
  view.add(views, 'close').name('Close-up');

  const g = state.global;
  const stack = gui.addFolder('Stack');
  stack.add(g, 'gap', 0, 3, 0.0625).name('Gap between sheets (in)').onChange(onChange);
  stack.add(g, 'wallGap', 0.25, 4, 0.125).name('Back sheet to wall (in)').onChange(onChange);
  stack.addColor(g, 'wallColor').name('Wall color').onChange(onChange);

  const master = gui.addFolder('Master wave (Fourier)');
  for (const n of [1, 2, 3, 4]) {
    master.add(g.master, `h${n}f`, 0, 20, 0.05).name(`Harmonic ${n} cycles`).onChange(onChange);
    master.add(g.master, `h${n}a`, 0, 6, 0.05).name(`Harmonic ${n} amp (in)`).onChange(onChange);
    master.add(g.master, `h${n}p`, 0, Math.PI * 2, 0.01).name(`Harmonic ${n} phase`).onChange(onChange);
  }
  master.close();

  const cut = gui.addFolder('Cut rules');
  cut.add(g.cut, 'margin', 0, 2, 0.05).name('Edge frame (in)').onChange(onChange);
  cut.add(g.cut, 'standoffInset', 0.25, 1.5, 0.05).name('Standoff inset (in)').onChange(onChange);
  cut.add(g.cut, 'standoffDia', 0.1, 0.5, 0.01).name('Standoff hole Ø (in)').onChange(onChange);
  cut.add(g.cut, 'keepout', 0, 1, 0.05).name('Standoff keep-out (in)').onChange(onChange);
  cut.add(g.cut, 'minBridge', 0.03, 0.3, 0.01).name('Min bridge (in)').onChange(onChange);
  cut.add(g.cut, 'minHole', 0.01, 0.2, 0.01).name('Min hole (in)').onChange(onChange);
  cut.close();

  const actions = gui.addFolder('Presets');
  actions.add({ onBuildUp }, 'onBuildUp').name('Build-up (default design)');
  actions.add({ onHalftoneMoons }, 'onHalftoneMoons').name('Crescents as halftone (test)');
  actions.add({ onRandomize }, 'onRandomize').name('Randomize waves');
  actions.add({ onSave }, 'onSave').name('Save preset (JSON)…');
  actions.add({ onLoad }, 'onLoad').name('Load preset…');
  actions.add({ onReset }, 'onReset').name('Reset to defaults');

  state.layers.forEach((l) => {
    const f = gui.addFolder(`${l.name} sheet`);
    f.add(l, 'visible').name('Show sheet').onChange(onChange);
    f.add(l, 'showCurve').name('Show curve').onChange(onChange);
    f.addColor(l, 'color').name('Tint').onChange(onChange);
    f.add(l, 'strength', 0, 1, 0.01).name('Tint strength').onChange(onChange);
    f.add(l, 'depth', 0, state.layers.length - 1, 1).name('Stack position (0 = back)').onChange(onChange);
    f.add(l, 'pattern', Object.keys(PATTERNS)).name('Pattern').onChange(onChange);

    const w = f.addFolder('Wave');
    w.add(l.wave, 'source', SOURCES).name('Source').onChange(onChange);
    w.add(l.wave, 'mode', ['line', 'envelope']).name('Mode').onChange(onChange);
    w.add(l.wave, 'center', 0, 12, 0.05).name('Center x (in)').onChange(onChange);
    w.add(l.wave, 'base', 0, 5, 0.05).name('Envelope base (in)').onChange(onChange);
    w.add(l.wave, 'thickness', 0, 4, 0.05).name('Core width (in)').onChange(onChange);
    w.add(l.wave, 'softness', 0, 5, 0.05).name('Falloff (in)').onChange(onChange);
    w.add(l.wave, 'invert').name('Invert').onChange(onChange);
    for (const n of [1, 2, 3]) {
      w.add(l.wave, `s${n}f`, 0, 20, 0.05).name(`Own sine ${n} cycles`).onChange(onChange);
      w.add(l.wave, `s${n}a`, 0, 6, 0.05).name(`Own sine ${n} amp (in)`).onChange(onChange);
      w.add(l.wave, `s${n}p`, 0, Math.PI * 2, 0.01).name(`Own sine ${n} phase`).onChange(onChange);
    }

    const h = f.addFolder('Halftone');
    h.add(l.halftone, 'avoid').name('Avoid other sheets').onChange(onChange);
    h.add(l.halftone, 'clearance', 0, 1, 0.01).name('Clearance (in)').onChange(onChange);
    h.add(l.halftone, 'fade', 0, 4, 0.05).name('Fade distance (in)').onChange(onChange);
    h.add(l.halftone, 'shape', ['circle', 'square']).name('Shape').onChange(onChange);
    h.add(l.halftone, 'cell', 0.1, 1.5, 0.01).name('Grid pitch (in)').onChange(onChange);
    h.add(l.halftone, 'minDot', 0, 1, 0.01).name('Min dot (in)').onChange(onChange);
    h.add(l.halftone, 'maxDot', 0.02, 1.5, 0.01).name('Max dot (in)').onChange(onChange);
    h.add(l.halftone, 'angle', 0, 90, 0.5).name('Screen angle (°)').onChange(onChange);
    h.add(l.halftone, 'offsetX', -1, 1, 0.01).name('Grid offset x').onChange(onChange);
    h.add(l.halftone, 'offsetY', -1, 1, 0.01).name('Grid offset y').onChange(onChange);

    const b = f.addFolder('Bars');
    b.add(l.bars, 'pitch', 0.1, 1.5, 0.01).name('Row pitch (in)').onChange(onChange);
    b.add(l.bars, 'barH', 0.03, 1.2, 0.01).name('Bar height (in)').onChange(onChange);
    b.add(l.bars, 'minLen', 0, 2, 0.05).name('Min length (in)').onChange(onChange);
    b.add(l.bars, 'round').name('Rounded ends').onChange(onChange);
    b.add(l.bars, 'offsetY', 0, 1, 0.01).name('Row offset').onChange(onChange);

    const m = f.addFolder('Moons');
    m.add(l.moons, 'style', { Crescent: 'crescent', 'Half-moon (D)': 'halfmoon', Band: 'band' }).name('Style').onChange(onChange);
    m.add(l.moons, 'side', { 'Inside the bend': 'inside', 'Outside the bend': 'outside' }).name('Side').onChange(onChange);
    m.add(l.moons, 'fill', { Solid: 'solid', 'Halftone dots': 'halftone' }).name('Fill').onChange(onChange);
    m.add(l.moons, 'spread', 0, 1.5, 0.01).name('Dot spread past edge (in)').onChange(onChange);
    m.add(l.moons, 'thicknessBy', { Fixed: 'fixed', Curvature: 'curvature', Amplitude: 'amplitude' }).name('Thickness follows').onChange(onChange);
    m.add(l.moons, 'thickness', 0.03, 3, 0.01).name('Max thickness (in)').onChange(onChange);
    m.add(l.moons, 'slices', 1, 8, 1).name('Slices').onChange(onChange);
    m.add(l.moons, 'sliceGap', 0, 1, 0.01).name('Slice gap (in)').onChange(onChange);
    m.add(l.moons, 'tipGap', 0, 1, 0.01).name('Tip gap (in)').onChange(onChange);
    m.add(l.moons, 'minBow', 0, 1, 0.01).name('Skip bows under (in)').onChange(onChange);
    m.add(l.moons, 'rideLower').name('Ride the lower wave').onChange(onChange);

    w.close();
    h.close();
    m.close();
    b.close();
    f.close();
  });

  return gui;
}
