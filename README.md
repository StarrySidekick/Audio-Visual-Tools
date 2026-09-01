# Audio-Visual-Tools

A personal toolkit for film post-production and music-making. The goal:
take the repetitive, mechanical parts of editing picture, editing sound, and
building music — and turn them into tools, so more time goes to the parts
that need ears and taste.

## The three environments

| App | Role | What we build for it |
|---|---|---|
| **Adobe Premiere Pro** | Picture editing (docs + narrative) | Ingest/stringout automation, timeline prep, media logging |
| **Pro Tools** | Post sound (dialogue, Foley, SFX, mix) | AAF conform helpers, session prep, RX-adjacent batch passes |
| **Ableton Live** | Music composition & production | Music-theory MIDI tools (chords/progressions), eventually a custom synth |

## What's here

| Tool | Status | What it does |
|---|---|---|
| [`tools/stringout`](tools/stringout/) | **v1, working** | The "assistant editor": scan a footage drive, log every clip (CSV + JSON), and generate a stringout timeline (FCP7 XML) that imports straight into Premiere |
| `tools/silt` | **scoping** | A texture/drone instrument for scoring picture — written in Cmajor so it hot-reloads while Ableton plays, exported to VST3/AU via JUCE ([scope](docs/silt-scope.md)) |
| `tools/autosync` | **scoping** | Sync sound to picture with no slate, no timecode and no labels — pair and align by content, with a confidence score per clip ([scope](docs/autosync-scope.md)) |

## Docs

- [`docs/workflow-problems.md`](docs/workflow-problems.md) — the actual problems this repo exists to solve, in plain language
- [`docs/existing-tools.md`](docs/existing-tools.md) — what already exists (free/cheap) so we don't rebuild solved problems
- [`docs/roadmap.md`](docs/roadmap.md) — what to build next, in what order, and why
- [`docs/silt-scope.md`](docs/silt-scope.md) — design scope for `silt`: the texture instrument, and why Cmajor before JUCE
- [`docs/autosync-scope.md`](docs/autosync-scope.md) — design scope for `autosync`: how to sync clips with nothing to go on

## Principles

1. **Buy/download before build.** If a $30 tool or a free plugin solves it, use that. We build where nothing fits or where the fit is personal.
2. **Assist, don't automate taste.** Tools get you *to the creative decision faster* — they never make it for you. (e.g. session prep for a dialogue pass, yes; auto-dehiss the whole film, no.)
3. **Plain files in, plain files out.** Prefer open interchange formats (XML, AAF, MIDI, CSV, JSON) over app-specific scripting when possible — they survive app updates.
4. **Every tool runs from the terminal with no exotic setup.** Python 3 + ffmpeg is the baseline stack.
