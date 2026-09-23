// Tiny Web Audio piano-ish synth. No samples, so the site stays a few KB.
//
// Each note is a handful of sine partials (the fundamental plus quieter
// overtones) through an envelope: a fast attack and an exponential decay,
// which is roughly how a struck string behaves. Higher partials decay faster,
// so the tone darkens as it fades, the way a real piano does.

import { midiToFreq } from './theory.js';

let ctx = null;
let master = null;
let current = null; // gain node for the phrase now playing, so we can cut it

const PARTIALS = [
  { mult: 1, gain: 1.0, decay: 1.0 },
  { mult: 2, gain: 0.35, decay: 0.6 },
  { mult: 3, gain: 0.18, decay: 0.45 },
  { mult: 4, gain: 0.08, decay: 0.35 },
  { mult: 5, gain: 0.04, decay: 0.3 },
];

// Browsers block audio until a user gesture. Call this from a click handler.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createDynamicsCompressor(); // keeps big chords from clipping
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isUnlocked() {
  return !!ctx && ctx.state === 'running';
}

// Fade out whatever phrase is playing. Called before each new phrase so
// replays and fast clicking do not pile up.
export function stop() {
  if (!current || !ctx) return;
  const g = current;
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + 0.05);
  setTimeout(() => g.disconnect(), 200);
  current = null;
}

function newPhrase() {
  unlock();
  stop();
  const g = ctx.createGain();
  g.gain.value = 0.5;
  g.connect(master);
  current = g;
  return g;
}

function voice(dest, midi, start, duration, velocity = 0.8) {
  const f = midiToFreq(midi);
  // Low notes ring longer than high notes on a real piano.
  const ring = Math.min(3.5, Math.max(0.8, 3.5 - (midi - 48) * 0.04));
  const end = start + Math.max(duration, 0.1);
  const out = ctx.createGain();
  out.gain.value = velocity * 0.3;
  out.connect(dest);
  for (const p of PARTIALS) {
    if (f * p.mult > 12000) continue;
    const osc = ctx.createOscillator();
    osc.frequency.value = f * p.mult;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(p.gain, start + 0.008);
    env.gain.setTargetAtTime(0, start + 0.008, ring * p.decay * 0.35);
    // Release: when the "key" lifts, damp quickly.
    env.gain.setTargetAtTime(0, end, 0.08);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(end + 0.6);
  }
}

// events: [{ midi, at (seconds from now), dur }]. Returns total length in seconds.
export function playEvents(events) {
  const dest = newPhrase();
  const t0 = ctx.currentTime + 0.05;
  let endAt = 0;
  for (const e of events) {
    voice(dest, e.midi, t0 + e.at, e.dur, e.vel);
    endAt = Math.max(endAt, e.at + e.dur);
  }
  return endAt;
}

export function playNote(midi, dur = 1) {
  return playEvents([{ midi, at: 0, dur }]);
}

export function playChord(midis, dur = 1.6) {
  return playEvents(midis.map((midi) => ({ midi, at: 0, dur, vel: 0.7 })));
}

export function playSequence(midis, { step = 0.45, dur = 0.5, startAt = 0 } = {}) {
  return playEvents(midis.map((midi, i) => ({ midi, at: startAt + i * step, dur })));
}
