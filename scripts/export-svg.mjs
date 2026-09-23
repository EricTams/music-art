// Write laser cut SVGs for a design: node scripts/export-svg.mjs [preset.json] [outDir]
// With no preset, exports the default design. outDir defaults to
// exports/<width>x<height>.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { defaultState, mergeDefaults } from '../src/state.js';
import { generateAll } from '../src/generate.js';
import { sheetSvg } from '../src/export-svg.js';

const [presetPath, outArg] = process.argv.slice(2);
const state = presetPath ? mergeDefaults(JSON.parse(readFileSync(presetPath, 'utf8'))) : defaultState();
const outDir = outArg ?? `exports/${state.global.sheet.w}x${state.global.sheet.h}`;
const results = generateAll(state);

mkdirSync(outDir, { recursive: true });
state.layers
  .map((l, i) => ({ l, r: results[i] }))
  .sort((a, b) => b.l.depth - a.l.depth)
  .forEach(({ l, r }, k) => {
    const file = `${outDir}/${k + 1}-${l.name.toLowerCase()}.svg`;
    writeFileSync(file, sheetSvg(l, r.holes, state.global.cut));
    const { count, minBridge, ok } = r.check;
    console.log(`${file}  ${count} holes  min bridge ${Number.isFinite(minBridge) ? minBridge.toFixed(3) + "in" : "n/a (holes far apart)"}  ${ok ? 'ok' : 'CHECK'}`);
  });
