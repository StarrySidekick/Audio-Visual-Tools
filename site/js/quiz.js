// Shared quiz loop: ask, answer, explain, score. Each game supplies only
// newQuestion(), which returns:
//   {
//     answer,                      // id of the right choice
//     choices: [{ id, label }],    // for the default button grid, or
//     mountChoices(el, onPick),    // a custom widget (e.g. piano) instead
//     render(stageEl),             // optional visual prompt (staff)
//     play(),                      // optional audio prompt
//     playChoice(id),              // optional: hear any option after reveal
//     explain(pickedId, correct),  // HTML shown after answering
//     hotkeys: { key: id },        // optional extra keyboard shortcuts
//     isCorrect(id),               // optional: when several answers are right
//     autoAdvance: false,          // optional: wait for Next even when right
//   }
//
// Two modes: Practice (no clock, tracks best streak) and Sprint (60 seconds,
// tracks best score).

import { unlock, stop } from './audio.js';
import { buttonChoices, load, save } from './ui.js';

const SPRINT_SECONDS = 60;

export function createQuiz({ gameId, newQuestion }) {
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const choicesEl = $('choices');
  const feedback = $('feedback');
  const playBtn = $('play');
  const nextBtn = $('next');
  const modeSel = $('mode');
  const scoreEl = $('score');

  let q = null;
  let ui = null;
  let answered = false;
  let started = false;
  let advanceTimer = null;
  let s = { right: 0, total: 0, streak: 0 };
  let sprint = { on: false, endsAt: 0, tick: null };

  const mode = () => (modeSel ? modeSel.value : 'practice');
  const bestKey = () => `best:${gameId}:${mode()}`;

  function renderScore() {
    const best = load(bestKey(), 0);
    const pct = s.total ? Math.round((100 * s.right) / s.total) : 0;
    const parts = [
      stat('Score', `${s.right}/${s.total}`),
      stat('Accuracy', s.total ? pct + '%' : '–'),
      stat('Streak', s.streak),
      stat(mode() === 'sprint' ? 'Best sprint' : 'Best streak', best),
    ];
    if (sprint.on) parts.unshift(stat('Time', Math.max(0, Math.ceil((sprint.endsAt - Date.now()) / 1000)) + 's', 'is-timer'));
    scoreEl.innerHTML = parts.join('');
  }

  function stat(label, value, cls = '') {
    return `<div class="stat ${cls}"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
  }

  function showStart(message = '') {
    started = false;
    stage.innerHTML = `<div class="start">${message ? `<p class="start-msg">${message}</p>` : ''}<button type="button" class="btn btn-primary btn-big" id="start">${message ? 'Go again' : 'Start'}</button><p class="hint">Space: replay · 1–9: answer · Enter: next</p></div>`;
    choicesEl.innerHTML = '';
    feedback.innerHTML = '';
    playBtn.disabled = true;
    nextBtn.disabled = true;
    $('start').addEventListener('click', begin);
  }

  function begin() {
    unlock();
    started = true;
    s = { right: 0, total: 0, streak: 0 };
    if (mode() === 'sprint') {
      sprint.on = true;
      sprint.endsAt = Date.now() + SPRINT_SECONDS * 1000;
      clearInterval(sprint.tick);
      sprint.tick = setInterval(() => {
        if (Date.now() >= sprint.endsAt) endSprint();
        else renderScore();
      }, 250);
    }
    next();
  }

  function endSprint() {
    clearInterval(sprint.tick);
    clearTimeout(advanceTimer);
    sprint.on = false;
    stop();
    const best = load(bestKey(), 0);
    const newBest = s.right > best;
    if (newBest) save(bestKey(), s.right);
    renderScore();
    showStart(`Time. ${s.right} right out of ${s.total}.${newBest ? ' New best.' : ''}`);
  }

  function next() {
    if (!started) return;
    clearTimeout(advanceTimer);
    answered = false;
    q = newQuestion(q);
    feedback.innerHTML = '';
    nextBtn.disabled = true;
    playBtn.disabled = !q.play;
    if (q.render) q.render(stage);
    else stage.innerHTML = '<div class="listen" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>';
    ui = q.mountChoices ? q.mountChoices(choicesEl, pick) : buttonChoices(choicesEl, q.choices, pick);
    renderScore();
    if (q.play) replay();
  }

  function replay() {
    if (!q?.play) return;
    stage.querySelector('.listen')?.classList.remove('is-playing');
    const secs = q.play();
    const l = stage.querySelector('.listen');
    if (l && secs) {
      void l.offsetWidth; // restart the CSS animation
      l.classList.add('is-playing');
      setTimeout(() => l.classList.remove('is-playing'), secs * 1000);
    }
  }

  function pick(id) {
    if (!started || !q) return;
    if (answered) {
      // After the reveal, clicking an option lets you hear it, to compare.
      q.playChoice?.(id);
      return;
    }
    answered = true;
    const correct = q.isCorrect ? q.isCorrect(id) : String(id) === String(q.answer);
    s.total++;
    if (correct) {
      s.right++;
      s.streak++;
      ui.mark(id, 'correct');
    } else {
      s.streak = 0;
      ui.mark(id, 'wrong');
      ui.mark(q.answer, 'correct');
    }
    if (mode() === 'practice' && s.streak > load(bestKey(), 0)) save(bestKey(), s.streak);
    const head = correct ? '<strong class="ok">Yes.</strong> ' : '<strong class="no">Not quite.</strong> ';
    const compare = !correct && q.playChoice ? '<p class="hint">Click any answer to hear it and compare.</p>' : '';
    feedback.innerHTML = `<div class="${correct ? 'fb-ok' : 'fb-no'}">${head}${q.explain(id, correct)}${compare}</div>`;
    nextBtn.disabled = false;
    renderScore();
    q.onReveal?.(id, correct);
    if (sprint.on) advanceTimer = setTimeout(next, correct ? 350 : 1100);
    else if (correct && q.autoAdvance !== false) advanceTimer = setTimeout(next, 1600);
  }

  playBtn.addEventListener('click', replay);
  nextBtn.addEventListener('click', next);
  modeSel?.addEventListener('change', () => {
    clearInterval(sprint.tick);
    sprint.on = false;
    save(`mode:${gameId}`, modeSel.value);
    showStart();
    renderScore();
  });
  if (modeSel) modeSel.value = load(`mode:${gameId}`, 'practice');

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!started) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); }
      return;
    }
    if (e.key === ' ') { e.preventDefault(); replay(); return; }
    if ((e.key === 'Enter' || e.key === 'ArrowRight') && answered) { e.preventDefault(); next(); return; }
    const hk = q?.hotkeys?.[e.key.toLowerCase()];
    if (hk !== undefined) { pick(hk); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && q?.choices?.[n - 1]) pick(q.choices[n - 1].id);
  });

  showStart();
  renderScore();

  return {
    // Call after a settings change: fresh question, same score.
    refresh() {
      if (started) next();
    },
  };
}
