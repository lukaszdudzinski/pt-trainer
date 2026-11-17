// Fiszki „Znam / Nie znam” (spec 4.5).
import { questionsFor, shuffle } from '../bank.js';
import { createSession, current, answer, isDone, summary } from '../session.js';
import { reviewIds } from '../progress.js';
import { sectionName } from '../../data/subjects.js';
import { showScreen, goHome } from '../nav.js';
import { escapeHtml } from './answers.js';

export const flashHooks = { onCard: null };

export function initFlashcards(ctx) {
  const el = (id) => document.getElementById(id);
  let session = null;
  let subject = null;
  let q = null;
  let flipped = false;
  let decided = false;
  let lockUntil = 0;
  const INPUT_LOCK_MS = 300;
  const locked = () => Date.now() < lockUntil;

  function setButtons() {
    el('btnFlip').hidden = flipped;
    el('btnKnow').closest('.row').hidden = decided;
    el('btnFlashNext').hidden = !decided;
  }

  function render() {
    q = current(session);
    flipped = false;
    decided = false;
    el('flashSummary').hidden = true;
    el('flashProgress').textContent = `${session.index + 1} / ${session.queue.length}`;
    el('flashFront').innerHTML = `<p class="section-label">${escapeHtml(sectionName(subject, q.section))}</p><p class="flash-question">${escapeHtml(q.question)}</p>`;
    el('flashBack').innerHTML = `<p class="flash-answer">${escapeHtml(q.options[q.answer])}</p><p class="muted">${escapeHtml(q.explanation)}</p>`;
    el('flashBack').hidden = true;
    el('btnFlip').closest('.row').hidden = false;
    setButtons();
    if (flashHooks.onCard) flashHooks.onCard(q, 'front');
  }

  function finish() {
    const s = summary(session);
    el('flashFront').innerHTML = '';
    el('flashBack').hidden = true;
    el('btnFlip').closest('.row').hidden = true;
    el('btnKnow').closest('.row').hidden = true;
    el('btnFlashNext').hidden = true;
    el('flashProgress').textContent = '';
    el('flashSummary').hidden = false;
    el('flashSummary').innerHTML = `<h3>Koniec fiszek</h3><p>Kart: <strong>${s.total}</strong>, „Znam” za pierwszym razem: <strong>${s.correctFirstTry}</strong>.</p><button type="button" class="btn btn-primary" id="btnFlashHome">Wróć na start</button>`;
    el('btnFlashHome').addEventListener('click', goHome);
  }

  function flip() {
    if (!q || flipped) return;
    flipped = true;
    el('flashBack').hidden = false;
    setButtons();
    if (flashHooks.onCard) flashHooks.onCard(q, 'back');
  }

  function advance(correct) {
    lockUntil = Date.now() + INPUT_LOCK_MS;
    session = answer(session, correct);
    if (isDone(session)) finish(); else render();
  }

  function know() {
    if (!q || decided || locked()) return;
    ctx.state.recordAnswer(subject, q.id, true);
    advance(true);
  }

  function dontKnow() {
    if (!q || decided || locked()) return;
    ctx.state.recordAnswer(subject, q.id, false);
    decided = true;
    if (!flipped) flip();
    setButtons();
  }

  function next() {
    if (!q) return;
    if (decided) advance(false);
    else if (flipped) know();
  }

  function startFlashcards({ scope = 'all' }) {
    subject = ctx.state.subject;
    const bank = questionsFor(ctx.questions, subject);
    let list;
    if (scope === 'review') {
      const ids = new Set(reviewIds(ctx.state.progress(subject), ctx.state.stars(subject), bank.map((x) => x.id)));
      list = bank.filter((x) => ids.has(x.id));
    } else list = questionsFor(ctx.questions, subject, scope);
    if (!list.length) return false;
    session = createSession(shuffle(list));
    showScreen('screenFlash');
    render();
    return true;
  }

  el('btnFlip').addEventListener('click', flip);
  el('btnKnow').addEventListener('click', know);
  el('btnDontKnow').addEventListener('click', dontKnow);
  el('btnFlashNext').addEventListener('click', next);
  el('btnFlashQuit').addEventListener('click', goHome);
  el('btnFlashRepeat').addEventListener('click', () => { if (q && flashHooks.onCard) flashHooks.onCard(q, flipped ? 'back' : 'front', { repeat: true }); });

  return { startFlashcards, flip, know, dontKnow, next, side: () => (flipped ? 'back' : 'front'), current: () => q };
}
