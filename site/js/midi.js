// Minimal Standard MIDI File writer (format 0, one track).
//
// A MIDI file is a header chunk ("MThd") and a track chunk ("MTrk"). The
// track is a list of events, each preceded by a "delta time": how many ticks
// to wait since the previous event, written as a variable-length number
// (7 bits per byte, high bit set on every byte except the last).

const PPQ = 480; // ticks per quarter note

function varLen(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];

// notes: [{ midi, start, dur }] with start/dur in quarter notes.
export function buildMidi(notes, { bpm = 90, velocity = 90 } = {}) {
  const events = [];
  for (const n of notes) {
    events.push({ t: Math.round(n.start * PPQ), on: true, midi: n.midi });
    events.push({ t: Math.round((n.start + n.dur) * PPQ), on: false, midi: n.midi });
  }
  // Note-offs before note-ons at the same tick, so repeated notes retrigger.
  events.sort((a, b) => a.t - b.t || a.on - b.on);

  const usPerQuarter = Math.round(60_000_000 / bpm);
  const track = [0x00, 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 255, (usPerQuarter >> 8) & 255, usPerQuarter & 255];
  let last = 0;
  for (const e of events) {
    track.push(...varLen(e.t - last), e.on ? 0x90 : 0x80, e.midi, e.on ? velocity : 0);
    last = e.t;
  }
  track.push(0x00, 0xff, 0x2f, 0x00); // end of track

  const header = [...'MThd'].map((c) => c.charCodeAt(0)).concat(u32(6), u16(0), u16(1), u16(PPQ));
  const trackHead = [...'MTrk'].map((c) => c.charCodeAt(0)).concat(u32(track.length));
  return new Uint8Array([...header, ...trackHead, ...track]);
}

// Chords as blocks, one after another. voicings: [[midi, ...], ...].
export function chordsToMidi(voicings, { beatsPerChord = 4, bpm = 90 } = {}) {
  const notes = [];
  voicings.forEach((v, i) => v.forEach((midi) => notes.push({ midi, start: i * beatsPerChord, dur: beatsPerChord })));
  return buildMidi(notes, { bpm });
}

export function downloadMidi(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
