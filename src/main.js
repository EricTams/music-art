import { createRenderer } from './render3d.js';
import { buildControls } from './controls.js';
import { generateAll as generate } from './generate.js';
import { loadState, saveState, defaultState, mergeDefaults, randomizeLayer, randomizeMaster, applyBuildUp, applyHalftoneMoons } from './state.js';

let state = loadState();
let gui;
const view = createRenderer(document.getElementById('stage'));
const statsEl = document.getElementById('stats');
const fileInput = document.getElementById('preset-file');

function renderStats(results) {
  const rows = state.layers
    .map((l, i) => ({ l, r: results[i], i }))
    .sort((a, b) => b.l.depth - a.l.depth)
    .map(({ l, r, i }) => {
      const { count, minBridge, violations, ok } = r.check;
      const bridge = Number.isFinite(minBridge)
        ? `${minBridge.toFixed(3)}″ <span class="mm">${(minBridge * 25.4).toFixed(1)} mm</span>`
        : '—';
      const status = ok ? '<span class="pill ok">ok</span>' : '<span class="pill warn">check</span>';
      const { dropped, offEdge } = r.check;
      const note =
        (violations ? ` · ${violations} outside frame` : '') +
        (dropped ? ` · ${dropped} dropped (too close)` : '') +
        (offEdge ? ` · ${offEdge} dropped (off the edge)` : '');
      const toggle = (key, label) =>
        `<button type="button" class="toggle" data-layer="${i}" data-key="${key}" aria-pressed="${l[key]}">${label}</button>`;
      return `<tr class="${l.visible ? '' : 'off'}">
        <td class="toggles">${toggle('visible', 'Sheet')}${toggle('showCurve', 'Curve')}</td>
        <td class="name"><span class="swatch" style="background:${l.color}"></span>${l.name}</td>
        <td>${l.pattern}</td>
        <td class="num">${count.toLocaleString()}</td>
        <td class="num">${bridge}${note}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join('');
  statsEl.innerHTML = `<table>
    <thead><tr><th>Show</th><th>Sheet (front → back)</th><th>Pattern</th><th class="num">Holes</th><th class="num">Min bridge</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;

  console.table(
    state.layers.map((l, i) => ({
      sheet: l.name,
      holes: results[i].check.count,
      minBridgeIn: +results[i].check.minBridge.toFixed(4),
      outsideFrame: results[i].check.violations,
      ok: results[i].check.ok,
    })),
  );
}

let pending = false;
function refresh() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const results = generate(state);
    const { w, h } = state.global.sheet;
    document.getElementById('sheet-size').textContent = `4 sheets · ${w} × ${h} in · ⅛″`;
    view.update(state, results);
    renderStats(results);
    saveState(state);
  });
}

function rebuildControls() {
  gui?.destroy();
  gui = buildControls(state, {
    onChange: refresh,
    onView: view.setView,
    onRandomize: () => {
      randomizeMaster(state.global.master);
      state.layers.forEach(randomizeLayer);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      refresh();
    },
    onBuildUp: () => {
      applyBuildUp(state);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      refresh();
    },
    onHalftoneMoons: () => {
      applyHalftoneMoons(state);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      refresh();
    },
    onReset: () => {
      state = defaultState();
      rebuildControls();
      refresh();
    },
    onSave: () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `music-art-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    onLoad: () => fileInput.click(),
  });
}

// Hide everything but this button, to see the piece full screen (phones).
const uiToggle = document.getElementById('ui-toggle');
uiToggle.addEventListener('click', () => {
  const hidden = document.body.classList.toggle('ui-hidden');
  uiToggle.textContent = hidden ? 'Show UI' : 'Hide UI';
  uiToggle.setAttribute('aria-pressed', String(hidden));
});

statsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button.toggle');
  if (!btn) return;
  const layer = state.layers[Number(btn.dataset.layer)];
  layer[btn.dataset.key] = !layer[btn.dataset.key];
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  refresh();
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    state = mergeDefaults(JSON.parse(await file.text()));
    rebuildControls();
    refresh();
  } catch (err) {
    statsEl.insertAdjacentHTML('afterbegin', `<p class="error">Couldn't read ${file.name}: ${err.message}</p>`);
  }
});

rebuildControls();
refresh();
