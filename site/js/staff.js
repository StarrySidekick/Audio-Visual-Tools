// Draws one note on a five-line staff as SVG.
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

const ACC = { '-1': '♭', '1': '♯' };

export function renderStaff(container, { clef = 'treble', note = null, label = '' } = {}) {
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" class="staff-svg" role="img" aria-label="${label || clef + ' staff'}">`);

  for (let i = 0; i < 5; i++) {
    const y = TOP + i * GAP;
    parts.push(`<line x1="8" x2="${W - 8}" y1="${y}" y2="${y}" class="staff-line"/>`);
  }
  const g = CLEF_GLYPH[clef];
  parts.push(`<text x="14" y="${g.y}" font-size="${g.size}" class="clef">${g.char}</text>`);

  if (note) {
    const pos = staffPosition(note, clef);
    const y = posY(pos);
    // Ledger lines: every even position outside 0..8, between staff and note.
    for (let p = -2; p >= pos; p -= 2) parts.push(ledger(posY(p)));
    for (let p = 10; p <= pos; p += 2) parts.push(ledger(posY(p)));
    // Stem goes down for notes on or above the middle line, up below it.
    const up = pos < 4;
    const sx = up ? NOTE_X + 7.2 : NOTE_X - 7.2;
    const sy2 = up ? y - 3.5 * GAP : y + 3.5 * GAP;
    parts.push(`<line x1="${sx}" x2="${sx}" y1="${y}" y2="${sy2}" class="stem"/>`);
    parts.push(`<ellipse cx="${NOTE_X}" cy="${y}" rx="8" ry="5.8" transform="rotate(-20 ${NOTE_X} ${y})" class="notehead"/>`);
    if (note.acc) parts.push(`<text x="${NOTE_X - 26}" y="${y + 7}" font-size="22" class="accidental">${ACC[note.acc]}</text>`);
  }
  parts.push('</svg>');
  container.innerHTML = parts.join('');
}

function ledger(y) {
  return `<line x1="${NOTE_X - 14}" x2="${NOTE_X + 14}" y1="${y}" y2="${y}" class="staff-line"/>`;
}
