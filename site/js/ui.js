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
