// Pattern registry. To add a new idea, write a module exporting
// generate(layer, field, cut) → holes[] and register it here.

import * as halftone from './halftone.js';
import * as bars from './bars.js';
import * as moons from './moons.js';

export const PATTERNS = { halftone, bars, moons };
