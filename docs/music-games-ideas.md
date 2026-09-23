# Music games: ideas beyond the drills

The five prototypes in [`site/`](../site/) are straight drills. These are the
stranger, more game-like ideas. Each lists the skill it actually trains,
because a whimsical wrapper is only worth building if the skill underneath is
real.

## Ear games

| Idea | The game | Trains | Notes |
|---|---|---|---|
| **Pitch Pond** | Frogs croak notes. Sing (mic) or tap the matching pitch to hop each frog onto a lily pad before the heron arrives. | Pitch matching, singing in tune | Needs mic pitch detection (autocorrelation, ~60 lines). Best "singing" game on the list. |
| **Interval Elevator** | An elevator moves only by the interval you hear. Get passengers to their floors. Floors are scale degrees. | Intervals as scale-degree movement | Teaches that intervals are *moves*, not labels. |
| **Mode Weather** | Each mode is a weather system (Lydian sun, Dorian light rain, Phrygian dust storm, Locrian fog). Hear a melody, forecast the mode. | Mode character | Uses real melodies instead of bare scales, which is harder and more musical. |
| **Wrong Note Detective** | A familiar tune plays with one note wrong. Tap the moment it goes wrong, then fix it. | Melodic memory, error detection | Public-domain tunes only (folk songs, nursery rhymes). |
| **Chord Roulette / Progression Poker** | Hear a 4-chord progression; build a "hand" from Roman numeral cards (I, IV, V, vi...) that matches it. | Functional harmony | Most useful for songwriting and Ableton work. |
| **Tuning Fork Duel** | Two tones, one slightly off. Which is sharp? The gap shrinks every round until you miss. | Fine pitch discrimination (cents) | Tiny to build. Adaptive difficulty is the whole game. |
| **Rhythm Echo** | A drum pattern plays, you tap it back. Scored on timing accuracy in milliseconds. | Rhythm, timing | Needs careful latency handling; show a "your taps vs the target" timeline. |

## Reading and keyboard games

| Idea | The game | Trains | Notes |
|---|---|---|---|
| **Staff Invaders** | Notes descend the staff like Space Invaders. Type the letter (or press the MIDI key) to zap them. Speeds up. | Sight reading speed | Natural next step from Staff Reader's sprint mode. |
| **Chord Kitchen** | Orders arrive ("one Dm7, extra 9th"). Drag note ingredients onto the staff plate and serve before the ticket expires. | Chord spelling | The theory core already spells chords correctly, so this is mostly UI. |
| **Key Signature Heist** | Crack a safe whose combination is the sharps/flats of a key. Circle of fifths is the dial. | Key signatures, circle of fifths | The dial *is* the circle of fifths, so the UI teaches the concept. |
| **Piano Tiles, but Real** | Falling notes on a staff (not colored bars). Play them on a USB MIDI keyboard. | Sight reading at the instrument | Web MIDI works in Chrome/Edge. This is the one that transfers straight to the piano. |
| **Ledger Line Limbo** | Notes get further and further off the staff. How low (or high) can you read? | Ledger lines | Small, funny, and ledger lines are where most people stall. |

## Weird ones

| Idea | The game | Trains |
|---|---|---|
| **Synesthesia Mode** | Every pitch class gets a color and shape. Learn the mapping, then the colors fade out and you keep going by ear. | Pitch memory via a crutch you remove |
| **Chord Ghosts** | A chord plays with one note missing. Which ghost note completes it? | Inner voice hearing |
| **The Overtone Garden** | Plant a fundamental; harmonics grow as flowers. Pick which flower (overtone) is blooming. | Timbre, the harmonic series (useful for mixing and synthesis) |
| **Modal Interchange Detective** | A progression in major borrows one chord from minor. Find the stranger. | Borrowed chords, songwriting color |

## Suggested order

1. **Staff Invaders** and **Tuning Fork Duel**: smallest, reuse existing code.
2. **Piano Tiles, but Real** with Web MIDI: highest transfer to actual piano.
3. **Pitch Pond**: the first singing game; unlocks sight-singing practice.
4. **Chord Kitchen** and **Progression Poker**: harmony for writing music.
