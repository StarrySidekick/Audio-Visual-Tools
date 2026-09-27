// Harmony in a key: Roman numerals, voice leading, and generators for
// progressions and simple melodies. Pure functions, tested in Node.

import {
  CHORDS, parseNoteName, spellToken, spelledName, spelledToMidi,
  pitchClass, pick, mod,
} from './theory.js';

// Major keys with up to three sharps or flats, so key signatures stay readable.
export const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'];
const MAJOR_FORMULA = ['1', '2', '3', '4', '5', '6', '7'];

// Roman numerals relative to a major key. Uppercase = major chord,
// lowercase = minor, ° = diminished. The ♭ ones are "borrowed" from the
// parallel minor key (C minor's chords used inside C major).
export const NUMERALS = [
  { id: 'I', root: '1', quality: 'maj', fn: 'tonic' },
  { id: 'ii', root: '2', quality: 'min', fn: 'subdominant' },
  { id: 'iii', root: '3', quality: 'min', fn: 'tonic' },
  { id: 'IV', root: '4', quality: 'maj', fn: 'subdominant' },
  { id: 'V', root: '5', quality: 'maj', fn: 'dominant' },
  { id: 'vi', root: '6', quality: 'min', fn: 'tonic' },
  { id: 'vii°', root: '7', quality: 'dim', fn: 'dominant' },
  { id: '♭III', root: 'b3', quality: 'maj', fn: 'borrowed' },
  { id: 'iv', root: '4', quality: 'min', fn: 'borrowed' },
  { id: '♭VI', root: 'b6', quality: 'maj', fn: 'borrowed' },
  { id: '♭VII', root: 'b7', quality: 'maj', fn: 'borrowed' },
];

export const FUNCTION_TEXT = {
  tonic: 'tonic (home)',
  subdominant: 'subdominant (moving away)',
  dominant: 'dominant (tension, wants home)',
  borrowed: 'borrowed from the parallel minor',
};

export const DIATONIC = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

// Where each chord tends to go in common-practice and pop harmony. This is
// the "tonic -> subdominant -> dominant -> tonic" cycle written as a table.
export const TRANSITIONS = {
  'I': ['ii', 'iii', 'IV', 'V', 'vi', '♭VII', '♭VI', 'iv', '♭III'],
  'ii': ['V', 'vii°', 'IV', 'I'],
  'iii': ['vi', 'IV', 'ii'],
  'IV': ['V', 'I', 'ii', 'vii°', 'iv', 'vi'],
  'V': ['I', 'vi', 'IV'],
  'vi': ['ii', 'IV', 'V', 'iii'],
  'vii°': ['I', 'iii'],
  '♭III': ['IV', '♭VI', '♭VII'],
  'iv': ['I', 'V'],
  '♭VI': ['♭VII', 'V', 'IV'],
  '♭VII': ['I', 'IV'],
};

const byId = (id) => NUMERALS.find((n) => n.id === id);
const chordDef = (quality) => CHORDS.find((c) => c.id === quality);

// A concrete chord: spelled root and notes, pitch classes, printable name.
export function makeChord(root, quality) {
  const def = chordDef(quality);
  const notes = def.formula.map((t) => spellToken(root, t));
  return {
    quality,
    root,
    name: spelledName(root) + def.symbol,
    notes: notes.map((n) => spelledName(n)),
    pcs: notes.map((n) => pitchClass(spelledToMidi({ ...n, octave: 4 }))),
  };
}

export function chordInKey(keyName, numeralId) {
  const n = byId(numeralId);
  const root = spellToken(parseNoteName(keyName), n.root);
  return { ...makeChord(root, n.quality), numeral: n.id, fn: n.fn };
}

export function chordFromRoot(rootName, quality) {
  return makeChord(parseNoteName(rootName), quality);
}

export function keyLabel(keyName) {
  return spelledName(parseNoteName(keyName)) + ' major';
}

// Pitch classes of the key's major scale, index = scale degree - 1.
export function scalePcs(keyName) {
  const k = parseNoteName(keyName);
  return MAJOR_FORMULA.map((t) => pitchClass(spelledToMidi({ ...spellToken(k, t), octave: 4 })));
}

// Spell a MIDI note that belongs to the key (with the key's accidentals).
export function spellInKey(midi, keyName) {
  const k = parseNoteName(keyName);
  const t = MAJOR_FORMULA.find((tok) => pitchClass(spelledToMidi({ ...spellToken(k, tok), octave: 4 })) === pitchClass(midi));
  if (!t) throw new Error(`${midi} is not in ${keyName} major`);
  const sp = spellToken(k, t);
  const natural = spelledToMidi({ letter: sp.letter, acc: 0, octave: 4 }) - 60 + sp.acc;
  return { ...sp, octave: Math.floor((midi - natural) / 12) - 1 };
}

// Key signature: how many sharps (+) or flats (-).
export function keySignature(keyName) {
  const sharps = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6 };
  const flats = { F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6 };
  return keyName in sharps ? sharps[keyName] : -flats[keyName];
}

// ---------- Voice leading ----------
//
// Pick the voicing of the next chord whose notes move the least from the
// previous chord. This is what pianists and arrangers do by instinct, and it
// is why real progressions sound smooth instead of jumping around.

export function voiceChord(pcs, prev = null, { low = 55, high = 79, center = 66 } = {}) {
  const candidates = [];
  for (let r = 0; r < pcs.length; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    for (let start = low; start < low + 12; start++) {
      if (pitchClass(start) !== order[0]) continue;
      const notes = [start];
      for (const pc of order.slice(1)) {
        let m = notes.at(-1) + 1;
        while (pitchClass(m) !== pc) m++;
        notes.push(m);
      }
      // Try the same shape an octave up too.
      for (const shift of [0, 12]) {
        const v = notes.map((n) => n + shift);
        if (v.at(-1) <= high) candidates.push(v);
      }
    }
  }
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const nearest = (n, set) => Math.min(...set.map((p) => Math.abs(n - p)));
  const cost = (v) => {
    const drift = Math.abs(mean(v) - center) * 0.15;
    if (!prev) return drift;
    let c = 0;
    for (const n of v) c += nearest(n, prev);
    for (const p of prev) c += nearest(p, v);
    return c + drift;
  };
  candidates.sort((a, b) => cost(a) - cost(b));
  return candidates[0];
}

// Root in the bass, between E2 and D#3.
export function bassNote(rootPc) {
  return 40 + mod(rootPc - 4, 12);
}

// Full voicings for a list of chords: [[bass, ...upper], ...].
export function voiceProgression(chords, range) {
  let prev = null;
  return chords.map((c) => {
    const upper = voiceChord(c.pcs, prev, range);
    prev = upper;
    return [bassNote(c.pcs[0]), ...upper];
  });
}

// ---------- Generators ----------

// A progression that starts on I and follows the transition table.
export function generateProgression(pool, length = 4, rng = Math.random) {
  const out = ['I'];
  while (out.length < length) {
    const prev = out.at(-1);
    let options = TRANSITIONS[prev].filter((id) => pool.includes(id) && id !== prev);
    if (!options.length) options = pool.filter((id) => id !== prev);
    out.push(pick(options, rng));
  }
  return out;
}

export const FAMOUS = {
  'I-V-vi-IV': 'the "four chord" pop progression, used in hundreds of hits',
  'I-vi-IV-V': 'the 1950s doo-wop progression',
  'I-IV-V-I': 'the classic hymn and blues cadence',
  'I-vi-ii-V': 'the jazz "rhythm changes" turnaround',
  'I-IV-vi-V': 'a common pop and worship-music loop',
  'I-♭VII-IV-I': 'the rock "Mixolydian" move',
  'I-IV-iv-I': 'the minor iv, a bittersweet borrowed chord',
  'I-♭VI-♭VII-I': 'the "Mario cadence", heroic and cinematic',
};

// Harmonize It: a four-bar melody over a hidden progression.
// Bars 1-3 have four quarter notes; bar 4 is a whole note on the tonic.
// Beats 1 and 3 (the strong beats) are always chord tones; beats 2 and 4 may
// be passing or neighbor tones from the scale.
export function generateMelody(keyName, rng = Math.random) {
  const second = pick(['ii', 'iii', 'IV', 'vi'], rng);
  const third = pick(['ii', 'IV', 'V'].filter((x) => x !== second), rng);
  const progression = ['I', second, third, 'I'];
  const chords = progression.map((id) => chordInKey(keyName, id));
  const scale = scalePcs(keyName);
  const LOW = 62, HIGH = 79; // D4..G5, on or near the treble staff

  const inRange = (pcs) => {
    const out = [];
    for (let m = LOW; m <= HIGH; m++) if (pcs.includes(pitchClass(m))) out.push(m);
    return out;
  };
  const scaleNotes = inRange(scale);
  const near = (from, list, maxLeap) => list.filter((m) => Math.abs(m - from) <= maxLeap);
  const stepFrom = (m, dir) => {
    const i = scaleNotes.indexOf(m) + dir;
    return scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, i))];
  };

  let prevNote = pick(near(71, inRange(chords[0].pcs), 5), rng);
  const bars = [];
  for (let b = 0; b < 3; b++) {
    const tones = inRange(chords[b].pcs);
    const s1 = b === 0 ? prevNote : pick(near(prevNote, tones, 5), rng) ?? tones[0];
    const s3options = near(s1, tones, 7).filter((m) => m !== s1);
    const s3 = pick(s3options.length ? s3options : tones, rng);
    // Beat 2: step toward beat 3, or a neighbor note if they are close.
    const s2 = Math.abs(s3 - s1) > 2 ? stepFrom(s1, Math.sign(s3 - s1)) : stepFrom(s1, pick([1, -1], rng));
    const s4 = stepFrom(s3, pick([1, -1], rng));
    bars.push([s1, s2, s3, s4]);
    prevNote = s4;
  }
  const tonics = inRange([chords[3].pcs[0]]);
  const end = tonics.reduce((a, b) => (Math.abs(b - prevNote) < Math.abs(a - prevNote) ? b : a));
  bars.push([end]);
  return { progression, chords, bars };
}

// Notes that must be chord tones: beats 1 and 3 of a four-note bar, or the
// only note of a whole-note bar.
export function strongBeats(bar) {
  return bar.length === 4 ? [bar[0], bar[2]] : bar.length === 2 ? bar : [bar[0]];
}

// Every diatonic chord that fits a bar's strong beats.
export function fittingChords(keyName, bar, pool = ['I', 'ii', 'iii', 'IV', 'V', 'vi']) {
  const needed = strongBeats(bar).map(pitchClass);
  return pool.filter((id) => {
    const pcs = chordInKey(keyName, id).pcs;
    return needed.every((pc) => pcs.includes(pc));
  });
}

