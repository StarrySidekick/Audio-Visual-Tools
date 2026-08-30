# Scope — `autosync`: syncing sound to picture with nothing to go on

**Status:** scoping only. Nothing built yet.
**Problem:** [P6 in workflow-problems.md](workflow-problems.md#p6--sync-when-theres-nothing-to-sync-to)

The pitch, in one line: point it at a drive, and every camera clip comes back
paired to the right sound roll at the right offset — no slate, no timecode, no
file-naming discipline required.

---

## 1. What the tool actually has to solve

Two separate jobs get called "syncing," and only one of them is hard.

| Job | Question | Difficulty |
|---|---|---|
| **Pairing** | *Which* audio file goes with this video clip? | The hard part when nothing's labeled |
| **Alignment** | *Where* does it go — offset to the sample? | Well-solved math, if pairing is right |

Every off-the-shelf tool assumes you've already done the pairing (you select
the clips, you group the bin, you trust the timecode). The pairing is exactly
what falls apart on a doc shoot: a 90-minute recorder roll that spans nine
camera clips, a B-cam nobody labeled, a recorder whose TC drifted or was never
jam-synced, files named `MVI_0413.MOV` and `ZOOM0007.WAV`.

### The insight this whole tool rests on

**Cameras record scratch audio, and scratch audio is a fingerprint of the
room.** It sounds terrible — AGC pumping, wind, a built-in mic 20 feet from
the subject — but it is *the same acoustic event* as the boom and the lav. So
the video-to-audio problem reduces to an audio-to-audio problem, which is
tractable, metadata-free, and doesn't care what anything is named.

That reduction is the magic. Everything below is engineering around it.

### The five real-world cases

1. **One camera, one recorder, both rolling continuously** — easy; establishes
   the baseline.
2. **One long recorder roll, many camera clips** — one-to-many. The common doc
   case, and the one native tools handle worst.
3. **Multiple cameras + multiple mics** — nothing may directly correlate
   camera A to camera B (different scratch mics, different noise), but both
   correlate to the recorder. Needs a graph solve, not pairwise matching.
4. **Long takes with clock drift** — an hour-long interview, camera and
   recorder clocks differing by ~100 ppm, means ~3.6 s of slip by the end. One
   offset number is *wrong* here; the answer is a line, not a point.
5. **MOS / no usable scratch audio at all** — the honest failure case. Falls
   back to weaker signals (visual, metadata) and must say so out loud.

---

## 2. What already exists (verified Aug 2026)

| Tool | What it does | Where it stops | Price |
|---|---|---|---|
| **Premiere `Synchronize` / Merge Clips** | Waveform-sync clips you've already selected and grouped | You do the pairing; struggles on long clips and quiet scratch audio; no drift handling | Included |
| **DaVinci Resolve `Auto Sync Audio` (by waveform)** | Same, in the Media Pool | Needs loud-enough camera audio and overlapping content; fails silently-ish on long-take drift | Free/$295 |
| **Avid AutoSync** | Timecode-based | Requires the timecode we're assuming is wrong | Included |
| **PluralEyes (Maxon/Red Giant)** | *The* original waveform auto-sync — did do the pairing | **Limited maintenance mode since Feb 2023**, no new development | Legacy |
| **Syncaila 3.0.5** (Aug 2026) | Fully automatic multi-cam/multi-recorder sync, no TC needed — closest commercial fit | Free tier caps at 20 clips / 2 tracks; GUI app, not scriptable; a black box you can't read a confidence number out of | Free tier · **$100 one-time** |
| `bbc/audio-offset-finder` | MFCC cross-correlation, two files → offset + a "standard score" | Pairwise only, ~0.01 s accuracy, no drift, no video awareness | Free (Python) |
| `benfmiller/audalign` | Fingerprint + correlation + spectrogram alignment of many recordings | Library, not a post workflow; no NLE output, no drift model | Free (Python) |
| `ffmpeg -filter_complex axcorrelate` | Correlation of two audio streams | Short-lag only — not an offset *search* across hours | Free |

**Takeaway:** Syncaila at $100 is the honest "buy before build" answer for the
plain case, and it should get tried first on real footage. The gaps our own
tool would fill are specific:

- **A machine-readable answer.** A CSV/JSON sync report with a confidence
  number per pair, not a GUI you have to eyeball and export from.
- **Drift as a first-class output** — ppm slope per pair, not one offset that's
  correct only in the middle of the take.
- **Graph-consistent multicam** — cameras aligned to each other *through* the
  sound roll, with cycle-consistency as a built-in error check.
- **It plugs into the drive scan we already do.** `stringout` has already
  probed every file; sync should reuse that manifest, not rescan.
- **Ambiguity reported, not resolved.** Three plausible offsets is an answer.

---

## 3. Proposed architecture

Deliberately a pyramid: cheap and linear at the bottom, expensive and exact at
the top, and nothing expensive runs on a pair the cheap stage already rejected.

```
manifest.json (from stringout scan)
        │
   [0] decode + cache        ffmpeg → mono 8 kHz PCM per file, cached on disk
        │
   [1] priors                creation_time / BWF bext / TC / duration
        │                    → widen or narrow the search window (never gate)
        │
   [2] coarse pairing        landmark fingerprints + mel-envelope correlation
        │                    → candidate pairs + rough offsets, O(total hours)
        │
   [3] fine alignment        GCC-PHAT around the candidate, parabolic peak
        │                    → offset to the sample
        │
   [4] drift fit             offsets across N windows → line fit → ppm slope
        │
   [5] graph solve           all pairs → connected components → global
        │                    positions, cycle-consistency check
        │
   [6] outputs               sync-report.csv/json + FCP7 XML sequences
```

### [0] Decode and cache

Everything downstream works on mono PCM, not on the original files. One
`ffmpeg` pass per file to 8 kHz mono (16 kHz for the fine stage), cached in
`.autosync-cache/` keyed by path + size + mtime. A 3-hour roll is ~57 MB at
8 kHz int16 — cheap, and it means re-runs and parameter tweaks are instant.

Decoding is the slowest part of the whole pipeline; it happens once.

### [1] Metadata as priors, never as gates

Read what's there — `creation_time`, filesystem mtime, embedded timecode, BWF
`bext` TimeReference/OriginationDate on the WAVs — and use it only to *order*
the candidate search so the right answer is found first. Never to exclude a
pair. The entire premise is that this metadata is unreliable; a tool that
trusts it inherits the problem it exists to solve. A wrong camera clock just
means a wider search, not a wrong answer.

### [2] Coarse pairing — the part that makes it "magic"

Two complementary methods, because they fail differently:

- **Landmark fingerprinting** (Shazam-style spectrogram peak pairs, hashed).
  Build a hash table over all audio once, then look up each clip. Matching
  hashes vote into offset bins; a tall spike in one bin is a match. Linear in
  total audio duration, amplitude-invariant, and robust to a camera mic
  sounding nothing like a boom. This is what makes a 200-clip drive tractable.
- **Mel-band energy envelope correlation** (FFT-based, ~100 Hz frame rate,
  band-limited to roughly 200 Hz–4 kHz where a scratch mic and a lav actually
  share content). Catches cases where landmarks are too sparse — quiet rooms,
  heavy wind, mushy compressed camera audio. This is the `audio-offset-finder`
  approach, and it's a good second opinion rather than a primary.

Run fingerprinting first, fall back to envelope correlation for clips that
come back empty or ambiguous.

### [3] Fine alignment — GCC-PHAT

Within ±1 s of the coarse hit, generalized cross-correlation with phase
transform on the raw waveforms. PHAT whitens the magnitude spectrum and keeps
only phase, which is precisely the right property here: camera scratch and
boom have wildly different frequency response but identical *timing*. Parabolic
interpolation on the correlation peak gets sub-sample precision, well past the
~0.01 s that MFCC-based methods deliver.

### [4] Drift — the differentiator

Don't compute one offset. Compute the offset in a window (say 20 s) every
60 s across the overlap, then least-squares fit `offset(t) = a + b·t`:

- `a` is the offset at the head — what everyone else reports.
- `b` is **clock skew in ppm** — the number nobody reports, and the reason a
  60-minute interview that starts in sync ends 3.6 seconds out.
- Windows that don't fit the line are the interesting failures: a recorder that
  stopped and restarted, a clip that spans a cut, or a false match.

Output the slope in the report, plus an optional `--drift-recipe` that prints
the exact `ffmpeg` resample (`asetrate`/`atempo`) or the Premiere speed
percentage to correct it. Per the repo's principles, **don't render corrected
media by default** — report the number, let the ear and the editor decide.

### [5] Graph solve — real multicam

Every file is a node; every confident alignment is an edge weighted by
confidence. Then:

- **Connected components** = shoot sessions. Each one gets its own common
  timeline, which is exactly what you want to hand to Premiere.
- **Global positions** via maximum-confidence spanning tree, refined by least
  squares over all edges. Camera A and camera B land on one timeline via the
  recorder even if they never correlate directly.
- **Cycle consistency** is a free correctness check: offsets around any loop
  (A→B→C→A) must sum to zero. They don't? One of those edges is a false match,
  and the tool can say which one is the odd man out instead of shipping a
  confident lie.

### [6] Outputs

- **`sync-report.csv` / `.json`** — one row per pair: video, audio, offset in
  seconds *and* frames *and* samples, overlap duration, confidence 0–1, method
  used, drift ppm, and a `review` flag with a one-line reason.
- **FCP7 XML per sync group** — video on V1, each matched audio source on
  A1..An with the offsets baked in. Imports straight into Premiere (and
  Resolve), where you eyeball it, then select the tracks and make a multicam
  source sequence with the built-in command. Same output format `stringout`
  already emits, so the XML writer is largely shared code.
- **`review/` list** — for anything below threshold, the top 3 candidates with
  their offsets and scores, so a questionable clip is a 10-second arrow-key
  decision rather than a hunt.

---

## 4. Confidence, and why it's the whole product

An auto-sync tool that's right 97% of the time and silent about which 3% is
*worse than useless* on a feature-length doc — you have to check all of it
anyway. The deliverable is not the offset. The deliverable is **the offset plus
a number you can threshold on**, so the review pass is 8 clips instead of 200.

Score built from four independent signals:

1. **Peak-to-sidelobe ratio** of the correlation — how much taller the winner
   is than the runner-up. Detects genuine ambiguity.
2. **Window agreement** — do the per-window offsets in stage [4] fit a line, or
   scatter?
3. **Cycle consistency** from the graph in stage [5].
4. **Metadata agreement** — if a timecode or creation time *does* exist and
   the audio answer agrees with it, that's corroboration from an independent
   source. (Disagreement is not a penalty. The metadata is the suspect here.)

Each pair gets a score and a plain-English reason: `"strong (PSR 14.2, 6/6
windows agree, TC agrees ±2f)"` or `"ambiguous — 3 candidates within 8% at
+412.3s / +698.1s / +1205.7s, likely a repeated take"`.

---

## 5. Known failure modes (design for them up front)

| Failure | Why | Handling |
|---|---|---|
| **Repeated takes** — the same line, the same song played five times | Genuinely ambiguous; multiple real correlation peaks. The classic false-match trap, and it's *guaranteed* in music sessions | Detect multiple peaks, refuse to pick, report all candidates. Metadata priors break the tie when present |
| **Camera AGC pumping** | Auto gain destroys the amplitude envelope | Fingerprinting (amplitude-invariant) carries it; envelope correlation degrades |
| **No overlap at all** | Camera rolled during a recorder stop | Must report "no match" confidently, not force a low-confidence pair |
| **Long silences in the roll** | Nothing to correlate | Detect and skip silent windows in drift fitting |
| **MOS / no audio track** | Nothing to reduce to | Tier-3 fallbacks (§6), clearly marked lower-confidence |
| **Mixed frame rates** | 23.976 vs 29.97 vs 25 in one drive | Work in seconds internally; convert to frames only at output, per sequence |

---

## 6. Fallbacks when there's no shared audio

Ranked, and each one flagged in the report as what it is:

1. **Visual flash/transient** — a slate clap, a strobe, lights snapping on:
   frame-level luminance spikes correlated between two camera clips.
2. **Motion signature** — global frame-difference energy over time, correlated
   between two cameras pointed at the same scene. Coarse (frame accuracy at
   best), but it beats nothing.
3. **Metadata-only** — creation times and durations, laid out in time order.
   Not sync. It's a starting position for a manual nudge, and should say so.
4. **Transcript alignment** (later, if it ever comes up) — Whisper both
   sources, align the text. Absurdly heavy, but nearly bulletproof for long
   interviews where the two recordings sound nothing alike. Parked.

---

## 7. Build phases

**v0 — the spike (half a day).** Two files in, one offset out. GCC-PHAT plus
envelope correlation, run against *real footage from the drive* — including a
known-bad case. This is the go/no-go: if pairing accuracy on actual doc
material isn't there, buy Syncaila and stop.

**v1 — the useful tool.** Many-to-many pairing over a `stringout` manifest,
fingerprint pruning, sync report (CSV/JSON) with confidence, FCP7 XML per sync
group, review list. This is the version that saves an afternoon.

**v2 — drift + graph.** Per-window drift fitting with ppm output and correction
recipes; graph solve for multicam with cycle-consistency checking.

**v3 — the hard cases.** MOS/visual fallbacks, transcript alignment, whatever
the real footage proves is actually needed.

---

## 8. Open decisions

- **numpy.** `stringout` is proudly stdlib-only. This tool can't be — it's FFTs
  over hours of audio, and pure-Python is orders of magnitude too slow.
  Proposal: **numpy only** (its `np.fft` is enough; skip scipy by writing our
  own peak-picking) and ffmpeg via subprocess as usual. One dependency, one
  `pip install numpy`. Flagging it because it breaks a stated principle.
- **Where sync lives.** Its own `tools/autosync/`, consuming
  `stringout-manifest/1` — or a `stringout sync` subcommand? Leaning separate
  tool, shared manifest schema, shared XML writer, so neither one bloats.
- **Try Syncaila first?** $100, and if it nails the actual footage the build
  drops to v0-only ("does it agree with Syncaila?") or gets shelved entirely.
  Consistent with the repo's buy-before-build principle, and worth doing before
  writing v1.
- **What the drive actually looks like.** The design assumes camera scratch
  audio exists on essentially everything. If a meaningful share of the footage
  is MOS, §6 stops being a footnote and becomes the main event — worth checking
  against a real drive before committing to phases.
