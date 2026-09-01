# Scope — `silt`: a texture instrument you can vibe code

**Status:** scoping only. Nothing built yet.
**Problem:** [P4 in workflow-problems.md](workflow-problems.md#p4--a-synthesizer-developed-as-code-not-patched-in-max)
**Working name:** *Silt* — sediment, murk, things settling. Rename it in one commit if
something better turns up.

A drone-and-texture instrument for scoring picture: hold a chord, get a bed that
moves on its own for three minutes. Written as code, versioned in git, and — the
part that decides the whole toolchain — **editable while Ableton is playing**.

---

## 1. Be honest about why this gets built

Ableton ships **Granulator III** free (Live 12 Suite + Max for Live), by Robert
Henke, with two granular playback modes, MPE modulation of grain size/shape/
position, and real-time audio capture. On features, a v1 written from scratch
does not beat it, and pretending otherwise would be the exact thing this repo's
principles warn against.

So the case for building has to be something else, and it is:

1. **It's code.** Versioned, diffable, editable by an AI assistant in a terminal
   — which is the whole point of P4. Granulator III is a Max patch; using it is
   great, *developing* in it is what we're trying to get away from.
2. **It plays your own material.** The source samples are field recordings and
   room tone from your own shoots, declared as patch externals and versioned
   alongside the DSP. The picture work feeds the music work. No off-the-shelf
   instrument can be that.
3. **It's ranged for film, not for beats.** Attack up to 20 seconds. Drift rates
   in cycles per *minute*. Release tails that outlast the scene. Most granular
   tools are built for rhythmic effect and their parameter ranges say so.
4. **The learning is the product.** By the end you know how a synth actually
   works, and the next one is easier.

If none of those four matter on a given week, use Granulator III and lose
nothing. That's a real answer, not a hedge.

---

## 2. The toolchain — and why it isn't JUCE yet

"Something I can vibe code" rules the decision, because the two candidates have
opposite iteration loops.

| | Cmajor | JUCE C++ |
|---|---|---|
| Edit → hear | **Save the file. The sound changes while Live keeps playing.** | Compile → Ableton rescans the plugin → reload the set → your patch resets |
| Realistic cycle | seconds | a minute or two |
| Language | small DSP-specific language | C++, industry standard |
| Ships as | export to JUCE, then VST3/AU/CLAP | VST3/AU/AAX directly |
| Risk | niche language, small team | none, it's the standard |

The Cmajor VST/AU plugin runs a JIT compiler, so re-saving any source file in a
loaded patch triggers an automatic rebuild and reload — no DAW restart, no
rescan. That is the vibe-coding loop, and nothing in the C++ world matches it.

**The strategy is to use both, in order:** develop in Cmajor where iteration is
free, then run `cmaj generate --target=juce` to get a native C++ JUCE project
and build a real VST3/AU from that. Cmajor is the workbench. JUCE is the
delivery truck.

### The loop, concretely

```
cmaj create --name="Silt" tools/silt      # scaffold a patch folder
                                          # (.cmajorpatch manifest + .cmajor source)

# in Ableton: Cmajor plugin on a track, drag the .cmajorpatch onto it
# then, forever after:
#   edit tools/silt/silt.cmajor  →  save  →  it recompiles under your fingers

cmaj play tools/silt                      # standalone, no DAW, when Live is in the way
cmaj generate --target=juce ...           # when it's worth shipping
```

### Three things to know before starting

- **Parameter lists can't change on the fly.** VST/AU were designed for static
  plugins, so adding or removing a parameter needs a plugin reload — only the
  *DSP behind* the existing parameters hot-reloads. Practical consequence:
  settle the parameter list early (§4), then vibe on the guts inside it.
- **Cmajor is niche.** ~740 stars, a small team, commits running through mid-2026
  but infrequent binary releases. Mitigation is structural, not hopeful: the
  exported JUCE project is plain C++ that outlives the language, and the whole
  instrument is a few hundred lines — hand-porting it would be a bad weekend,
  not a catastrophe.
- **I will be less fluent in Cmajor than in C++.** Far less of it exists in the
  world to have learned from. Expect me to lean on the shipped `examples/`
  patches and the language reference, and expect to write small and verify by
  ear more often than usual. That's the real cost of the fast loop.

---

## 3. The instrument

Polyphonic (8 voices), but tuned so that "polyphonic" means *held chords that
bloom*, not fast passages.

```
MIDI ──► std::voices::VoiceAllocator
             │
             ├─► voice ×8 ─────────────────────────────────────┐
             │      source        osc pair + pink noise        │
             │                    ⇅ blend ⇅                    │
             │                    SamplePlayer (your field rec)│
             │        │                                        │
             │        ▼                                        │
             │      GRAIN CLOUD    8 overlapping readers,       │
             │                     randomized position / pitch  │
             │                     / pan, cosine-windowed       │
             │        │                                        │
             │        ▼                                        │
             │      tpt::svf lowpass ← drift                    │
             │        │                                        │
             │        ▼                                        │
             │      FixedASR  (attack + release measured in seconds)
             │                                                 │
             └─────────────────────► sum ◄─────────────────────┘
                                      │
                                      ▼
                            DIFFUSION  4–8 line FDN, long tail
                                      │
                                      ▼
                            drift LFOs + random walk
                            (modulating everything above,
                             in cycles per minute)
```

**What the standard library gives us for free** — so the only code worth writing
is the code with personality:

| Need | Cmajor stdlib |
|---|---|
| Voice management | `std::voices::VoiceAllocator`, `std::notes` |
| Oscillators | `std::oscillators::PolyblepOscillator`, `Sine`, `LFO` |
| Noise bed | `std::noise::Pink` / `Brown` |
| Filter | `std::filters::tpt::svf` |
| Envelope | `std::envelopes::FixedASR` |
| Sample playback | `std::audio_data::SamplePlayer` |
| Randomness | `std::random::RNG` |
| Parameter smoothing | `std::smoothing::SmoothedValue` |
| Gain / dB | `std::levels::SmoothedGain`, `dBtoGain` |

**What we actually write:** the grain cloud and the diffusion tail. There is no
`std::granular`, which is exactly right — that's the part that makes it *this*
instrument and not a tutorial. A grain reader is a circular buffer, a read
pointer, a raised-cosine window, and a random number; eight of them overlapping
is a texture.

---

## 4. Parameters (settle these first)

Annotated in the source, so the Cmajor plugin builds a working GUI for free and
Ableton sees them as automatable. Thirteen is plenty — resist adding more until
the DSP is right.

| Parameter | Range | Why this range |
|---|---|---|
| `sourceBlend` | osc ↔ sample | one knob, not a mode switch |
| `grainSize` | 20 ms – 2 s | past ~500 ms it stops being granular and starts being a chorus of ghosts, which is the good part |
| `grainDensity` | 1 – 40 /s | |
| `position` | 0 – 1 | where in the sample the cloud is reading |
| `positionJitter` | 0 – 1 | smear vs. lock |
| `pitchJitter` | 0 – 12 st | |
| `cutoff` | 40 Hz – 18 kHz | |
| `cutoffDrift` | 0 – 1 | how much the drift engine moves the filter |
| `attack` | 0 – 20 s | **film ranges, not synth ranges** |
| `release` | 0 – 30 s | tails that outlast the scene |
| `diffusion` | 0 – 1 | size + feedback of the tail, on one control |
| `driftRate` | 0.5 – 60 cycles/min | slow enough to be unnoticeable, which is the point |
| `level` | −60 – +6 dB | |

---

## 5. Milestones

Each one ends with something you can hear, which is the only honest unit of
progress for an instrument.

**m0 — hello, tone (~1 hour).** A patch that loads in Live and makes a sine when
you press a key. Nothing musical; it proves the whole chain — plugin installed,
patch loading, MIDI arriving, hot reload actually reloading. Do not skip it, and
do not build anything else until saving the file audibly changes the sound.

**m1 — a playable pad.** Osc pair + noise, `tpt::svf`, `FixedASR` with long
times, `VoiceAllocator`. Not distinctive yet, but genuinely usable in a cue, and
it establishes the parameter list from §4 so hot reload stops being interrupted
by plugin reloads.

**m2 — the grain cloud.** The real work and the actual personality. Expect this
to be most of the project, and expect the first version to sound wrong in an
interesting way.

**m3 — your own material.** `SamplePlayer` reading field recordings declared as
externals in the `.cmajorpatch`. The moment it stops being a synth and starts
being *yours*.

**m4 — drift and diffusion.** The FDN tail and the slow modulation web. This is
what makes it move on its own for three minutes.

**m5 — make it real.** `cmaj generate --target=juce`, build the VST3/AU, load it
in Live *without* the Cmajor plugin. Now it's an instrument, not a patch.

**m6 — optional, and genuinely last.** A custom HTML/JS GUI. The auto-generated
one from the parameter annotations is fine for a very long time, and time spent
on a GUI early is time not spent on the sound.

---

## 6. Non-goals

- **Not a product.** No presets browser, no installer, no support burden.
- **No GUI before m6.** See above.
- **Not competing with Granulator III.** If a cue needs what Granulator does
  better, use Granulator.
- **No AAX.** Cmajor exports VST3/AU/CLAP. Pro Tools would mean the JUCE path
  plus Avid's developer program — a separate decision, much later, and probably
  never.

---

## 7. Open decisions

- **The name.** *Silt* is a placeholder chosen in ten seconds. An instrument you
  keep deserves a name you like.
- **Voice count vs. grain count.** 8 voices × 8 grains is 64 readers. Might be
  fine, might be silly on a laptop while Live is also playing 40 tracks — worth
  measuring at m2 rather than guessing now. The knob that gives way first should
  be voice count.
- **Where the field recordings live.** Externals versioned in the repo (simple,
  but binaries in git) or referenced from a folder on disk (clean repo, breakable
  patch)? Leaning: a couple of small committed samples so the patch always works,
  with a path override for the big personal library.
- **Whether m5 ever happens.** Running the patch inside the Cmajor plugin forever
  is a legitimate end state for a personal instrument. The JUCE export matters
  the day you want it on someone else's machine, or the day Cmajor stops being
  maintained — so it's insurance, not a milestone to rush.
