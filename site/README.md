# Ear & Eye (music practice games)

Plain HTML, CSS and JavaScript modules. No build step, no dependencies.

| Page | Game |
|---|---|
| `games/note.html` | Name That Note: hear C, then find the mystery note on a keyboard |
| `games/interval.html` | Interval Ear: name the distance between two notes |
| `games/chord.html` | Chord Quality: major, minor, dim, aug, sus, sevenths, with inversions |
| `games/scale.html` | Scale & Mode: major, minor, the 7 modes, pentatonics, blues, whole tone |
| `games/staff.html` | Staff Reader: treble/bass, ledger lines, answer by letter or exact piano key |

## Layout

- `js/theory.js`: all music theory (spelling, formulas, staff positions). Pure, tested.
- `js/audio.js`: small Web Audio synth (additive sine partials, piano-like decay).
- `js/staff.js`: SVG staff renderer.
- `js/quiz.js`: shared game loop (Practice and 60-second Sprint modes, scoring, keyboard shortcuts).
- `js/ui.js`: answer widgets (buttons, piano), settings helpers.

## Run locally

ES modules do not load from `file://`, so serve the folder:

```sh
cd site
npm run serve     # python3 -m http.server 8000, then open http://localhost:8000
npm test          # node --test, runs test/theory.test.js
```

## Deploy

`.github/workflows/pages.yml` runs the tests and publishes this folder on every push to `main`.
One-time setup: repo Settings > Pages > Source: **GitHub Actions**.
