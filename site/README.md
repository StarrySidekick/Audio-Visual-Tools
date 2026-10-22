# Ear & Eye (music practice games)

Plain HTML, CSS and JavaScript modules. No build step, no dependencies.

| Page | Game |
|---|---|
| `games/note.html` | Name That Note: hear C, then find the mystery note on a keyboard |
| `games/interval.html` | Interval Ear: name the distance between two notes |
| `games/chord.html` | Chord Quality: major, minor, dim, aug, sus, sevenths, with inversions |
| `games/scale.html` | Scale & Mode: major, minor, the 7 modes, pentatonics, blues, whole tone |
| `games/staff.html` | Staff Reader: treble/bass, ledger lines, answer by letter or exact piano key |
| `games/progression.html` | Progression Detective: name a 4-chord progression in Roman numerals (4 levels, up to borrowed chords) |
| `games/harmonize.html` | Harmonize It: choose a chord per bar under a melody; any chord containing the strong-beat notes counts |
| `games/roulette.html` | Chord Roulette: roll 2-6 random chords, lock favorites, export MIDI |

## Layout

- `js/theory.js`: all music theory (spelling, formulas, staff positions). Pure, tested.
- `js/audio.js`: small Web Audio synth (additive sine partials, piano-like decay).
- `js/harmony.js`: keys, Roman numerals, voice leading, progression and melody generators. Pure, tested.
- `js/midi.js`: tiny Standard MIDI File writer (for Roulette's export). Tested.
- `js/staff.js`: SVG staff renderer (single notes, and short melodies with key signatures).
- `js/quiz.js`: shared game loop (Practice and 60-second Sprint modes, scoring, keyboard shortcuts).
- `js/ui.js`: answer widgets (buttons, piano), settings helpers.
- `icons/`: home-screen icons (below): each icon's art (`<id>.svg`), its sizes and, for a game, its web app manifest (`<id>/`). The home page's manifest is `app.webmanifest`.

## Run locally

ES modules do not load from `file://`, so serve the folder:

```sh
cd site
npm run serve     # python3 -m http.server 8000, then open http://localhost:8000
npm test          # node --test, runs everything in test/
```

## Home-screen icons

Each page can be saved to a phone's home screen as an app of its own, with its
own icon (Timothy, 2026-10-22: "can we give each repo its own icon for
usability purposes ... also each game if they are in the same repo"). The
icons are one family: a flat field in each game's own colour, faint staff
lines across it, and one bold glyph inside the middle circle, with gold for
the answer.

| App | Colour | Glyph |
|---|---|---|
| Ear & Eye (`index.html`) | the site's blue | the ampersand of the name |
| Name That Note | red | a piece of keyboard, the found key gold |
| Interval Ear | orange | two notes and a gold arrow for the gap |
| Chord Quality | green | three notes stacked on one stem |
| Scale & Mode | teal | four notes climbing |
| Staff Reader | cream paper | the staff, a treble clef and a blue note |
| Progression Detective | violet | a magnifying glass over a gold IV |
| Harmonize It | magenta | a melody with a gold second voice under it |
| Chord Roulette | near black | a die whose pips are noteheads |

To change an icon, edit its art in `icons/<id>.svg` (1024 square; keep what
matters inside the middle circle, 80% of the width, since Android cuts icons
round). A new game page goes into `app-icons.json` at the repo root, in the
same commit. Then, from the repo, run the app-icons skill's script (in
Interpersonal-Games, `.claude/skills/app-icons/`):

```sh
node <skill folder>/make-icons.mjs --sheet  # every size, the manifests, the icon lines in each page, .app-icons/sheet.png
```

The games share one folder, so each game's manifest sits in `icons/<id>/`
and its `start` in `app-icons.json` points it back at its page.
`npm test` fails if a page lacks its icon lines or a manifest does not start
at its page.

A phone keeps the icon it saved: after an icon changes, remove the app from
the home screen and save it again. On an iPhone a saved app keeps its own
storage, apart from Safari's, so settings and best streaks from the browser
do not carry into the saved app.

## Deploy

`.github/workflows/pages.yml` runs the tests and publishes this folder on every push to `main`.
One-time setup: repo Settings > Pages > Source: **GitHub Actions**.
