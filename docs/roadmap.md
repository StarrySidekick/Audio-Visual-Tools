# Roadmap

Ordered by (value ÷ effort), honoring the principle: **buy/download before
build, and never automate taste.**

## Phase 0 — Adopt what exists (no code, ~$0–25)

- [ ] Try **Suggester 2 for macOS as an AUv3 inside Live** — may fully solve
      the "chords live in another app" problem (free to try).
- [ ] Learn **Live 12's MIDI Generators** (Stacks/Seed) + Transformations —
      scale-degree progression generation is already in the DAW.
- [ ] Install **Ripchord** (free) for chord triggering; build a personal
      preset pack from favorite Suggester progressions.
- [ ] In Premiere, make **Automate to Sequence** part of the muscle memory —
      it's the free last-mile of any stringout workflow.
- [ ] Optional: **Cauldron ($25)** if in-Premiere sequence building comes up
      a lot; **Post Haste** (free) for per-project folder templates.

## Phase 1 — `stringout` (assistant editor) — ✅ v1 shipped

Scan drive → media log (CSV/JSON) → stringout timeline (FCP7 XML) into
Premiere. See [`tools/stringout`](../tools/stringout/).

**v2 candidates (in rough order):**
- [ ] `--group-by day|card` → one sequence per day/card, plus a master
- [ ] Bin structure in the XML (clips organized by card/day in the project panel)
- [ ] Audio analysis during scan: peak/RMS levels, silence %, clipping flags
      in the media log
- [ ] HTML "dailies report" — thumbnails (ffmpeg), durations, cards, problems

## Phase 1.5 — `autosync` (sync with no slate, no timecode, no labels)

Pair every camera clip to the right sound roll at the right offset by
*content* — camera scratch audio is a fingerprint of the same room the boom
heard — and report each result with a confidence score. Full design in
[`docs/autosync-scope.md`](autosync-scope.md).

- [ ] **Phase −1, no code:** measure Premiere's own `Create Multi-Camera
      Source Sequences` (Synchronize Point: Audio) on a real drive — it already
      batch-pairs camera clips to production sound for free. Count what it got
      right, what it silently skipped, and what drifted. That failure rate is
      the entire business case; under ~2%, shelve the rest of this
- [ ] v0 spike: two files in → offset out (GCC-PHAT + envelope correlation),
      run on the clips Premiere got *wrong*. The go/no-go
- [ ] v1: many-to-many pairing over a `stringout` manifest, landmark
      fingerprinting to prune candidates, `sync-report.csv/json` with
      confidence, FCP7 XML per sync group, review list for flagged clips
- [ ] v2: clock-drift fitting (ppm slope, not one offset) + graph solve for
      multicam with cycle-consistency checking
- [ ] v3: fallbacks for MOS / no-shared-audio material

**Dependency note:** this is the one tool that can't stay stdlib-only —
proposal is numpy (plus ffmpeg, as always) and nothing else.

## Phase 2 — AAF pre-flight analyzer for Pro Tools turnover

The gap no product fills: **triage before the ear-work starts.**

- [ ] Parse the AAF with `pyaaf2` (free, Python): report tracks, clips,
      channel counts, source files, gaps/overlaps — a turnover manifest
- [ ] Audio triage per clip (ffmpeg/numpy): 50/60 Hz hum detection (and
      harmonics), broadband hiss estimate (noise floor), clipping, clicks —
      a **problem map** for the dialogue edit, so RX passes start with a
      list of *where to listen*, never an automated fix
- [ ] Pro Tools session-prep conventions doc: track layout template
      (DX/PFX/FOLEY/SFX/MX), naming rules, import checklist
- [ ] Later: generate PT session markers at problem locations (via MIDI
      file or text export PT can consume)

**Explicit non-goal:** batch-applying RX processing. De-hiss/de-hum
decisions stay with the ear.

## Phase 3 — Music tools for Ableton

- [ ] `progression` CLI: text in (`"i bVI III bVII in C minor, 4 bars"`) →
      `.mid` out with proper voicing/voice-leading options — drag into Live.
      This is the Claude-Code-native version of Suggester: describe, get MIDI
- [ ] Personal chord-vocabulary library (favorite voicings/progressions as
      data, rendered to MIDI or Ripchord preset XML)
- [ ] Later: a MIDI-effect plugin (JUCE) that hosts that vocabulary in-DAW

## Phase 4 — `silt`, the texture instrument — **pulled forward, next up**

A personal instrument developed as code. Full design in
[`docs/silt-scope.md`](silt-scope.md).

Out of roadmap order on purpose: it's the most fun thing here, and the
iteration loop turns out to be good enough to make that a real argument rather
than an indulgence.

**Toolchain decision: Cmajor first, JUCE at the end.** The Cmajor VST/AU plugin
JIT-compiles, so saving a source file rebuilds the patch *while Live is
playing*. JUCE's loop — compile, rescan, reload the set — is a minute or two per
idea. Develop in Cmajor, then `cmaj generate --target=juce` for a native C++
project and a real VST3/AU.

- [ ] m0: a sine that responds to MIDI, loaded in Live. Proves the toolchain end
      to end — plugin installed, patch loading, hot reload actually reloading
- [ ] m1: playable pad — osc pair + `tpt::svf` + long `FixedASR` + voice
      allocator. Settles the parameter list (parameter *lists* can't hot-reload,
      only the DSP behind them)
- [ ] m2: the grain cloud — the custom DSP, and the instrument's personality
- [ ] m3: field recordings from your own shoots as patch externals — the picture
      work feeding the music work
- [ ] m4: drift modulation + FDN diffusion tail
- [ ] m5: `cmaj generate --target=juce` → build a real VST3/AU that runs without
      the Cmajor plugin. Insurance as much as a milestone
- [ ] m6, genuinely last: a custom GUI. The auto-generated one is fine for ages

**Honest check:** Ableton's own **Granulator III** (free with Live 12 Suite +
Max for Live, by Robert Henke) beats a v1 of this on features. The reasons to
build anyway are that it's *code* — versioned, diffable, AI-editable, which is
the whole of P4 — that it plays your own field recordings, that its parameters
are ranged for film (20-second attacks, drift in cycles per minute), and that
the learning is the point. If none of those matter on a given week, use
Granulator and lose nothing.

**Not doing:** AAX. Cmajor exports VST3/AU/CLAP; Pro Tools would mean the JUCE
path plus Avid's developer program, and that's a much later, separate decision.

## Parking lot (P5 — logged as encountered)

- Long-interview selects helper (transcript-driven pull lists)
- Sound-library search that understands your own SFX/Foley collection
- Reconform diffing for doc re-edits (or just budget for Matchbox if the
  work pays for it)
