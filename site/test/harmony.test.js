import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../js/harmony.js';
import { buildMidi, chordsToMidi } from '../js/midi.js';
import { seededRng, pitchClass } from '../js/theory.js';

test('diatonic chords in C and D major', () => {
  const names = (key) => H.DIATONIC.map((id) => H.chordInKey(key, id).name).join(' ');
  assert.equal(names('C'), 'C Dm Em F G Am B°');
  assert.equal(names('D'), 'D Em F♯m G A Bm C♯°');
  assert.equal(names('Eb'), 'E♭ Fm Gm A♭ B♭ Cm D°');
});

test('borrowed chords spell from the parallel minor', () => {
  const n = (id) => H.chordInKey('C', id).name;
  assert.equal(n('♭VII'), 'B♭');
  assert.equal(n('♭VI'), 'A♭');
  assert.equal(n('♭III'), 'E♭');
  assert.equal(n('iv'), 'Fm');
});

test('every transition target is a real numeral', () => {
  const ids = H.NUMERALS.map((n) => n.id);
  for (const [from, tos] of Object.entries(H.TRANSITIONS)) {
    assert.ok(ids.includes(from));
    for (const t of tos) assert.ok(ids.includes(t), `${from} -> ${t}`);
  }
});

test('spellInKey and key signatures', () => {
  assert.deepEqual(H.spellInKey(66, 'D'), { letter: 'F', acc: 1, octave: 4 });
  assert.deepEqual(H.spellInKey(70, 'Bb'), { letter: 'B', acc: -1, octave: 4 });
  assert.deepEqual(H.spellInKey(60, 'C'), { letter: 'C', acc: 0, octave: 4 });
  assert.equal(H.keySignature('A'), 3);
  assert.equal(H.keySignature('Eb'), -3);
  assert.throws(() => H.spellInKey(61, 'C'));
});

test('voiceChord returns the right pitch classes, in range, moving little', () => {
  const C = H.chordInKey('C', 'I'), F = H.chordInKey('C', 'IV'), G7ish = H.chordFromRoot('G', 'dom7');
  const v1 = H.voiceChord(C.pcs);
  assert.deepEqual([...v1.map(pitchClass)].sort(), [...C.pcs].sort());
  const v2 = H.voiceChord(F.pcs, v1);
  assert.deepEqual([...v2.map(pitchClass)].sort(), [...F.pcs].sort());
  // C to F with good voice leading keeps C as a common tone.
  assert.ok(v1.some((n) => v2.includes(n)), `${v1} -> ${v2}`);
  const moved = v2.reduce((s, n, i) => s + Math.abs(n - v1[i]), 0);
  assert.ok(moved <= 5, `moved ${moved}`);
  const v3 = H.voiceChord(G7ish.pcs, v2);
  assert.equal(v3.length, 4);
  for (const n of [...v1, ...v2, ...v3]) assert.ok(n >= 55 && n <= 79);
});

test('bass notes land in E2..D#3 on the root', () => {
  for (let pc = 0; pc < 12; pc++) {
    const b = H.bassNote(pc);
    assert.equal(pitchClass(b), pc);
    assert.ok(b >= 40 && b <= 51);
  }
});

test('generateProgression starts on I, uses only the pool, never repeats back to back', () => {
  const rng = seededRng(7);
  const pool = ['I', 'IV', 'V'];
  for (let i = 0; i < 200; i++) {
    const p = H.generateProgression(pool, 4, rng);
    assert.equal(p[0], 'I');
    assert.equal(p.length, 4);
    for (let j = 0; j < p.length; j++) {
      assert.ok(pool.includes(p[j]));
      if (j) assert.notEqual(p[j], p[j - 1]);
    }
  }
});

test('generated melodies: diatonic, in range, strong beats fit the hidden chords', () => {
  const rng = seededRng(3);
  for (const key of H.MAJOR_KEYS) {
    for (let i = 0; i < 40; i++) {
      const m = H.generateMelody(key, rng);
      const scale = H.scalePcs(key);
      assert.equal(m.bars.length, 4);
      assert.equal(m.bars[3].length, 1);
      assert.equal(pitchClass(m.bars[3][0]), scale[0], 'ends on the tonic');
      m.bars.forEach((bar, b) => {
        for (const n of bar) {
          assert.ok(scale.includes(pitchClass(n)), `${key} bar ${b} note ${n}`);
          assert.ok(n >= 62 && n <= 79, `range ${n}`);
          H.spellInKey(n, key); // throws if not spellable
        }
        assert.ok(H.fittingChords(key, bar).includes(m.progression[b]), `${key} bar ${b}`);
      });
    }
  }
});

test('fittingChords', () => {
  // C and E on the strong beats: only C major (I) and A minor (vi) contain both.
  assert.deepEqual(H.fittingChords('C', [60, 62, 64, 65]), ['I', 'vi']);
  assert.deepEqual(H.fittingChords('C', [67]), ['I', 'iii', 'V']);
});

test('MIDI file structure', () => {
  const bytes = buildMidi([{ midi: 60, start: 0, dur: 1 }]);
  const text = String.fromCharCode(...bytes.slice(0, 4));
  assert.equal(text, 'MThd');
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), 'MTrk');
  const trackLen = (bytes[18] << 24) | (bytes[19] << 16) | (bytes[20] << 8) | bytes[21];
  assert.equal(trackLen, bytes.length - 22);
  // Ends with the end-of-track meta event.
  assert.deepEqual([...bytes.slice(-3)], [0xff, 0x2f, 0x00]);
  // 480 ticks = 0x83 0x60 as a variable-length number.
  assert.ok(bytes.join(',').includes([0x83, 0x60, 0x80, 60, 0].join(',')));
});

test('chordsToMidi writes a note-on and note-off per chord tone', () => {
  const bytes = chordsToMidi([[48, 60, 64, 67], [53, 60, 65, 69]]);
  const noteOns = [...bytes].filter((b, i) => b === 0x90 && bytes[i + 2] > 0).length;
  assert.equal(noteOns, 8);
});
