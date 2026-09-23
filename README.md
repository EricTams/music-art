# Music Art

A 3D visualizer for a wall piece made of four stacked, laser-cut acrylic
sheets (yellow, orange, red and grey, front to back, 12 × 24 in, ⅛″ thick)
hung on corner standoffs. Each sheet is cut with holes driven by a sine
wave running top to bottom; where the sheets overlap, the colors mix.

- **Moons:** the wave is split at its inflection points and each piece is
  cut as a crescent. Sheets can each carry one harmonic of a shared master
  wave, or a partial sum, so the stack builds up to the full waveform.
- **Halftone:** dots sized by the wave, or filling the negative space the
  other sheets leave open.
- **Cut checks:** every sheet reports its thinnest bridge between holes
  and any holes that hit the edge frame or standoffs.

## Run locally

```sh
npm install
npm run dev
```

Then open http://localhost:5173. Designs are saved in the browser; use
Presets → Save preset (JSON) to keep one. `presets/` holds saved designs.

## Deploy

Pushing to `main` builds the static site and deploys it to GitHub Pages
(see `.github/workflows/pages.yml`). No server is needed.
