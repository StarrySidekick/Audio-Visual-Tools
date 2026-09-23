// Music theory core. Pure functions, no DOM or audio, so it runs in Node tests.
//
// Pitches are MIDI numbers (60 = middle C = C4). Spelled note names are
// objects { letter, acc, octave } where acc is -2..2 (flats negative).

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
// Pitch class of each natural letter, indexed like LETTERS.
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

const ACC_SYMBOL = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };

export const mod = (n, m) => ((n % m) + m) % m;

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function pitchClass(midi) {
  return mod(midi, 12);
}

export function isBlackKey(midi) {
  return [1, 3, 6, 8, 10].includes(pitchClass(midi));
}

// "C4", "F♯3". Octave numbering follows scientific pitch (C4 = 60).
export function midiToName(midi, { flats = false, octave = true } = {}) {
  const name = (flats ? FLAT_NAMES : SHARP_NAMES)[pitchClass(midi)];
  return octave ? name + (Math.floor(midi / 12) - 1) : name;
}

// ---------- Spelled notes ----------

export function spelledToMidi({ letter, acc = 0, octave }) {
  return (octave + 1) * 12 + LETTER_PC[LETTERS.indexOf(letter)] + acc;
}

export function spelledName({ letter, acc = 0, octave }, withOctave = false) {
  return letter + ACC_SYMBOL[acc] + (withOctave && octave !== undefined ? octave : '');
}

// Parse "C", "Eb", "F#", "Bbb" (ASCII or unicode accidentals).
export function parseNoteName(str) {
  const letter = str[0].toUpperCase();
  if (!LETTERS.includes(letter)) throw new Error(`Bad note name: ${str}`);
  let acc = 0;
  for (const ch of str.slice(1)) {
    if (ch === '#' || ch === '♯') acc += 1;
    else if (ch === 'b' || ch === '♭') acc -= 1;
    else if (ch === '𝄪') acc += 2;
    else if (ch === '𝄫') acc -= 2;
  }
  return { letter, acc };
}

// Diatonic index: counts letter steps, ignoring accidentals. C4 = 28.
// Staff position is just a difference of diatonic indexes.
export function diatonicIndex({ letter, octave }) {
  return octave * 7 + LETTERS.indexOf(letter);
}

export function fromDiatonicIndex(index) {
  return { letter: LETTERS[mod(index, 7)], acc: 0, octave: Math.floor(index / 7) };
}

// ---------- Interval tokens (scale-degree formulas like "1 b3 5") ----------
//
// A token carries two facts: how many half steps above the root, and which
// letter step (degree) it lands on. Both are needed to spell notes correctly:
// a minor 3rd above F# is A (degree 3), not G♯♯ or B♭.

export const TOKENS = {
  '1': { semis: 0, deg: 0 },
  'b2': { semis: 1, deg: 1 },
  '2': { semis: 2, deg: 1 },
  '#2': { semis: 3, deg: 1 },
  'b3': { semis: 3, deg: 2 },
  '3': { semis: 4, deg: 2 },
  '4': { semis: 5, deg: 3 },
  '#4': { semis: 6, deg: 3 },
  'b5': { semis: 6, deg: 4 },
  '5': { semis: 7, deg: 4 },
  '#5': { semis: 8, deg: 4 },
  'b6': { semis: 8, deg: 5 },
  '6': { semis: 9, deg: 5 },
  'bb7': { semis: 9, deg: 6 },
  'b7': { semis: 10, deg: 6 },
  '7': { semis: 11, deg: 6 },
  '8': { semis: 12, deg: 7 },
};

export function tokenSemis(token) {
  const t = TOKENS[token];
  if (!t) throw new Error(`Unknown token: ${token}`);
  return t.semis;
}

// Spell the note a token above a root, e.g. spellToken({letter:'E', acc:-1}, 'b3') -> G♭.
export function spellToken(root, token) {
  const { semis, deg } = TOKENS[token];
  const rootIdx = LETTERS.indexOf(root.letter);
  const letterIdx = mod(rootIdx + deg, 7);
  const rootPc = LETTER_PC[rootIdx] + (root.acc || 0);
  const targetPc = mod(rootPc + semis, 12);
  let acc = mod(targetPc - LETTER_PC[letterIdx], 12);
  if (acc > 6) acc -= 12; // e.g. 11 -> -1 (one flat)
  return { letter: LETTERS[letterIdx], acc };
}

export function spellFormula(rootName, formula) {
  const root = parseNoteName(rootName);
  return formula.map((t) => spelledName(spellToken(root, t)));
}

// ---------- Intervals ----------

export const INTERVALS = [
  { id: 'm2', token: 'b2', semis: 1, name: 'Minor 2nd', song: 'Jaws' },
  { id: 'M2', token: '2', semis: 2, name: 'Major 2nd', song: 'Happy Birthday' },
  { id: 'm3', token: 'b3', semis: 3, name: 'Minor 3rd', song: 'Greensleeves' },
  { id: 'M3', token: '3', semis: 4, name: 'Major 3rd', song: 'When the Saints Go Marching In' },
  { id: 'P4', token: '4', semis: 5, name: 'Perfect 4th', song: 'Here Comes the Bride' },
  { id: 'TT', token: '#4', semis: 6, name: 'Tritone', song: 'The Simpsons theme' },
  { id: 'P5', token: '5', semis: 7, name: 'Perfect 5th', song: 'Star Wars (main theme)' },
  { id: 'm6', token: 'b6', semis: 8, name: 'Minor 6th', song: 'The Entertainer' },
  { id: 'M6', token: '6', semis: 9, name: 'Major 6th', song: 'My Bonnie Lies Over the Ocean' },
  { id: 'm7', token: 'b7', semis: 10, name: 'Minor 7th', song: 'Star Trek (original theme)' },
  { id: 'M7', token: '7', semis: 11, name: 'Major 7th', song: 'Take On Me (chorus)' },
  { id: 'P8', token: '8', semis: 12, name: 'Octave', song: 'Somewhere Over the Rainbow' },
];

export function intervalBySemis(semis) {
  return INTERVALS.find((i) => i.semis === semis);
}

// ---------- Chords ----------

export const CHORDS = [
  { id: 'maj', name: 'Major', symbol: '', formula: ['1', '3', '5'], hint: 'Bright, stable. Major 3rd on the bottom, minor 3rd on top.' },
  { id: 'min', name: 'Minor', symbol: 'm', formula: ['1', 'b3', '5'], hint: 'Darker. Minor 3rd on the bottom, major 3rd on top.' },
  { id: 'dim', name: 'Diminished', symbol: '°', formula: ['1', 'b3', 'b5'], hint: 'Two stacked minor 3rds. Tense, wants to resolve.' },
  { id: 'aug', name: 'Augmented', symbol: '+', formula: ['1', '3', '#5'], hint: 'Two stacked major 3rds. Dreamy, unresolved, symmetrical.' },
  { id: 'sus2', name: 'Suspended 2nd', symbol: 'sus2', formula: ['1', '2', '5'], hint: 'No 3rd at all, so neither major nor minor. Open and airy.' },
  { id: 'sus4', name: 'Suspended 4th', symbol: 'sus4', formula: ['1', '4', '5'], hint: 'The 4th "hangs" where the 3rd would be and wants to fall.' },
  { id: 'maj7', name: 'Major 7th', symbol: 'maj7', formula: ['1', '3', '5', '7'], hint: 'Major triad plus a major 7th, a half step below the octave. Lush.' },
  { id: 'dom7', name: 'Dominant 7th', symbol: '7', formula: ['1', '3', '5', 'b7'], hint: 'Major triad plus a minor 7th. Bluesy, pulls toward home.' },
  { id: 'min7', name: 'Minor 7th', symbol: 'm7', formula: ['1', 'b3', '5', 'b7'], hint: 'Minor triad plus a minor 7th. Mellow, soft.' },
  { id: 'm7b5', name: 'Half-diminished', symbol: 'ø7', formula: ['1', 'b3', 'b5', 'b7'], hint: 'Diminished triad plus a minor 7th. Moody, jazzy.' },
  { id: 'dim7', name: 'Diminished 7th', symbol: '°7', formula: ['1', 'b3', 'b5', 'bb7'], hint: 'Stacked minor 3rds all the way up. Horror-movie tension.' },
];

// ---------- Scales and modes ----------

export const SCALES = [
  { id: 'major', name: 'Major (Ionian)', formula: ['1', '2', '3', '4', '5', '6', '7'], hint: 'The reference point. Every other mode is described against major or minor.' },
  { id: 'minor', name: 'Natural minor (Aeolian)', formula: ['1', '2', 'b3', '4', '5', 'b6', 'b7'], hint: 'Major with a flat 3, 6 and 7.' },
  { id: 'dorian', name: 'Dorian', formula: ['1', '2', 'b3', '4', '5', '6', 'b7'], hint: 'Natural minor with a raised 6th. Minor, but brighter.' },
  { id: 'phrygian', name: 'Phrygian', formula: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'], hint: 'Natural minor with a flat 2nd. That half step off the root sounds Spanish or metal.' },
  { id: 'lydian', name: 'Lydian', formula: ['1', '2', '3', '#4', '5', '6', '7'], hint: 'Major with a raised 4th. Floaty, film-score wonder.' },
  { id: 'mixolydian', name: 'Mixolydian', formula: ['1', '2', '3', '4', '5', '6', 'b7'], hint: 'Major with a flat 7th. Rock and folk.' },
  { id: 'locrian', name: 'Locrian', formula: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'], hint: 'Flat 2 and flat 5. The root chord is diminished, so it never feels settled.' },
  { id: 'harmonic', name: 'Harmonic minor', formula: ['1', '2', 'b3', '4', '5', 'b6', '7'], hint: 'Natural minor with a raised 7th. The gap from b6 to 7 is the "exotic" leap.' },
  { id: 'melodic', name: 'Melodic minor', formula: ['1', '2', 'b3', '4', '5', '6', '7'], hint: 'Major with a flat 3rd. Jazz minor.' },
  { id: 'majpent', name: 'Major pentatonic', formula: ['1', '2', '3', '5', '6'], hint: 'Major without the 4th and 7th. No half steps, nothing clashes.' },
  { id: 'minpent', name: 'Minor pentatonic', formula: ['1', 'b3', '4', '5', 'b7'], hint: 'The rock and blues solo scale.' },
  { id: 'blues', name: 'Blues', formula: ['1', 'b3', '4', 'b5', '5', 'b7'], hint: 'Minor pentatonic plus the b5 "blue note".' },
  { id: 'whole', name: 'Whole tone', formula: ['1', '2', '3', '#4', '#5', 'b7'], hint: 'All whole steps. No center of gravity; dream-sequence sound.' },
];

// Build MIDI notes from a root MIDI number and a formula. Adds the octave on
// top when closeOctave is set, which is how scales are usually played.
export function buildFromFormula(rootMidi, formula, { closeOctave = false } = {}) {
  const notes = formula.map((t) => rootMidi + tokenSemis(t));
  if (closeOctave) notes.push(rootMidi + 12);
  return notes;
}

// Move the lowest notes up an octave. inversion 1 = first inversion, etc.
export function invert(notes, inversion) {
  const out = [...notes];
  for (let i = 0; i < inversion; i++) out.push(out.shift() + 12);
  return out;
}

// Whole-and-half-step pattern, e.g. major -> "W W H W W W H".
export function stepPattern(formula) {
  const semis = [...formula.map(tokenSemis), 12];
  const names = { 1: 'H', 2: 'W', 3: 'W+H', 4: '2W' };
  const steps = [];
  for (let i = 1; i < semis.length; i++) steps.push(names[semis[i] - semis[i - 1]] || '?');
  return steps.join(' ');
}

// Roots chosen so spellings stay readable (no G♯ major with its F𝄪).
export const COMMON_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function rootMidi(rootName, octave) {
  const { letter, acc } = parseNoteName(rootName);
  return spelledToMidi({ letter, acc, octave });
}

// ---------- Staff reading ----------

// Staff position 0 = bottom line, 1 = first space, ... 8 = top line.
// Negative or >8 means ledger lines.
export const CLEFS = {
  treble: { name: 'Treble', bottomLine: { letter: 'E', octave: 4 } },
  bass: { name: 'Bass', bottomLine: { letter: 'G', octave: 2 } },
};

export function staffPosition(note, clef) {
  return diatonicIndex(note) - diatonicIndex(CLEFS[clef].bottomLine);
}

export function noteAtPosition(position, clef) {
  return fromDiatonicIndex(diatonicIndex(CLEFS[clef].bottomLine) + position);
}

// Natural notes a reader should know for a clef. Ledger mode adds up to
// two ledger lines above and below (middle C region included on both clefs).
export function staffNotePool(clef, { ledger = false } = {}) {
  const [lo, hi] = ledger ? [-5, 13] : [-1, 9];
  const pool = [];
  for (let p = lo; p <= hi; p++) pool.push(noteAtPosition(p, clef));
  return pool;
}

// ---------- Randomness (injectable for tests) ----------

export function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(lo, hi, rng = Math.random) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// Pick from arr but avoid repeating `prev` when there is another option.
export function pickFresh(arr, prev, rng = Math.random, same = (a, b) => a === b) {
  if (arr.length < 2 || prev === undefined) return pick(arr, rng);
  const pool = arr.filter((x) => !same(x, prev));
  return pick(pool, rng);
}

// Small seeded PRNG (mulberry32) so tests are deterministic.
export function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
