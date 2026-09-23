// Physical sheet geometry. All units are inches; origin is the sheet's
// top-left corner with y increasing downward (as hung, portrait).

// Sheet size lives in the design state (global.sheet); generateAll copies
// it here before building, so every module reads the current size.
export const SHEET = {
  w: 12,
  h: 20,
  t: 0.125,
};

export function setSheetSize({ w, h }) {
  SHEET.w = w;
  SHEET.h = h;
}

// Default cut rules, editable from the Global panel.
export const DEFAULT_CUT = {
  margin: 0.5, // solid frame left around the edge
  standoffInset: 0.5, // standoff hole center distance from each edge
  standoffDia: 0.25, // standoff hole diameter
  keepout: 0.2, // extra solid ring around each standoff hole
  minBridge: 0.1, // thinnest acrylic allowed between two holes
  minHole: 0.04, // smallest hole the laser should cut
};

export function standoffCenters(cut) {
  const i = cut.standoffInset;
  return [
    { x: i, y: i },
    { x: SHEET.w - i, y: i },
    { x: i, y: SHEET.h - i },
    { x: SHEET.w - i, y: SHEET.h - i },
  ];
}

// Radius around a standoff center that pattern holes must stay out of.
export function keepoutRadius(cut) {
  return cut.standoffDia / 2 + cut.keepout;
}
