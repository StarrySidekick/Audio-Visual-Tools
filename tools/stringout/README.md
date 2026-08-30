# stringout — assistant editor in a terminal

Point it at a drive or folder of footage. It scans everything, writes a
media log, and builds a **stringout timeline** (every clip end-to-end in
shoot order, with a marker at the head of each clip) that Premiere Pro
imports directly.

## Requirements

- Python 3.9+ (no pip packages — standard library only)
- `ffprobe` on your PATH (comes with [ffmpeg](https://ffmpeg.org);
  on macOS: `brew install ffmpeg`)

## Quick start

```bash
python3 stringout.py all /Volumes/FOOTAGE_DRIVE -o ~/Desktop/MyFilm_ingest
```

That produces:

| File | What it is |
|---|---|
| `manifest.json` | Full machine-readable inventory of every media file |
| `media_log.csv` | Spreadsheet: clip, card, duration, timecode, codec, res, fps, channels |
| `stringout.xml` | FCP7 XML sequence — **File > Import** into Premiere |

In Premiere, importing `stringout.xml` gives you a sequence with all clips
laid end-to-end. Markers at each clip head are named
`clipname [CARD]` so you always know where you are while watching down.

## The individual steps

```bash
# 1. Scan a drive into a manifest (safe, read-only, parallel)
python3 stringout.py scan /Volumes/FOOTAGE_DRIVE -o manifest.json

# 2. Media log CSV from the manifest
python3 stringout.py report manifest.json -o media_log.csv

# 3. Stringout timeline from the manifest
python3 stringout.py build manifest.json -o stringout.xml --name "Doc_Watchdown_v1"
```

## How it decides things

- **Shoot order:** embedded `creation_time` (what the camera wrote), then
  embedded timecode, then filename. Files with no embedded date fall back
  to file-modified time.
- **Sequence format:** the frame rate & resolution that account for the
  most *screen time* across your footage win (NTSC-family rates like
  23.976/29.97 are detected and flagged properly). Odd clips still go in —
  Premiere conforms them.
- **Audio:** clips' first two channels are placed on A1/A2. Audio-only
  files (production sound WAVs) go on the audio tracks with a marker like
  everything else.
- **Card detection:** the first meaningful folder under the scan root
  (vendor folders like `PRIVATE/CLIP` are skipped) becomes the clip's
  "card" label in the log and markers.
- **Broken files** don't kill the run — they're listed at the end of the
  scan and flagged in the CSV's `error` column.

## Known limits (v1)

- The XML references media by absolute path from the machine that scanned —
  scan on the machine you'll edit on (or relink in Premiere).
- Interlaced/anamorphic footage gets square-pixel defaults; Premiere's
  conform usually handles it, but check.
- R3D/BRAW/ARRIRAW are inventoried if ffprobe can read them, but camera-raw
  support varies by ffmpeg build; those clips may need relinking.
- No bins/multicam yet — see the roadmap for the planned `--group-by day`
  and multicam-sync features.
