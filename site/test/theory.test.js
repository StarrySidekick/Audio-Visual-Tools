import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/theory.js';

test('midiToFreq: A4 is 440, C4 is ~261.63', () => {
  assert.equal(T.midiToFreq(69), 440);
  assert.ok(Math.abs(T.midiToFreq(60) - 261.6256) < 0.001);
});

test('midiToName uses scientific octave numbers', () => {
  assert.equal(T.midiToName(60), 'C4');
  assert.equal(T.midiToName(61), 'C♯4');
  assert.equal(T.midiToName(61, { flats: true }), 'D♭4');
  assert.equal(T.midiToName(59), 'B3');
  assert.equal(T.midiToName(21), 'A0');
});

test('spelledToMidi round-trips with accidentals', () => {
  assert.equal(T.spelledToMidi({ letter: 'C', acc: 0, octave: 4 }), 60);
  assert.equal(T.spelledToMidi({ letter: 'B', acc: 1, octave: 3 }), 60); // B♯3 = C4
  assert.equal(T.spelledToMidi({ letter: 'C', acc: -1, octave: 4 }), 59); // C♭4 = B3
});

test('spellToken picks the right letter, not just the right pitch', () => {
  const s = (root, tok) => T.spelledName(T.spellToken(T.parseNoteName(root), tok));
  assert.equal(s('F#', '3'), 'A♯');
  assert.equal(s('Eb', 'b3'), 'G♭');
  assert.equal(s('C', '#4'), 'F♯');
  assert.equal(s('C', 'b5'), 'G♭');
  assert.equal(s('B', '#5'), 'F𝄪');
  assert.equal(s('C', 'bb7'), 'B𝄫');
});

test('chord spellings', () => {
  const spell = (root, id) => T.spellFormula(root, T.CHORDS.find((c) => c.id === id).formula).join(' ');
  assert.equal(spell('C', 'maj'), 'C E G');
  assert.equal(spell('A', 'min'), 'A C E');
  assert.equal(spell('B', 'dim'), 'B D F');
  assert.equal(spell('Db', 'dom7'), 'D♭ F A♭ C♭');
  assert.equal(spell('G', 'maj7'), 'G B D F♯');
});

test('scale formulas all span less than an octave and ascend', () => {
  for (const s of T.SCALES) {
    const semis = s.formula.map(T.tokenSemis);
    for (let i = 1; i < semis.length; i++) assert.ok(semis[i] > semis[i - 1], s.id);
    assert.ok(semis.at(-1) < 12, s.id);
  }
});

test('mode step patterns', () => {
  const pat = (id) => T.stepPattern(T.SCALES.find((s) => s.id === id).formula);
  assert.equal(pat('major'), 'W W H W W W H');
  assert.equal(pat('minor'), 'W H W W H W W');
  assert.equal(pat('dorian'), 'W H W W W H W');
  assert.equal(pat('harmonic'), 'W H W W H W+H H');
});

test('seven-note scales spell with seven distinct letters', () => {
  for (const s of T.SCALES.filter((x) => x.formula.length === 7)) {
    for (const root of T.COMMON_ROOTS) {
      const letters = T.spellFormula(root, s.formula).map((n) => n[0]);
      assert.equal(new Set(letters).size, 7, `${root} ${s.id}`);
    }
  }
});

test('spelled chord notes match the MIDI built from the formula', () => {
  for (const c of T.CHORDS) {
    for (const root of T.COMMON_ROOTS) {
      const r = T.parseNoteName(root);
      const midis = T.buildFromFormula(T.rootMidi(root, 4), c.formula);
      c.formula.forEach((tok, i) => {
        const sp = T.spellToken(r, tok);
        assert.equal(T.pitchClass(T.spelledToMidi({ ...sp, octave: 4 })), T.pitchClass(midis[i]), `${root}${c.symbol} ${tok}`);
      });
    }
  }
});

test('buildFromFormula and invert', () => {
  assert.deepEqual(T.buildFromFormula(60, ['1', '3', '5']), [60, 64, 67]);
  assert.deepEqual(T.buildFromFormula(60, ['1', '3', '5'], { closeOctave: true }), [60, 64, 67, 72]);
  assert.deepEqual(T.invert([60, 64, 67], 1), [64, 67, 72]);
  assert.deepEqual(T.invert([60, 64, 67], 2), [67, 72, 76]);
});

test('staff positions: treble lines are E G B D F, bass lines are G B D F A', () => {
  const lines = (clef) => [0, 2, 4, 6, 8].map((p) => T.noteAtPosition(p, clef).letter).join('');
  assert.equal(lines('treble'), 'EGBDF');
  assert.equal(lines('bass'), 'GBDFA');
  // Middle C: one ledger line below treble, one above bass.
  const c4 = { letter: 'C', octave: 4 };
  assert.equal(T.staffPosition(c4, 'treble'), -2);
  assert.equal(T.staffPosition(c4, 'bass'), 10);
});

test('staffNotePool sizes', () => {
  assert.equal(T.staffNotePool('treble').length, 11); // D4..G5
  assert.equal(T.staffNotePool('treble', { ledger: true }).length, 19);
});

test('intervals cover 1..12 half steps once each', () => {
  assert.deepEqual(T.INTERVALS.map((i) => i.semis), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('seededRng is deterministic and pickFresh avoids repeats', () => {
  const a = T.seededRng(42), b = T.seededRng(42);
  assert.equal(a(), b());
  const rng = T.seededRng(1);
  for (let i = 0; i < 50; i++) assert.notEqual(T.pickFresh([1, 2, 3], 2, rng), 2);
  assert.equal(T.pickFresh([7], 7, rng), 7);
});

test('interval tokens agree with semitone counts', () => {
  for (const i of T.INTERVALS) assert.equal(T.tokenSemis(i.token), i.semis, i.id);
});
