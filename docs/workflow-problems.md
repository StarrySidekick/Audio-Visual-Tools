# Workflow problems this repo exists to solve

These are the recurring pain points across picture editing, post sound, and
music composition. Each one is stated as a problem, not a solution — the
roadmap maps problems to tools.

## P1 — Footage ingest & the "assistant editor" gap (Premiere)

When a shoot wraps and a drive full of footage arrives, getting from
*drive* to *editable project* is slow and unstructured:

- Files are scattered across camera-card folder structures (`PRIVATE/CLIP/…`),
  sound-recorder folders, and loose files.
- There's no quick way to see **what you have**: how many hours, what frame
  rates, what's from which camera/card/day.
- Building a "watch everything" master timeline (a stringout) by hand means
  dragging hundreds of clips and losing an afternoon.

**What's needed:** the classic assistant-editor pass, automated — scan,
log, and lay everything on a timeline in shoot order so you can start
watching and pulling selects immediately. *(→ `tools/stringout`, built)*

## P2 — AAF turnover into Pro Tools (post sound)

Taking the picture lock's AAF into Pro Tools and getting to a real working
session takes too long:

- AAF import lands on unnamed, disorganized tracks; dialogue/mic assignments
  are a puzzle.
- Session setup (track layout, routing, video sync, session settings) is
  rebuilt by hand every project.
- The first cleanup passes (RX de-hiss, de-hum, de-click on dialogue) are
  ear-critical and should **stay manual** — but *getting to the point where
  those passes can start* (clips organized, tracks named, problem regions
  identified) is mechanical and slow.

**What's needed:** turnover prep tooling — a solid session template
discipline, plus tools that analyze the AAF/audio *before* Pro Tools opens:
which clips are noisy, where hum lives (50/60 Hz detection), channel/mic
mapping suggestions, a "problem report" for the dialogue edit. Analysis and
triage, not automated processing.

## P3 — Music theory at the point of creation (Ableton)

Chord/progression exploration happens in a separate app (Suggester on iOS)
and then gets re-entered by hand in Ableton:

- Good progression ideas die in the transfer between apps.
- No in-DAW way to audition "what chord could come next" in the actual
  project context, with the actual instrument.

**What's needed:** chord/progression tools *inside* Live — starting with
MIDI-file generation (progressions rendered as `.mid` you drag in), possibly
growing into a MIDI-effect plugin that sits on the instrument track.

## P4 — A synthesizer developed as code, not patched in Max

Building a personal instrument in Max for Live means working in a visual
patching environment that's hard to iterate on with an AI coding assistant.

**What's needed:** a synth defined in code (a real plugin project) that can
be edited, versioned, and rebuilt from this repo — loadable in Ableton as
VST3/AU.

## P5 — The long-tail workflow friction

Documentary reality: very long interviews/talks, multiple cameras and
audio streams to line up, and constant switching between "find the material"
and "shape the material." Composition reality: hunting for the right
instrument/sound for the job. These accumulate small tools over time —
multicam sync helpers, selects-pulling aids, sound-library search, etc.
Logged here as they come up.
