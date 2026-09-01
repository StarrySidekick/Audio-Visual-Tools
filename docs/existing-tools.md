# Existing tools — what's already solved (verified Aug 2026)

Before building anything, here's the landscape. Prices verified against
vendor sites at time of writing. **Bold** = notably good value for our
problems.

## 1. Footage ingest / stringout (Premiere)

| Tool | What it does | Price / status |
|---|---|---|
| **Premiere built-in: Automate to Sequence** | Sort a bin by timecode → Select All → Automate to Sequence = a free "watch everything" reel | Free (built in) |
| **Cauldron** (Knights of the Editing Table) | Auto-builds sequences from batches of clips — closest paid auto-stringout | **$25** one-time |
| Watchtower (KOTET) | Auto-syncs Premiere bins with folders on disk | $40 one-time |
| Excalibur (KOTET) | Command palette / macros for Premiere | $120 one-time |
| Kyno (Signiant) | Browse/tag/transcode a drive, "Send to Premiere"; v1.9 (2025) still maintained | $159–349/yr |
| Post Haste (Digital Rebellion) | Project/folder templates per job | Free |
| BRAW Studio (Autokroma) | Blackmagic RAW import into Premiere | Free tier + paid |
| TimeBolt / AutoCut / Recut | Silence removal / auto rough-cut (jump-cut style content, not doc watchdowns) | $97/yr · ~$15/mo · ~$99 once |
| Adobe Prelude | Adobe's old ingest/logging app | **Discontinued 2021** |

**Takeaway:** Premiere's own Automate to Sequence covers the last step for
free, and Cauldron is $25 — but neither does the *drive-level* work:
scanning card structures, building a media log, flagging problems, ordering
by real shoot time across cameras + sound recorder. That's the gap
`tools/stringout` fills, and it feeds Premiere's free built-ins.

## 2. AAF → Pro Tools turnover

| Tool | What it does | Price / status |
|---|---|---|
| **EdiLoad** (Sounds In Sync) | *The* industry AAF-prep tool: splits AAFs, renames/reorders tracks, builds PT-ready dialogue sessions | ~$545 (rental & rent-to-own available) |
| Matchbox 2 (The Cargo Cult) | Change lists / reconform between picture versions; integrated into PT 2025.6 | $699 |
| Conformalizer | Old reconform standard | **Discontinued** |
| AATranslator | Converts session formats between DAWs/NLEs | ~$199, Windows-only, aging |
| Pro Tools built-in | 2024.6+: direct Media Composer↔PT interchange; 2025.6: ADR + reconform workflows, Matchbox integration. Premiere→PT is still AAF | Included |
| iZotope RX 11 | Batch processing = module chains in the standalone editor. **No headless/CLI API** — automation is done via SoundFlow driving the app, or RX Connect from PT | ~$299 Std / ~$599 Adv |

**Takeaway:** EdiLoad is the professional answer but it's a $545 hammer.
There's real room for our own *pre-flight analyzer*: read the AAF (Python
`pyaaf2` is free), report track/clip layout, and scan the audio itself for
hum/hiss/clipping so the RX passes start with a map instead of a hunt.
That analysis tool doesn't exist off the shelf at any price.

## 3. Chord / theory tools for Ableton

| Tool | What it does | Price / status |
|---|---|---|
| **Ableton Live 12 built-ins** | Scale-aware clips; MIDI Generators (Stacks = progressions by scale degree; Seed; Rhythm); MIDI Transformations; scale-following Chord/Arp devices | Included in Live 12 |
| **Ripchord** (Trackbout) | Free chord-trigger/progression VST3, importable preset packs | **Free** |
| **Suggester 2** (Mathieu Routhier) | The app you already use — **has a macOS desktop version usable as an AUv3 plugin in DAWs** | Free + IAP |
| Scaler 3 | Full theory workstation (detection, arranger) | $99 |
| Captain Plugins Epic 7 | Chord/melody/bass composition suite (ex-Captain Chords) | $99 |

**Takeaway:** Two immediate wins that cost nothing: (1) Suggester's macOS
AUv3 can sit *inside* Live — the app-switching problem may already be
solved; (2) Live 12's Stacks generator does scale-degree progressions
natively. Ripchord (free) covers chord triggering. Build custom only for
what these can't do — e.g. generating progression MIDI from code/Claude
sessions, or theory tools with your personal taste baked in.

## 4. Code-first plugin/synth frameworks (the Max for Live alternative)

Ableton loads **VST3/AU**. Pro Tools loads **AAX only** — AAX needs Avid's
(free but NDA'd) developer program + PACE signing.

| Framework | Language | Exports | Price | Notes |
|---|---|---|---|---|
| **JUCE 9** | C++ | VST3/AU/**AAX**/CLAP | Free tier (rev-capped) / AGPL | Industry standard, best docs — best AI-assisted path |
| Cmajor | Cmajor DSL | VST3/AU (JUCE wrapper) | Free, open-source | Fast iteration (JIT), by JUCE's creator; no AAX |
| FAUST | FAUST DSL | VST/AU via generators | Free | Academic pedigree, terse DSP language |
| RNBO (Cycling '74) | Max patching | VST3/AU | ~$299 + Max license | Still Max-flavored — what we're avoiding |
| iPlug2 | C++ | VST3/AU/**AAX**/CLAP | Free | Liberal license, lighter than JUCE |
| nih-plug | Rust | VST3/CLAP | Free | Great DX; fine for Ableton, no Pro Tools |
| Elementary Audio | JS/TS | Web/DIY native | Open-source | Prototyping, not shipping plugins |

**Takeaway (revised):** **Cmajor first, JUCE at the end.** The earlier read had
these the other way round, on the strength of JUCE being the industry standard —
which it is. But the deciding factor for a personal instrument is the iteration
loop, and they aren't close. The Cmajor VST/AU plugin JIT-compiles, so re-saving
a source file rebuilds and reloads the patch *while Live is still playing*;
JUCE's loop is compile → Ableton rescans → reload the set → your patch resets,
a minute or two per idea. So: develop in Cmajor, then `cmaj generate
--target=juce` for a native C++ project that builds VST3/AU (and CLAP). Cmajor
is the workbench, JUCE the delivery truck — and the exported C++ is what
survives if Cmajor (~740 stars, small team, infrequent releases) ever stops.
JUCE 9 shipped July 2026, same licensing as 8. Note Cmajor exports no AAX.

## 6. Granular / texture instruments (the buy-before-build check for `silt`)

| Tool | What it does | Price / status |
|---|---|---|
| **Granulator III** (Robert Henke / Ableton) | Granular instrument for Live 12: two granular playback modes, MPE modulation of grain size/shape/position, real-time audio capture | **Free** — needs Live 12 Suite + Max for Live |
| Live 12 built-ins | Drift, Meld, Hybrid Reverb, Spectral devices | Included |
| Output Portal / Arturia Efx Fragments | Granular effects processors | ~$99–149 |

**Takeaway:** on features, Granulator III beats anything we'd write as a v1, and
it costs nothing. Building [`silt`](silt-scope.md) is justified by different
things: it's *code* (versioned, diffable, editable from a terminal — the whole
of P4), it plays your own field recordings as patch externals, its parameters
are ranged for scoring rather than for beats, and the learning is the product.
Not by beating Henke at granular synthesis.

## 5. Dual-system / multicam sync (no timecode, no slate)

| Tool | What it does | Price / status |
|---|---|---|
| **Premiere `Create Multi-Camera Source Sequences`** (sync point: Audio) | **Batch-pairs a whole bin of camera clips + separate production audio by waveform** — no pre-grouping, no timecode. The closest thing to one-button that exists, and it is already installed | Included |
| **Syncaila 3.0.5** (Aug 2026) | Automatic multi-camera + multi-recorder sync with no timecode needed — but a round trip: build a sequence with one track per source device, export FCP7 XML, sync, re-import (Premiere may create duplicate clips) | Free up to 20 clips / 2 tracks · **$100** one-time |
| Premiere `Synchronize` / Merge Clips | Waveform-syncs clips you have already selected and grouped | Included |
| DaVinci Resolve `Auto Sync Audio` (by waveform) | Same, in the Media Pool; needs loud-enough camera audio and real overlap | Included |
| Avid AutoSync | Timecode-based | Included |
| PluralEyes (Maxon/Red Giant) | The original waveform auto-sync — it *did* do the pairing | **Limited maintenance mode since Feb 2023** |
| `bbc/audio-offset-finder` | MFCC cross-correlation, two files → offset + prominence score (~0.01 s) | Free (Python) |
| `benfmiller/audalign` | Fingerprint / correlation / spectrogram alignment of many recordings | Free (Python) |
| `ffmpeg -filter_complex axcorrelate` | Correlates two audio streams | Free — short-lag only, not an offset search |

**Takeaway:** the one-button workflow already ships free inside Premiere —
`Create Multi-Camera Source Sequences` with Synchronize Point: Audio batch-pairs
camera clips to production sound by waveform, no grouping or timecode required.
That, not Syncaila, is the thing any build here has to beat. What it doesn't do
is tell you when it failed: unsynced clips are quietly left out of the Processed
Clips bin with no reason and no confidence number, nothing fits clock drift over
a long take, and Adobe's own guidance is not to throw a whole day at it at once.
So the remaining gap is narrow and specific — a machine-readable sync report with
per-pair confidence, drift in ppm, and graph-consistent multicam, fed by the
drive scan `stringout` already does. **Measure the built-in's failure rate on
real footage before building any of it.** See
[`autosync-scope.md`](autosync-scope.md).
