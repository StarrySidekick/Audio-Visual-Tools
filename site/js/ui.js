// Answer widgets. Both return the same small interface so the quiz engine
// does not care whether you answer with buttons or piano keys:
//   { mark(id, state), clear() }   state: 'correct' | 'wrong'

import { isBlackKey, midiToName } from './theory.js';

export function buttonChoices(container, choices, onPick) {
  container.className = 'choices choices-buttons';
  container.innerHTML = '';
  const byId = new Map();
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.innerHTML = `<span class="choice-key">${c.hotkey || (i < 9 ? i + 1 : '')}</span><span class="choice-label">${c.label}</span>${c.sub ? `<span class="choice-sub">${c.sub}</span>` : ''}`;
    b.addEventListener('click', () => onPick(c.id));
    container.appendChild(b);
    byId.set(String(c.id), b);
  });
  return widget(byId);
}

// On-screen piano. low/high are MIDI numbers; both ends should be white keys.
export function pianoChoices(container, { low, high, enabled = null, labels = true }, onPick) {
  container.className = 'choices choices-piano';
  container.innerHTML = '';
  const kb = document.createElement('div');
  kb.className = 'piano';
  container.appendChild(kb);

  const whites = [];
  for (let m = low; m <= high; m++) if (!isBlackKey(m)) whites.push(m);
  const w = 100 / whites.length;
  const byId = new Map();

  let whiteIdx = 0;
  for (let m = low; m <= high; m++) {
    const black = isBlackKey(m);
    const k = document.createElement('button');
    k.type = 'button';
    k.className = black ? 'key key-black' : 'key key-white';
    k.setAttribute('aria-label', midiToName(m));
    if (black) {
      // Centered on the boundary between the previous white key and the next.
      k.style.left = `calc(${whiteIdx * w}% - ${w * 0.3}%)`;
      k.style.width = `${w * 0.6}%`;
    } else {
      k.style.left = `${whiteIdx * w}%`;
      k.style.width = `${w}%`;
      whiteIdx++;
    }
    const on = !enabled || enabled.has(m);
    if (!on) k.disabled = true;
    if (labels && !black) {
      const name = midiToName(m, { octave: false });
      k.innerHTML = `<span class="key-label">${name === 'C' ? midiToName(m) : name}</span>`;
    }
    k.addEventListener('click', () => onPick(m));
    kb.appendChild(k);
    byId.set(String(m), k);
  }
  return widget(byId);
}

function widget(byId) {
  return {
    mark(id, state) {
      byId.get(String(id))?.classList.add(`is-${state}`);
    },
    clear() {
      for (const el of byId.values()) el.classList.remove('is-correct', 'is-wrong');
    },
  };
}

// Checkbox group for picking which chord/scale/interval types to drill.
// Keeps at least `min` boxes checked so the quiz always has a real choice.
export function typePicker(container, items, { defaults, storageKey, min = 2, presets = {} }, onChange) {
  let selected = new Set(load(storageKey, defaults));
  const render = () => {
    container.innerHTML = '';
    const presetRow = document.createElement('div');
    presetRow.className = 'preset-row';
    for (const [name, ids] of Object.entries(presets)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = name;
      b.addEventListener('click', () => { selected = new Set(ids); commit(); });
      presetRow.appendChild(b);
    }
    if (Object.keys(presets).length) container.appendChild(presetRow);
    const grid = document.createElement('div');
    grid.className = 'type-grid';
    for (const it of items) {
      const lab = document.createElement('label');
      lab.className = 'type-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(it.id);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(it.id);
        else if (selected.size > min) selected.delete(it.id);
        else cb.checked = true;
        commit();
      });
      lab.append(cb, document.createTextNode(' ' + it.name));
      grid.appendChild(lab);
    }
    container.appendChild(grid);
  };
  const commit = () => { save(storageKey, [...selected]); render(); onChange(); };
  render();
  return { get: () => items.filter((it) => selected.has(it.id)) };
}

// Bind a <select> or checkbox to localStorage and a change callback.
export function persistControl(el, storageKey, onChange) {
  const isBox = el.type === 'checkbox';
  const saved = load(storageKey, null);
  if (saved !== null) isBox ? (el.checked = saved) : (el.value = saved);
  el.addEventListener('change', () => { save(storageKey, isBox ? el.checked : el.value); onChange(); });
  return () => (isBox ? el.checked : el.value);
}

// Storage can throw (private mode, blocked site data), so every access is guarded.
export function load(key, fallback) {
  try {
    const v = localStorage.getItem('mg:' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try { localStorage.setItem('mg:' + key, JSON.stringify(value)); } catch { /* ignore */ }
}

// Fill-in-the-slots answer: several slots (one per chord or bar), a row of
// option buttons, and Undo / Check. Used for multi-part answers like a
// four-chord progression. Calls onSubmit(values) once every slot is filled.
//   slots: number; fixed: { index: optionId } prefilled and locked
//   options: [{ id, label, sub }]; preview(values) optional "hear it" button
//   columns: CSS grid-template-columns for the slot row (to line up with a staff)
let slotKeyHandler = null;

export function slotChoices(container, { slots, fixed = {}, options, preview, columns, previewLabel = 'Hear my answer' }, onSubmit) {
  container.className = 'choices choices-slots';
  container.innerHTML = '';
  const values = Array.from({ length: slots }, (_, i) => fixed[i] ?? null);
  const label = (id) => options.find((o) => o.id === id);
  let active = values.indexOf(null);
  let revealed = false;
  let results = null;
  let onSlotClick = null;

  const row = document.createElement('div');
  row.className = 'slot-row';
  row.style.gridTemplateColumns = columns || `repeat(${slots}, 1fr)`;
  if (columns) row.appendChild(document.createElement('div')); // spacer under clef/key signature
  const slotEls = values.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot';
    b.addEventListener('click', () => {
      if (revealed) return onSlotClick?.(i);
      if (i in fixed) return;
      active = i;
      paint();
    });
    row.appendChild(b);
    return b;
  });

  const opts = document.createElement('div');
  opts.className = 'choices-buttons numerals';
  options.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.innerHTML = `<span class="choice-key">${i < 9 ? i + 1 : ''}</span><span class="choice-label">${o.label}</span>${o.sub ? `<span class="choice-sub">${o.sub}</span>` : ''}`;
    b.addEventListener('click', () => choose(o.id));
    opts.appendChild(b);
  });

  const actions = document.createElement('div');
  actions.className = 'slot-actions';
  const mk = (text, cls, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + cls;
    b.textContent = text;
    b.addEventListener('click', fn);
    actions.appendChild(b);
    return b;
  };
  const undoBtn = mk('Undo', '', undo);
  const previewBtn = preview ? mk(previewLabel, '', () => preview([...values])) : null;
  const checkBtn = mk('Check', 'btn-primary', () => { if (values.every(Boolean)) onSubmit([...values]); });

  container.append(row, opts, actions);

  function choose(id) {
    if (revealed || active < 0) return;
    values[active] = id;
    const nextEmpty = values.findIndex((v, i) => v === null && i > active);
    active = nextEmpty >= 0 ? nextEmpty : values.indexOf(null);
    paint();
  }

  function undo() {
    if (revealed) return;
    for (let i = slots - 1; i >= 0; i--) {
      if (values[i] !== null && !(i in fixed)) { values[i] = null; active = i; break; }
    }
    paint();
  }

  function paint() {
    slotEls.forEach((el, i) => {
      const v = values[i];
      const o = v && label(v);
      const r = results && !(i in fixed) ? results[i] : null;
      el.className = 'slot' + (i in fixed ? ' is-fixed' : v ? ' is-filled' : '') + (!revealed && i === active ? ' is-active' : '')
        + (r ? (r.ok ? ' is-correct' : ' is-wrong') : '');
      el.innerHTML = (o ? `<span class="slot-num">${o.label}</span>${o.sub ? `<span class="slot-sub">${o.sub}</span>` : ''}` : `<span class="slot-sub">${i + 1}</span>`)
        + (r?.note ? `<span class="slot-fix">${r.note}</span>` : '');
    });
    checkBtn.disabled = revealed || !values.every(Boolean);
    undoBtn.disabled = revealed;
  }

  if (slotKeyHandler) document.removeEventListener('keydown', slotKeyHandler);
  slotKeyHandler = (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Backspace') { e.preventDefault(); undo(); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && options[n - 1]) choose(options[n - 1].id);
  };
  document.addEventListener('keydown', slotKeyHandler);
  paint();

  return {
    mark() {},
    clear() {},
    // results: [{ ok, note }] per slot. After this, clicking a slot calls onClick(i).
    reveal(res, onClick) {
      revealed = true;
      results = res;
      onSlotClick = onClick;
      paint();
    },
  };
}
