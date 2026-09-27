// Draws notes on a five-line staff as SVG.
//
// Geometry: lines are GAP px apart. Each staff "position" (line or space) is
// half a gap. Position 0 is the bottom line, so y = bottom - pos * GAP / 2.

import { staffPosition } from './theory.js';

const GAP = 14;
const W = 260;
const TOP = 60; // y of the top line (position 8)
const BOTTOM = TOP + 4 * GAP; // y of the bottom line (position 0)
const H = BOTTOM + 60;
const NOTE_X = 170;

const posY = (pos) => BOTTOM - (pos * GAP) / 2;

const CLEF_GLYPH = {
  // Unicode musical symbols, rendered with the Noto Music webfont.
  treble: { char: '\u{1D11E}', size: 78, y: posY(2) + 19 },
  bass: { char: '\u{1D122}', size: 62, y: posY(6) + 41 },
};

// Sharps and flats drawn as shapes, centered on a line or space at y.
// (Text glyphs fall back to emoji fonts on some systems.)
function accidental(x, y, acc) {
  if (acc > 0) {
    return `<g class="acc-shape"><line x1="${x + 2}" x2="${x + 2}" y1="${y - 10}" y2="${y + 12}"/><line x1="${x + 7}" x2="${x + 7}" y1="${y - 12}" y2="${y + 10}"/>`
      + `<line x1="${x - 1}" x2="${x + 10}" y1="${y - 2}" y2="${y - 5}" class="acc-thick"/><line x1="${x - 1}" x2="${x + 10}" y1="${y + 5}" y2="${y + 2}" class="acc-thick"/></g>`;
  }
  return `<g class="acc-shape"><line x1="${x + 1}" x2="${x + 1}" y1="${y - 17}" y2="${y + 5}"/>`
    + `<path d="M${x + 1} ${y + 5} C${x + 12} ${y - 1} ${x + 10} ${y - 7} ${x + 1} ${y - 1}" fill="none" class="acc-thick"/></g>`;
}

export function renderStaff(container, { clef = 'treble', note = null, label = '' } = {}) {
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" class="staff-svg" role="img" aria-label="${label || clef + ' staff'}">`);

  for (let i = 0; i < 5; i++) {
    const y = TOP + i * GAP;
    parts.push(`<line x1="8" x2="${W - 8}" y1="${y}" y2="${y}" class="staff-line"/>`);
  }
  const g = CLEF_GLYPH[clef];
  parts.push(`<text x="14" y="${g.y}" font-size="${g.size}" class="clef">${g.char}</text>`);

  if (note) parts.push(...noteGlyph(NOTE_X, staffPosition(note, clef), { acc: note.acc }));
  parts.push('</svg>');
  container.innerHTML = parts.join('');
}

// One note: ledger lines, stem, head, accidental. kind: 'quarter' | 'half' | 'whole'.
function noteGlyph(x, pos, { acc = 0, kind = 'quarter' } = {}) {
  const out = [];
  const y = posY(pos);
  // Ledger lines: every even position outside 0..8, between staff and note.
  for (let p = -2; p >= pos; p -= 2) out.push(ledger(x, posY(p)));
  for (let p = 10; p <= pos; p += 2) out.push(ledger(x, posY(p)));
  if (kind !== 'whole') {
    // Stem goes down for notes on or above the middle line, up below it.
    const up = pos < 4;
    const sx = up ? x + 7.2 : x - 7.2;
    const sy2 = up ? y - 3.5 * GAP : y + 3.5 * GAP;
    out.push(`<line x1="${sx}" x2="${sx}" y1="${y}" y2="${sy2}" class="stem"/>`);
  }
  if (kind === 'whole') out.push(`<ellipse cx="${x}" cy="${y}" rx="9" ry="6" class="notehead-open" stroke-width="3"/>`);
  else out.push(`<ellipse cx="${x}" cy="${y}" rx="8" ry="5.8" transform="rotate(-20 ${x} ${y})" class="${kind === 'half' ? 'notehead-open' : 'notehead'}"/>`);
  if (acc) out.push(accidental(x - 24, y, acc));
  return out;
}

function ledger(x, y) {
  return `<line x1="${x - 14}" x2="${x + 14}" y1="${y}" y2="${y}" class="staff-line"/>`;
}

// Key signature accidentals in the order they are added, as treble staff notes.
const SHARP_ORDER = [['F', 5], ['C', 5], ['G', 5], ['D', 5], ['A', 4], ['E', 5], ['B', 4]];
const FLAT_ORDER = [['B', 4], ['E', 5], ['A', 4], ['D', 5], ['G', 4], ['C', 5], ['F', 4]];

// A short melody on a treble staff with a key signature.
// bars: [[spelled note, ...], ...]; a bar of 4 notes is quarters, 2 is halves,
// 1 is a whole note. Notes in the key signature get no accidental.
// Returns layout fractions so HTML controls can line up under each bar.
export function renderMelody(container, { bars, keySig = 0, label = 'melody' }) {
  const MW = 470;
  const parts = [`<svg viewBox="0 0 ${MW} ${H}" class="staff-svg staff-wide" role="img" aria-label="${label}">`];
  for (let i = 0; i < 5; i++) {
    const y = TOP + i * GAP;
    parts.push(`<line x1="8" x2="${MW - 8}" y1="${y}" y2="${y}" class="staff-line"/>`);
  }
  const g = CLEF_GLYPH.treble;
  parts.push(`<text x="14" y="${g.y}" font-size="${g.size}" class="clef">${g.char}</text>`);

  let x = 70;
  const order = keySig > 0 ? SHARP_ORDER : FLAT_ORDER;
  for (let i = 0; i < Math.abs(keySig); i++) {
    const [letter, octave] = order[i];
    const y = posY(staffPosition({ letter, octave }, 'treble'));
    parts.push(accidental(x, y, keySig > 0 ? 1 : -1));
    x += 11;
  }
  const start = x + 14;
  const barW = (MW - 8 - start) / bars.length;
  const kinds = { 4: 'quarter', 2: 'half', 1: 'whole' };
  bars.forEach((bar, b) => {
    const bx = start + b * barW;
    bar.forEach((note, i) => {
      const nx = bar.length === 1 ? bx + barW * 0.35 : bx + (i + 0.5) * (barW / bar.length);
      parts.push(...noteGlyph(nx, staffPosition(note, 'treble'), { kind: kinds[bar.length] }));
    });
    const lx = bx + barW;
    const last = b === bars.length - 1;
    parts.push(`<line x1="${lx - (last ? 5 : 0)}" x2="${lx - (last ? 5 : 0)}" y1="${TOP}" y2="${BOTTOM}" class="staff-line"/>`);
    if (last) parts.push(`<rect x="${lx - 3}" y="${TOP}" width="4" height="${BOTTOM - TOP}" class="notehead"/>`);
  });
  parts.push('</svg>');
  container.innerHTML = parts.join('');
  return { prefix: start / MW, bar: barW / MW };
}
